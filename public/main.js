// =====================================================
// DOM REFS
// =====================================================

const startBtn      = document.getElementById('startBtn');
const magnetInput   = document.getElementById('magnetInput');
const videoUI       = document.getElementById('videoUI');
const videoTitle    = document.getElementById('videoTitle');
const verifiedBadge = document.getElementById('verifiedBadge');
const vlcBtn        = document.getElementById('vlcBtn');
const themeSelect   = document.getElementById('themeSelect');
const statsArea     = document.getElementById('statsArea');
const historyBtn    = document.getElementById('historyBtn');
const historyList   = document.getElementById('historyList');
const pausedBadge   = document.getElementById('pausedBadge');

let art           = null;
let statsInterval = null;
let isUnloading   = false;   // guard: don't send pause on page unload


// =====================================================
// THEME
// =====================================================

function saveTheme(theme) {
    localStorage.setItem('theme', theme);
}

function loadTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    themeSelect.value = saved;
}

themeSelect.addEventListener('change', () => {
    const theme = themeSelect.value;
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
});


// =====================================================
// PLAYER
// =====================================================

function destroyPlayer() {
    if (art) { art.destroy(true); art = null; }
}

function createPlayer() {
    destroyPlayer();

    art = new Artplayer({
        container:    '#artContainer',
        url:          '/api/video-stream',
        autoplay:     true,
        pip:          true,
        fullscreen:   true,
        playbackRate: true,
        setting:      true,
        aspectRatio:  true,
    });

    // ── PAUSE ─────────────────────────────────────────
    // FIX: was wrongly calling /api/stop-stream which
    // destroyed the whole torrent. Now we just pause
    // the download; torrent stays alive for resuming.
    art.on('pause', async () => {
        if (isUnloading) return;
        try {
            await fetch('/api/pause-download', { method: 'POST' });
            if (pausedBadge) pausedBadge.style.display = 'inline';
        } catch {}
    });

    // ── PLAY ──────────────────────────────────────────
    art.on('play', async () => {
        if (isUnloading) return;
        try {
            await fetch('/api/resume-download', { method: 'POST' });
            if (pausedBadge) pausedBadge.style.display = 'none';
        } catch {}
    });
}


// =====================================================
// STREAM
// =====================================================

async function startStream(magnetLink) {
    startBtn.disabled  = true;
    startBtn.innerText = 'Loading…';

    clearAnimePanel();

    try {
        const res = await fetch('/api/stream', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ magnetLink }),
        });

        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();

        videoUI.style.display   = 'block';
        videoTitle.innerText    = data.title;
        verifiedBadge.innerText = 'Streaming active';

        createPlayer();
        startStatsUpdater();

        // Anime info is fetched separately so the player
        // can start immediately without waiting on Jikan.
        loadAnimeInfo(data.title);

    } catch (err) {
        alert(err.message);
    } finally {
        startBtn.disabled  = false;
        startBtn.innerText = 'Start Stream';
    }
}


// =====================================================
// STATS
// =====================================================

function startStatsUpdater() {
    statsArea.style.display = 'flex';
    clearInterval(statsInterval);
    statsInterval = setInterval(loadStats, 1000);
}

async function loadStats() {
    try {
        const res  = await fetch('/api/stats');
        const data = await res.json();
        if (!data.active) return;

        document.getElementById('speedVal').innerText    = `${data.downloadSpeed} MB/s`;
        document.getElementById('peersVal').innerText    = data.peers;
        document.getElementById('progressVal').innerText = `${data.progress}%`;

        if (pausedBadge) {
            pausedBadge.style.display = data.paused ? 'inline' : 'none';
        }
    } catch {}
}


// =====================================================
// ANIME INFO PANEL
// =====================================================

/** Reset the panel to loading state before a new stream. */
function clearAnimePanel() {
    const panel = document.getElementById('animePanel');
    if (panel) panel.innerHTML = '<p class="anime-loading">Fetching info…</p>';
}

/** Fetch anime metadata from the server (non-blocking). */
async function loadAnimeInfo(filename) {
    try {
        const res  = await fetch(`/api/anime-info?title=${encodeURIComponent(filename)}`);
        const info = await res.json();
        if (info) {
            renderAnimePanel(info);
        } else {
            const panel = document.getElementById('animePanel');
            if (panel) panel.innerHTML = '<p class="anime-loading">No info found</p>';
        }
    } catch {
        const panel = document.getElementById('animePanel');
        if (panel) panel.innerHTML = '<p class="anime-loading">Could not load info</p>';
    }
}

