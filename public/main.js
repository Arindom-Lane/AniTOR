const startBtn = document.getElementById('startBtn');
const magnetInput = document.getElementById('magnetInput');
const videoUI = document.getElementById('videoUI');
const videoTitle = document.getElementById('videoTitle');
const verifiedBadge = document.getElementById('verifiedBadge');
const statsArea = document.getElementById('statsArea');
const themeSelect = document.getElementById('themeSelect');
const vlcBtn = document.getElementById('vlcBtn');

const historyMenuBtn = document.getElementById('historyMenuBtn');
const localMenuBtn = document.getElementById('localMenuBtn');
const historyModal = document.getElementById('historyModal');
const localModal = document.getElementById('localModal');
const historyListContainer = document.getElementById('historyListContainer');
const localListContainer = document.getElementById('localListContainer');

let statsInterval = null;
let artInstance = null;
let idleTimer = null;
const IDLE_TIMEOUT_MS = 6000;

function resetIdleTimer() {
  document.body.classList.remove('cinematic-dim');
  clearTimeout(idleTimer);
  if (artInstance && artInstance.playing) {
    idleTimer = setTimeout(() => { document.body.classList.add('cinematic-dim'); }, IDLE_TIMEOUT_MS);
  }
}

['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach(evName => {
  window.addEventListener(evName, resetIdleTimer, { passive: true });
});



function setCookie(name, value, days = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Expires=${expires}; Path=/; SameSite=Lax`;
}

function getCookie(name) {
  const cookies = document.cookie.split('; ');
  for (const c of cookies) {
    const [k, v] = c.split('=');
    if (decodeURIComponent(k) === name) return decodeURIComponent(v || '');
  }
  return null;
}


function deleteCookie(name) {
  document.cookie = `${encodeURIComponent(name)}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`;
}

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = getCookie('selectedTheme') ;
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeSelect.value = savedTheme;
    themeSelect.innerHTML=`
      <option value="dark" ${savedTheme === 'dark' ? 'selected' : ''}>Dark Theme</option>
      <option value="cyan" ${savedTheme === 'cyan' ? 'selected' : ''}>Dark Cyan</option>
      <option value="light" ${savedTheme === 'light' ? 'selected' : ''}>Off-White</option>
      <option value="atom-material" ${savedTheme === 'atom-material' ? 'selected' : ''}>Atom Material</option>
      <option value="default" ${savedTheme === 'default' ? 'selected' : ''}>Default</option>
      <option value="github-dark" ${savedTheme === 'github-dark' ? 'selected' : ''}>GitHub Dark</option>
      <option value="hopscotch" ${savedTheme === 'hopscotch' ? 'selected' : ''}>Hopscotch</option>
      <option value="monokai" ${savedTheme === 'monokai' ? 'selected' : ''}>Monokai</option>
      <option value="okaidia" ${savedTheme === 'okaidia' ? 'selected' : ''}>Okaidia</option>
      <option value="one-dark" ${savedTheme === 'one-dark' ? 'selected' : ''}>One Dark</option>
      <option value="pojoaque" ${savedTheme === 'pojoaque' ? 'selected' : ''}>Pojoaque</option>
      <option value="solarized-dark" ${savedTheme === 'solarized-dark' ? 'selected' : ''}>Solarized Dark</option>
      <option value="twilight" ${savedTheme === 'twilight' ? 'selected' : ''}>Twilight</option>
      <option value="xonokai" ${savedTheme === 'xonokai' ? 'selected' : ''}>Xonokai</option>
    `;
  }});

  themeSelect.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
    setCookie('selectedTheme', e.target.value, 30);
  });


async function verifyAnimeTitleOnline(rawFileName) {
  try {
    let cleanStr = rawFileName.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();
    cleanStr = cleanStr.replace(/\s+-\s+\d+.*/, '').replace(/\.(mkv|mp4|webm)$/i, '').trim();
    if (!cleanStr) return rawFileName;

    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanStr)}&limit=1`);
    if (!res.ok) return cleanStr;
    const json = await res.json();
    if (json.data && json.data.length > 0) return json.data[0].title;
    return cleanStr;
  } catch (err) {
    return rawFileName;
  }
}

