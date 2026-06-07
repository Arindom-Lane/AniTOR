import express         from 'express';
import WebTorrent       from 'webtorrent';
import fs               from 'fs';
import path             from 'path';
import https            from 'https';
import { exec }         from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const require    = createRequire(import.meta.url);

// =====================================================
// MEMORY STORE  — zero SSD reads/writes
// Install once:  npm i memory-chunk-store
// All torrent pieces live in RAM and are freed when
// the torrent is removed.  No temp_cache writes at all.
// =====================================================
let MemoryStore = null;
try {
    MemoryStore = require('memory-chunk-store');
    console.log('[store] ✓  RAM mode – zero SSD writes');
} catch {
    console.log('[store] ✗  memory-chunk-store not installed');
    console.log('[store]    Run: npm i memory-chunk-store');
    console.log('[store]    Falling back to disk (temp_cache/)');
}

const app    = express();
const PORT   = 3000;
const client = new WebTorrent();

const CACHE_DIR    = path.join(__dirname, 'temp_cache');
const HISTORY_FILE = path.join(__dirname, 'history.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!MemoryStore && !fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, '[]');
}


// =====================================================
// STATE
// =====================================================
let currentTorrent = null;
let currentStream  = null;
let lastActivity   = Date.now();
let isPaused       = false;          // true = torrent.pause() in effect


// =====================================================
// HELPERS
// =====================================================

/** Pick the largest video file in the torrent. */
function getVideoFile(torrent) {
    return torrent.files
        .filter(f => /\.(mp4|mkv|webm|avi)$/i.test(f.name))
        .sort((a, b) => b.length - a.length)[0];
}

/**
 * Strip fansub group tags, quality tags, episode numbers
 * from a typical anime torrent filename to get a clean
 * search query for the Jikan API.
 *
 * e.g.  "[HorribleSubs] Demon Slayer - 01 [1080p].mkv"
 *    →  "Demon Slayer"
 */
function parseAnimeName(filename) {
    let n = filename.replace(/\.[^.]+$/, '');        // drop extension
    n = n.replace(/^\[.*?\]\s*/, '');                // drop leading [Group]
    n = n.replace(/\s*[\[(][^\])"]+[\])]/g, '');    // drop all [tag] / (tag)
    n = n.replace(/[-_\s]+(?:S\d+E\d+|\d{2,3}v?\d?).*$/i, ''); // drop ep numbers
    n = n.replace(/\bEpisodes?\s*\d+.*/i, '');
    n = n.replace(/[._]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return n;
}


// =====================================================
// JIKAN API  (MyAnimeList, free, no key required)
// Node-native https – works on Node 14+
// =====================================================

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'AniTOR/2.0' } }, res => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(raw)); }
                catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

async function fetchAnimeInfo(filename) {
    try {
        const query = parseAnimeName(filename);
        if (!query || query.length < 2) return null;

        const search = await httpsGet(
            `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1&sfw=false`
        );
        if (!search.data?.length) return null;
        const a = search.data[0];

        // Fetch sequel / prequel relations
        let relations = [];
        try {
            const rel = await httpsGet(`https://api.jikan.moe/v4/anime/${a.mal_id}/relations`);
            relations = (rel.data || [])
                .filter(r => r.relation === 'Sequel' || r.relation === 'Prequel')
                .map(r => ({ relation: r.relation, entries: r.entry }));
        } catch {}

        return {
            malId:         a.mal_id,
            title:         a.title_english || a.title,
            titleJapanese: a.title_japanese,
            poster:        a.images?.jpg?.large_image_url || a.images?.jpg?.image_url,
            synopsis:      a.synopsis,
            score:         a.score,
            rank:          a.rank,
            episodes:      a.episodes,
            status:        a.status,
            aired:         a.aired?.string,
            genres:        (a.genres  || []).map(g => g.name),
            studios:       (a.studios || []).map(s => s.name),
            relations,
        };
    } catch (err) {
        console.warn('[anime]', err.message);
        return null;
    }
}


// =====================================================
// HISTORY
// =====================================================

function readHistory() {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
}

function writeHistory(arr) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(arr, null, 2));
}

