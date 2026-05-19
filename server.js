import express from 'express';
import WebTorrent from 'webtorrent';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const CACHE_DIR = path.join(__dirname, 'temp_cache');
const REGISTRY_FILE = path.join(__dirname, 'aniTOR_registry.json');

// --- SETUP ---
app.use(express.json());
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
if (!fs.existsSync(REGISTRY_FILE)) fs.writeFileSync(REGISTRY_FILE, JSON.stringify({ history: [] }, null, 2), 'utf8');

const client = new WebTorrent();
let activeTorrentReference = null;

// --- DATABASE HELPERS ---
function getRegistry() {
  try { return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')); } catch (e) { return { history: [] }; }
}

function writeRegistry(data) {
  try { fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
}

function updateRegistryItem(infoHash, updates) {
  const db = getRegistry();
  const idx = db.history.findIndex(item => item.infoHash.toLowerCase() === infoHash.toLowerCase());
  if (idx !== -1) {
    db.history[idx] = { ...db.history[idx], ...updates };
    writeRegistry(db);
  }
}

// --- HELPER FUNCTIONS ---
function getHashFromMagnet(magnet) {
  if (!magnet) return null;
  const clean = magnet.trim();
  if (/^[a-fA-F0-9]{40}$/.test(clean)) return clean.toLowerCase();
  const match = clean.match(/urn:btih:([a-zA-Z0-9]+)/i);
  return match ? match[1].toLowerCase() : null;
}

function findVideoFile(torrent) {
  if (!torrent || !torrent.files) return null;
  return torrent.files.find(file => file.name.match(/\.(mp4|mkv|webm|avi|mov|flv)$/i));
}

// --- API ROUTES ---

app.post('/api/stream', (req, res) => {
  const { magnetLink } = req.body;
  const infoHash = getHashFromMagnet(magnetLink);
  
  if (!infoHash) return res.status(400).json({ error: 'Invalid magnet link' });

  console.log(`📥 Requesting stream engine: ${infoHash}`);

  let isResponded = false;
  const safeRespond = (statusCode, payload) => {
    if (!isResponded) {
      isResponded = true;
      res.status(statusCode).json(payload);
    }
  };

  const timeout = setTimeout(() => {
    if (!isResponded) {
      console.log(`⚠️ [Timeout]: No active seeders found for infoHash: ${infoHash}`);
      safeRespond(504, { error: 'Timed out waiting for metadata.' });
      
      const deadTorrent = client.torrents.find(t => t.infoHash.toLowerCase() === infoHash.toLowerCase());
      if (deadTorrent) {
        try { client.remove(deadTorrent.infoHash); } catch(e) {}
      }
    }
  }, 20000);

  const handleReadyTorrent = (torrent) => {
    clearTimeout(timeout);
    
    const file = findVideoFile(torrent);
    if (!file) return safeRespond(404, { error: 'No video file found in torrent' });
    
    activeTorrentReference = torrent;

    const db = getRegistry();
    const exists = db.history.find(h => h.infoHash.toLowerCase() === infoHash);
    if (!exists) {
      db.history.unshift({
        infoHash: infoHash,
        magnetLink: magnetLink,
        title: file.name,
        relativeSavePath: file.path,
        progress: '0.0'
      });
      writeRegistry(db);
    }

    if (torrent && typeof torrent.on === 'function') {
      torrent.on('download', () => {
        updateRegistryItem(infoHash, { progress: (torrent.progress * 100).toFixed(1) });
      });
    }

    safeRespond(200, {
      streamUrl: `http://localhost:${PORT}/api/video-stream`,
      title: file.name,
      infoHash: infoHash
    });
  };

  try {
    const existingTorrent = client.torrents.find(t => t.infoHash.toLowerCase() === infoHash.toLowerCase());

    if (existingTorrent) {
      if (existingTorrent.ready) {
        handleReadyTorrent(existingTorrent);
      } else {
        const checkReadyInterval = setInterval(() => {
          if (existingTorrent.ready) {
            clearInterval(checkReadyInterval);
            handleReadyTorrent(existingTorrent);
          }
        }, 200);
        setTimeout(() => clearInterval(checkReadyInterval), 20000);
      }
    } else {
      client.add(magnetLink, { path: CACHE_DIR }, (newTorrent) => {
        handleReadyTorrent(newTorrent);
      });
    }
  } catch (err) {
    console.error("Initialization Error:", err);
    clearTimeout(timeout);
    safeRespond(500, { error: err.message });
  }
});

// Dummy endpoints added to safely absorb frontend button clicks without causing 404s
app.post('/api/pause', (req, res) => res.json({ success: true, status: 'ignored' }));
app.post('/api/resume', (req, res) => res.json({ success: true, status: 'ignored' }));

// --- CRASH-PROOF STREAM PIPELINE ---
app.get('/api/video-stream', (req, res) => {
  if (!activeTorrentReference) return res.status(400).send('No active torrent');
  
  const file = findVideoFile(activeTorrentReference);
  if (!file) return res.status(404).send('No file');

  const range = req.headers.range;
  const size = file.length;
  
  let mimeType = 'video/mp4';
  if (file.name.endsWith('.mkv')) mimeType = 'video/x-matroska';
  else if (file.name.endsWith('.webm')) mimeType = 'video/webm';
  else if (file.name.endsWith('.avi')) mimeType = 'video/x-msvideo';

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
    
    res.writeHead(206, { 
      'Content-Range': `bytes ${start}-${end}/${size}`, 
      'Accept-Ranges': 'bytes', 
      'Content-Length': (end - start) + 1, 
      'Content-Type': mimeType 
    });

    const stream = file.createReadStream({ start, end });
    
    stream.on('error', (err) => {
      console.log(`📡 Stream safely closed/shifted (Info: ${err.message})`);
    });

    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': size, 'Content-Type': mimeType });
    const stream = file.createReadStream();
    
    stream.on('error', (err) => {
      console.log(`📡 Stream safely closed/shifted (Info: ${err.message})`);
    });

    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }
});

// --- CACHE & VLC CONTROL INTERFACES ---
app.post('/api/force-full-download', (req, res) => {
  const { infoHash } = req.body;
  const targetTorrent = client.torrents.find(t => t.infoHash.toLowerCase() === infoHash.toLowerCase());
  if (targetTorrent) targetTorrent.select(0, targetTorrent.pieces.length - 1, 1);
  res.sendStatus(200);
});

app.post('/api/open-vlc', (req, res) => {
  if (!activeTorrentReference) return res.status(400).send('No context.');
  exec(`start vlc "http://localhost:${PORT}/api/video-stream"`);
  res.sendStatus(200);
});

app.post('/api/open-vlc-local', (req, res) => {
  const { infoHash } = req.body;
  const record = getRegistry().history.find(h => h.infoHash.toLowerCase() === infoHash.toLowerCase());
  if (!record) return res.status(404).send('Record not found.');
  exec(`start vlc "${path.join(CACHE_DIR, record.relativeSavePath)}"`);
  res.sendStatus(200);
});

app.get('/api/history', (req, res) => res.json(getRegistry().history));
app.get('/api/cached-files', (req, res) => res.json(getRegistry().history));

app.post('/api/delete-cache', (req, res) => {
  const { infoHash } = req.body;
  const db = getRegistry();
  const idx = db.history.findIndex(h => h.infoHash.toLowerCase() === infoHash.toLowerCase());
  if (idx === -1) return res.status(404).send('Not found.');

  const recordItem = db.history[idx];
  try { client.remove(infoHash); } catch(e) {}
  
  const folderRoot = recordItem.relativeSavePath.split(path.sep)[0];
  const absolutePath = path.join(CACHE_DIR, folderRoot);
  if (fs.existsSync(absolutePath)) fs.rmSync(absolutePath, { recursive: true, force: true });

  db.history.splice(idx, 1);
  writeRegistry(db);
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  if (!activeTorrentReference) return res.json({ active: false });
  res.json({
    active: true,
    progress: (activeTorrentReference.progress * 100).toFixed(1),
    downloadSpeed: (activeTorrentReference.downloadSpeed / 1024 / 1024).toFixed(2),
    peers: activeTorrentReference.numPeers,
    status: 'downloading'
  });
});

// Serve frontend assets last
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`AniTOR Server running at: http://localhost:${PORT}`);
  
  // Automatically open the user's default web browser
  const platform = process.platform;
  const startCmd = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';
  
  exec(`${startCmd} http://localhost:${PORT}`, (err) => {
    if (err) console.log('Ready! Please open http://localhost:3000 in your browser.');
  });
});