/** Render the fetched anime info into the side panel. */
function renderAnimePanel(info) {
    const panel = document.getElementById('animePanel');
    if (!panel) return;

    const genreTags = (info.genres || [])
        .map(g => `<span class="tag">${g}</span>`)
        .join('');

    const studioTags = (info.studios || [])
        .map(s => `<span class="tag tag-studio">${s}</span>`)
        .join('');

    const scoreHtml = info.score
        ? `<span class="score-badge">⭐ ${info.score}</span>`
        : '';

    const rankHtml = info.rank
        ? `<span class="rank-badge">#${info.rank}</span>`
        : '';

    const synopsis = info.synopsis
        ? (info.synopsis.length > 380
            ? info.synopsis.slice(0, 380) + '…'
            : info.synopsis)
        : '';

    const relHtml = (info.relations || [])
        .flatMap(rel => rel.entries.map(e =>
            `<span class="relation-entry">
                <span class="rel-type">${rel.relation}</span>
                ${escHtml(e.name)}
             </span>`
        ))
        .join('');

    const metaRows = [
        info.episodes ? `<tr><td>Episodes</td><td>${info.episodes}</td></tr>` : '',
        info.status   ? `<tr><td>Status</td><td>${info.status}</td></tr>`     : '',
        info.aired    ? `<tr><td>Aired</td><td>${info.aired}</td></tr>`       : '',
    ].join('');

    panel.innerHTML = `
        ${info.poster
            ? `<img class="anime-poster" src="${info.poster}" alt="${escHtml(info.title)}" loading="lazy">`
            : ''}

        <div class="anime-body">

            <div class="anime-title-row">
                <h2 class="anime-name">${escHtml(info.title || '—')}</h2>
                <div class="anime-badges">${scoreHtml}${rankHtml}</div>
            </div>

            ${info.titleJapanese
                ? `<p class="anime-name-jp">${escHtml(info.titleJapanese)}</p>`
                : ''}

            ${genreTags || studioTags
                ? `<div class="anime-tags">${genreTags}${studioTags}</div>`
                : ''}

            ${metaRows
                ? `<table class="anime-meta-table">${metaRows}</table>`
                : ''}

            ${synopsis
                ? `<p class="anime-synopsis">${escHtml(synopsis)}</p>`
                : ''}

            ${relHtml
                ? `<div class="anime-relations">${relHtml}</div>`
                : ''}

        </div>
    `;
}

/** Escape HTML entities to avoid XSS from torrent filenames / API data. */
function escHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}


// =====================================================
// HISTORY MODAL
// =====================================================

function closeModal() {
    document.getElementById('historyModal').style.display = 'none';
}

async function loadHistory() {
    document.getElementById('historyModal').style.display = 'flex';
    historyList.innerHTML = 'Loading…';

    try {
        const res  = await fetch('/api/history');
        const list = await res.json();

        if (!list.length) {
            historyList.innerHTML = '<p class="anime-loading">No history yet</p>';
            return;
        }

        historyList.innerHTML = '';

        list.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';

            div.innerHTML = `
                <div class="list-item-info">
                    <div class="list-item-title">${escHtml(item.title)}</div>
                </div>
                <div class="list-item-actions">
                    <button class="btn-load-item">▶ Stream</button>
                    <button class="btn-del-item">✕</button>
                </div>
            `;

            // Stream button
            div.querySelector('.btn-load-item').onclick = () => {
                magnetInput.value = item.magnetLink;
                closeModal();
                startStream(item.magnetLink);
            };

            // Delete button — identified by magnetLink, not fragile index
            div.querySelector('.btn-del-item').onclick = async e => {
                e.stopPropagation();
                await fetch('/api/history', {
                    method:  'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ magnetLink: item.magnetLink }),
                });
                div.remove();
            };

            historyList.appendChild(div);
        });

    } catch {
        historyList.innerHTML = 'Failed to load history';
    }
}

// Close modal when clicking the dark overlay
document.getElementById('historyModal').addEventListener('click', e => {
    if (e.target.id === 'historyModal') closeModal();
});


// =====================================================
// VLC  — FIX: endpoint now exists on the server
// =====================================================

vlcBtn.addEventListener('click', async () => {
    try {
        const res = await fetch('/api/open-vlc', { method: 'POST' });
        if (!res.ok) alert('Could not open VLC. Make sure VLC is installed.');
    } catch {
        alert('Error contacting server');
    }
});


// =====================================================
// STOP ON PAGE UNLOAD  (refresh / close / navigate)
// =====================================================

window.addEventListener('beforeunload', () => {
    isUnloading = true;           // prevents pause event from firing a separate request
    navigator.sendBeacon('/api/stop-stream');
});


// =====================================================
// BUTTONS
// =====================================================

startBtn.addEventListener('click', () => {
    const magnet = magnetInput.value.trim();
    if (!magnet) { alert('Paste a magnet link first'); return; }
    startStream(magnet);
});

historyBtn.addEventListener('click', loadHistory);


// =====================================================
// INIT
// =====================================================

loadTheme();