function saveToHistory(title, magnet) {
    const h = readHistory().filter(i => i.magnetLink !== magnet);
    h.unshift({ title, magnetLink: magnet });
    if (h.length > 50) h.length = 50;
    writeHistory(h);
}


// =====================================================
// TORRENT TEARDOWN
// =====================================================

async function destroyTorrent() {
    if (!currentTorrent) return;

    return new Promise(resolve => {
        console.log('[torrent] Destroying...');

        try { currentStream?.destroy(); } catch {}
        currentStream = null;

        const folder = MemoryStore ? null : currentTorrent.path;

        client.remove(currentTorrent.infoHash, { destroyStore: true }, () => {
            if (folder) {
                try { fs.rmSync(folder, { recursive: true, force: true }); }
                catch (e) { console.warn('[cache]', e.message); }
            }
            currentTorrent = null;
            isPaused       = false;
            resolve();
        });
    });
}


// =====================================================
// POST /api/stream
// Add the torrent, find the video file, halt
// all downloading until the player makes a range request.
// =====================================================
app.post('/api/stream', async (req, res) => {
    const { magnetLink } = req.body;
    if (!magnetLink) return res.status(400).send('No magnet link provided');

    await destroyTorrent();

    const opts = MemoryStore
        ? { store: MemoryStore }
        : { path: path.join(CACHE_DIR, Date.now().toString()) };

    client.add(magnetLink, opts, torrent => {
        currentTorrent = torrent;
        isPaused       = false;
        lastActivity   = Date.now();

        const video = getVideoFile(torrent);
        if (!video) {
            destroyTorrent();
            return res.status(404).send('No video file found in torrent');
        }

        // Halt everything — the video-stream endpoint will resume
        // only the pieces that are actually needed at playback position.
        torrent.pause();
        isPaused = true;

        saveToHistory(video.name, magnetLink);

        // Return the filename immediately; anime info is fetched
        // separately so the player can start without waiting on Jikan.
        res.json({ title: video.name });
    });
});


// =====================================================
// GET /api/anime-info  (non-blocking, called by client)
// =====================================================
app.get('/api/anime-info', async (req, res) => {
    const { title } = req.query;
    if (!title) return res.json(null);
    const info = await fetchAnimeInfo(title);
    res.json(info);
});


// =====================================================
// GET /api/video-stream  — byte-range streaming
//
// SSD-reduction strategy (same as streaming services):
//   1. Memory store → pieces never hit disk
//   2. Piece-window selection → only download what's
//      currently needed for playback (not the whole file)
//   3. torrent.pause() when browser player is paused →
//      zero download activity during pause
// =====================================================
app.get('/api/video-stream', (req, res) => {
    if (!currentTorrent) return res.status(400).send('No active torrent');

    const file = getVideoFile(currentTorrent);
    if (!file)  return res.status(404).send('No video file');

    const range = req.headers.range;
    if (!range) return res.status(400).send('Range header required');

    const [rawStart, rawEnd] = range.replace(/bytes=/, '').split('-');
    const start  = parseInt(rawStart, 10);
    const end    = rawEnd
        ? parseInt(rawEnd, 10)
        : Math.min(start + 4 * 1024 * 1024, file.length - 1);  // 4 MB window
    const chunkSz = end - start + 1;

    // Calculate piece window for this byte range
    const pieceLen = currentTorrent.pieceLength;
    const maxPiece = currentTorrent.pieces.length - 1;
    const p0 = Math.max(0, Math.floor(start / pieceLen));
    const p1 = Math.min(Math.floor(end   / pieceLen) + 2, maxPiece);

    // Resume download if paused, then narrow selection to current window only
    if (isPaused) {
        currentTorrent.resume();
        isPaused = false;
    }
    currentTorrent.deselect(0, maxPiece, false);   // clear everything
    currentTorrent.select(p0, p1, true);            // only what we need now

    const mime = {
        '.mp4':  'video/mp4',
        '.mkv':  'video/x-matroska',
        '.webm': 'video/webm',
        '.avi':  'video/x-msvideo',
    }[path.extname(file.name).toLowerCase()] || 'video/mp4';

    res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${file.length}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunkSz,
        'Content-Type':   mime,
        'Cache-Control':  'no-store',
    });

    lastActivity = Date.now();

    const stream = file.createReadStream({ start, end });
    currentStream = stream;

    stream.on('data',  ()  => { lastActivity = Date.now(); });
    stream.on('error', err => console.error('[stream]', err.message));
    stream.on('close', ()  => { currentStream = null; });

    res.on('close', () => {
        try { stream.destroy(); } catch {}
        currentStream = null;
    });

    stream.pipe(res);
});


