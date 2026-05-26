import express from 'express';
import WebTorrent from 'webtorrent';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const client = new WebTorrent();

const PORT = 3000;

const CACHE_DIR = path.join(__dirname, 'temp_cache');
const HISTORY_FILE = path.join(__dirname, 'history.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// =====================================================
// CREATE CACHE + HISTORY
// =====================================================

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}

if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(
        HISTORY_FILE,
        JSON.stringify([])
    );
}


// =====================================================
// GLOBAL VARIABLES
// =====================================================

let currentTorrent = null;
let currentStream = null;


// =====================================================
// READ HISTORY
// =====================================================

function readHistory() {

    const raw = fs.readFileSync(
        HISTORY_FILE,
        'utf8'
    );

    return JSON.parse(raw);
}


// =====================================================
// SAVE HISTORY
// =====================================================

function saveHistory(title, magnet, hash) {

    const history = readHistory();

    history.unshift({
        title: title,
        magnetLink: magnet,
        infoHash: hash,
        progress: '0.0'
    });

    fs.writeFileSync(
        HISTORY_FILE,
        JSON.stringify(history, null, 2)
    );
}


// =====================================================
// UPDATE DOWNLOAD PROGRESS
// =====================================================

function updateProgress(hash, progress) {

    const history = readHistory();

    for (let i = 0; i < history.length; i++) {

        if (history[i].infoHash === hash) {

            history[i].progress = progress;
        }
    }

    fs.writeFileSync(
        HISTORY_FILE,
        JSON.stringify(history, null, 2)
    );
}


// =====================================================
// FIND VIDEO FILE
// =====================================================

function getVideoFile(torrent) {

    for (let i = 0; i < torrent.files.length; i++) {

        const file = torrent.files[i];

        if (
            file.name.endsWith('.mp4') ||
            file.name.endsWith('.mkv') ||
            file.name.endsWith('.webm') ||
            file.name.endsWith('.avi')
        ) {
            return file;
        }
    }

    return null;
}


// =====================================================
// DELETE OLD TORRENT
// =====================================================

async function deleteOldTorrent() {

    if (currentTorrent == null) {
        return;
    }

    return new Promise(resolve => {

        const folder = path.join(
            CACHE_DIR,
            currentTorrent.path || ''
        );

        if (currentStream) {

            try {
                currentStream.destroy();
            } catch {}
        }

        client.remove(
            currentTorrent.infoHash,
            { destroyStore: true },

            () => {

                try {

                    fs.rmSync(folder, {
                        recursive: true,
                        force: true
                    });

                } catch {}

                currentTorrent = null;
                currentStream = null;

                resolve();
            }
        );
    });
}


// =====================================================
// START STREAM
// =====================================================

app.post('/api/stream', async (req, res) => {

    const magnetLink = req.body.magnetLink;

    if (!magnetLink) {

        return res
            .status(400)
            .send('No magnet link');
    }


    // DELETE OLD STREAM

    await deleteOldTorrent();


    // START NEW STREAM

    client.add(
        magnetLink,
        { path: CACHE_DIR },

        torrent => {

            currentTorrent = torrent;

            const video = getVideoFile(torrent);

            if (!video) {

                return res
                    .status(404)
                    .send('No video file');
            }


            // SAVE HISTORY

            saveHistory(
                video.name,
                magnetLink,
                torrent.infoHash
            );


            // UPDATE DOWNLOAD %

            torrent.on('download', () => {

                const percent =
                    (
                        torrent.progress * 100
                    ).toFixed(1);

                updateProgress(
                    torrent.infoHash,
                    percent
                );
            });


            res.json({
                title: video.name,
                infoHash: torrent.infoHash
            });
        }
    );
});


// =====================================================
// VIDEO STREAM
// =====================================================

app.get('/api/video-stream', (req, res) => {

    if (!currentTorrent) {

        return res
            .status(400)
            .send('No torrent');
    }

    const file = getVideoFile(currentTorrent);

    if (!file) {

        return res
            .status(404)
            .send('No video');
    }

    const range = req.headers.range;

    if (!range) {

        return res
            .status(400)
            .send('No range');
    }


    // RANGE

    const parts = range
        .replace('bytes=', '')
        .split('-');

    const start = parseInt(parts[0]);

    let end;

    if (parts[1]) {
        end = parseInt(parts[1]);
    } else {
        end = file.length - 1;
    }

    const chunkSize =
        (end - start) + 1;


    // MIME TYPE

    let type = 'video/mp4';

    if (file.name.endsWith('.mkv')) {
        type = 'video/x-matroska';
    }

    if (file.name.endsWith('.webm')) {
        type = 'video/webm';
    }


    // HEADERS

    res.writeHead(206, {

        'Content-Range':
            `bytes ${start}-${end}/${file.length}`,

        'Accept-Ranges': 'bytes',

        'Content-Length': chunkSize,

        'Content-Type': type
    });


    // STREAM

    currentStream =
        file.createReadStream({
            start: start,
            end: end
        });

    currentStream.pipe(res);


    // CLOSE

    res.on('close', () => {

        try {
            currentStream.destroy();
        } catch {}
    });
});


// =====================================================
// OPEN VLC
// =====================================================

app.post('/api/open-vlc', (req, res) => {

    exec(
        `start vlc "http://localhost:${PORT}/api/video-stream"`
    );

    res.sendStatus(200);
});


// =====================================================
// GET HISTORY
// =====================================================

app.get('/api/history', (req, res) => {

    const history = readHistory();

    res.json(history);
});


// =====================================================
// GET STATS
// =====================================================

app.get('/api/stats', (req, res) => {

    if (!currentTorrent) {

        return res.json({
            active: false
        });
    }

    const progress =
        (
            currentTorrent.progress * 100
        ).toFixed(1);

    const speed =
        (
            currentTorrent.downloadSpeed /
            1024 /
            1024
        ).toFixed(2);

    const peers =
        currentTorrent.numPeers;

    res.json({

        active: true,

        progress: progress,

        downloadSpeed: speed,

        peers: peers
    });
});


// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log(
        `Server running on http://localhost:${PORT}`
    );

    exec(
        `start http://localhost:${PORT}`
    );
});