async function runStreamPipeline(targetLink, options = {}) {
  startBtn.innerText = "Analyzing Tracking Swarm...";
  startBtn.disabled = true;

  try {
    const response = await fetch('/api/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ magnetLink: targetLink })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Server failure handling tracking hash payload.');
    }

    const data = await response.json();

    videoUI.style.display = 'block';
    videoTitle.innerText = data.title;
    verifiedBadge.innerText = "🔍 Syncing with global media indexes...";

    const checkedTitle = await verifyAnimeTitleOnline(data.title);
    verifiedBadge.innerText = `✅ Verified Title Match: "${checkedTitle}"`;

    vlcBtn.onclick = async () => {
      try { 
        // 1. Tell the Artplayer instance to pause the web video
        if (artInstance && artInstance.playing) {
          artInstance.pause();
        }
        
        // 2. Fire the signal to the backend to launch VLC
        await fetch('/api/open-vlc', { method: 'POST' }); 
      } catch (e) {
        console.error("Failed to launch VLC:", e);
      }
    };

    if (artInstance) artInstance.destroy(false);

    artInstance = new Artplayer({
      container: '#artContainer',
      url: data.streamUrl,
      autoplay: options.startPaused ? false : true,
      pip: true,
      fullscreen: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true
    });

    if (options.startPaused) {
      artInstance.on('ready', () => { artInstance.pause(); });
    }

    artInstance.on('video:play', resetIdleTimer);
    artInstance.on('video:pause', () => {
      clearTimeout(idleTimer);
      document.body.classList.remove('cinematic-dim');
    });

    statsArea.style.display = 'flex';
    if (statsInterval) clearInterval(statsInterval);
    statsInterval = setInterval(fetchTelemetryData, 1000);

    startBtn.innerText = "Initialize Stream";
    startBtn.disabled = false;

  } catch (err) {
    alert(err.message || 'Error occurred initializing stream data engine.');
    startBtn.innerText = "Initialize Stream";
    startBtn.disabled = false;
  }
}

startBtn.addEventListener('click', () => {
  const link = magnetInput.value.trim();
  if (link) runStreamPipeline(link);
});

async function fetchTelemetryData() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const data = await res.json();
    
    if (data.active) {
      document.getElementById('progressVal').innerText = `${data.progress}%`;
      document.getElementById('peersVal').innerText = data.peers;
      document.getElementById('speedVal').innerText = `${data.downloadSpeed} MB/s`;
      document.getElementById('speedVal').style.color = "var(--accent)";
    }
  } catch (e) {}
}

historyMenuBtn.addEventListener('click', async () => {
  historyModal.style.display = 'flex';
  historyListContainer.innerHTML = '<div>Reading session logs...</div>';
  
  try {
    const res = await fetch('/api/history');
    const list = await res.json();
    
    if (list.length === 0) {
      historyListContainer.innerHTML = '<div style="opacity:0.5;text-align:center;">No history records found.</div>';
      return;
    }

    historyListContainer.innerHTML = '';
    list.forEach(item => {
      const el = document.createElement('div');
      el.className = 'list-item';
      el.innerHTML = `
        <div class="list-item-info">
          <div class="list-item-title" title="${item.title}">${item.title}</div>
          <div class="list-item-meta">Hash block: ${item.infoHash.substring(0,12)}...</div>
        </div>
        <button class="btn-play" style="padding:6px 12px; font-size:0.8rem;">Stream</button>
      `;
      el.querySelector('.btn-play').onclick = () => {
        historyModal.style.display = 'none';
        magnetInput.value = item.magnetLink;
        runStreamPipeline(item.magnetLink); 
      };
      historyListContainer.appendChild(el);
    });
  } catch (e) {
    historyListContainer.innerHTML = '<div>Failed parsing historical log registers.</div>';
  }
});

localMenuBtn.addEventListener('click', loadLocalCacheMenu);

async function loadLocalCacheMenu() {
  localModal.style.display = 'flex';
  localListContainer.innerHTML = '<div>Querying storage charts...</div>';
  
  try {
    const res = await fetch('/api/cached-files');
    const list = await res.json();
    
    if (list.length === 0) {
      localListContainer.innerHTML = '<div style="opacity:0.5;text-align:center;">No records available inside disk indices.</div>';
      return;
    }

    localListContainer.innerHTML = '';
    list.forEach(item => {
      const el = document.createElement('div');
      el.className = 'list-item';
      
      const completedState = (parseFloat(item.progress) >= 100.0);
      const metricColor = completedState ? 'color:#00ff88;' : 'color:var(--accent);';
      
      el.innerHTML = `
        <div class="list-item-info">
          <div class="list-item-title" title="${item.title}">${item.title}</div>
          <div class="list-item-meta">Storage allocation: <strong style="${metricColor}">${item.progress}%</strong></div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-load-item" style="padding:6px 12px; font-size:0.8rem;">Run</button>
          <button class="btn-del-item" style="padding:6px 12px; font-size:0.8rem; background:#ff3333;">Delete</button>
        </div>
      `;

      el.querySelector('.btn-load-item').onclick = async () => {
        localModal.style.display = 'none';
        
        if (completedState) {
          await fetch('/api/open-vlc-local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ infoHash: item.infoHash })
          });
        } else {
          magnetInput.value = item.magnetLink;
          
          await runStreamPipeline(item.magnetLink, { startPaused: true });
          
          await fetch('/api/open-vlc', { method: 'POST' });
          
          await fetch('/api/force-full-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ infoHash: item.infoHash })
          });
        }
      };

      el.querySelector('.btn-del-item').onclick = async () => {
        if (confirm(`Confirm physical disk deletion of item cache directory:\n"${item.title}"?`)) {
          await fetch('/api/delete-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ infoHash: item.infoHash })
          });
          loadLocalCacheMenu();
        }
      };

      localListContainer.appendChild(el);
    });
  } catch (e) {
    localListContainer.innerHTML = '<div>System failure listing local filesystem indices.</div>';
  }
}