// =====================================================
// POST /api/pause-download
// FIX: was incorrectly calling stop-stream from the
// browser player's pause event, destroying the torrent.
// Now we just halt downloading — torrent stays alive.
// =====================================================
app.post('/api/pause-download', (req, res) => {
    if (currentTorrent && !isPaused) {
        currentTorrent.pause();
        isPaused = true;
        console.log('[torrent] Download paused');
    }
    res.sendStatus(200);
});


// =====================================================
// POST /api/resume-download
// =====================================================
app.post('/api/resume-download', (req, res) => {
    if (currentTorrent && isPaused) {
        currentTorrent.resume();
        isPaused = false;
        console.log('[torrent] Download resumed');
    }
    res.sendStatus(200);
});


// =====================================================
// POST /api/stop-stream
// Full teardown — called on page unload or new magnet.
// NOT called on pause anymore.
// =====================================================
app.post('/api/stop-stream', async (req, res) => {
    console.log('[torrent] Full stop');
    await destroyTorrent();
    res.sendStatus(200);
});


// =====================================================
// POST /api/open-vlc  — FIX: this endpoint was MISSING
// Opens the HTTP stream in VLC for subtitle/dual-audio.
// Tries PATH first, then Windows default install path.
// =====================================================
app.post('/api/open-vlc', (req, res) => {
    if (!currentTorrent) return res.status(400).send('No active stream');

    const streamUrl = `http://localhost:${PORT}/api/video-stream`;

    let cmd;
    if (process.platform === 'win32') {
        // Try default VLC path; if absent, hope vlc is in PATH
        const vlcDefault = 'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe';
        cmd = fs.existsSync(vlcDefault)
            ? `start "" "${vlcDefault}" "${streamUrl}"`
            : `start "" vlc "${streamUrl}"`;
    } else if (process.platform === 'darwin') {
        cmd = `open -a VLC "${streamUrl}"`;
    } else {
        cmd = `vlc "${streamUrl}"`;
    }

    exec(cmd, err => {
        if (err) console.warn('[vlc]', err.message);
    });

    res.sendStatus(200);
});


// =====================================================
// GET /api/history
// =====================================================
app.get('/api/history', (req, res) => {
    res.json(readHistory());
});


// =====================================================
// DELETE /api/history  — delete by magnetLink
// =====================================================
app.delete('/api/history', (req, res) => {
    const { magnetLink } = req.body;
    if (!magnetLink) return res.status(400).send('magnetLink required');
    const h = readHistory().filter(i => i.magnetLink !== magnetLink);
    writeHistory(h);
    res.sendStatus(200);
});


// =====================================================
// GET /api/stats
// =====================================================
app.get('/api/stats', (req, res) => {
    if (!currentTorrent) return res.json({ active: false });
    res.json({
        active:        true,
        paused:        isPaused,
        progress:      (currentTorrent.progress * 100).toFixed(1),
        downloadSpeed: (currentTorrent.downloadSpeed / 1024 / 1024).toFixed(2),
        peers:         currentTorrent.numPeers,
    });
});


// =====================================================
// IDLE CLEANUP
// Only fires when NOT paused and genuinely idle (4 min).
// Paused = user intentionally stopped; don't destroy.
// =====================================================
setInterval(async () => {
    if (!currentTorrent || isPaused) return;
    if (Date.now() - lastActivity > 240_000) {
        console.log('[torrent] Idle 4 min – cleaning up');
        await destroyTorrent();
    }
}, 5000);


// =====================================================
// START
// =====================================================
app.listen(PORT, () => {
    console.log(`\n🎬  AniTOR  →  http://localhost:${PORT}\n`);
    const open = process.platform === 'win32' ? 'start'
               : process.platform === 'darwin' ? 'open'
               : 'xdg-open';
    exec(`${open} http://localhost:${PORT}`);
});