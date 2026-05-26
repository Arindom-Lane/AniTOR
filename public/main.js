// =====================================================
// DOM ELEMENTS
// =====================================================

const startBtn = document.getElementById('startBtn');
const magnetInput = document.getElementById('magnetInput');
const videoUI = document.getElementById('videoUI');
const videoTitle = document.getElementById('videoTitle');
const verifiedBadge = document.getElementById('verifiedBadge');
const vlcBtn = document.getElementById('vlcBtn');
const themeSelect = document.getElementById('themeSelect');
const statsArea = document.getElementById('statsArea');
const historyBtn = document.getElementById('historyBtn');
const historyList = document.getElementById('historyList');

let art = null;
let statsInterval = null;


// =====================================================
// THEME FUNCTIONS
// =====================================================

/*
INPUT:
  theme name string

OUTPUT:
  saves selected theme
*/
function saveTheme(theme) {
  localStorage.setItem('theme', theme);
}

/*
INPUT:
  none

OUTPUT:
  loads saved theme
*/
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
// PLAYER FUNCTIONS
// =====================================================

/*
INPUT:
  none

OUTPUT:
  destroys old player safely
*/
function destroyPlayer() {
  if (art) {
    art.destroy(true);
    art = null;
  }
}


/*
INPUT:
  none

OUTPUT:
  creates ArtPlayer instance
*/
function createPlayer() {

  destroyPlayer();

  art = new Artplayer({
    container: '#artContainer',
    url: '/api/video-stream',
    autoplay: true,
    pip: true,
    fullscreen: true,
    playbackRate: true,
    setting: true,
    aspectRatio: true
  });
}


// =====================================================
// STREAM FUNCTIONS
// =====================================================

/*
INPUT:
  magnet link

OUTPUT:
  starts streaming
*/
async function startStream(magnetLink) {

  startBtn.disabled = true;
  startBtn.innerText = 'Loading...';

  try {

    const response = await fetch('/api/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ magnetLink })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();

    videoUI.style.display = 'block';

    videoTitle.innerText = data.title;
    verifiedBadge.innerText = 'Streaming active';

    createPlayer();

    startStatsUpdater();

  } catch (error) {

    alert(error.message);

  } finally {

    startBtn.disabled = false;
    startBtn.innerText = 'Start Stream';
  }
}


// =====================================================
// STATS FUNCTIONS
// =====================================================

/*
INPUT:
  none

OUTPUT:
  updates download stats every second
*/
function startStatsUpdater() {

  statsArea.style.display = 'flex';

  clearInterval(statsInterval);

  statsInterval = setInterval(loadStats, 1000);
}


/*
INPUT:
  none

OUTPUT:
  fetches current torrent stats
*/
async function loadStats() {

  try {

    const response = await fetch('/api/stats');
    const data = await response.json();

    if (!data.active) return;

    document.getElementById('speedVal').innerText = `${data.downloadSpeed} MB/s`;
    document.getElementById('peersVal').innerText = data.peers;
    document.getElementById('progressVal').innerText = `${data.progress}%`;

  } catch {}
}


// =====================================================
// HISTORY FUNCTIONS
// =====================================================

/*
INPUT:
  none

OUTPUT:
  opens history modal
*/
async function loadHistory() {

  document.getElementById('historyModal').style.display = 'flex';

  historyList.innerHTML = 'Loading history...';

  try {

    const response = await fetch('/api/history');
    const list = await response.json();

    if (list.length === 0) {
      historyList.innerHTML = 'No history found';
      return;
    }

    historyList.innerHTML = '';

    list.forEach(item => {

      const div = document.createElement('div');

      div.className = 'list-item';

      div.innerHTML = `
        <div class="list-item-info">
          <div class="list-item-title">${item.title}</div>
          <div class="list-item-meta">${item.progress}% downloaded</div>
        </div>

        <button class="btn-load-item">Stream</button>
      `;

      div.querySelector('button').onclick = () => {
        closeModal();
        magnetInput.value = item.magnetLink;
        startStream(item.magnetLink);
      };

      historyList.appendChild(div);
    });

  } catch {

    historyList.innerHTML = 'Failed to load history';
  }
}


// =====================================================
// VLC BUTTON
// =====================================================

vlcBtn.addEventListener('click', async () => {

  try {
    await fetch('/api/open-vlc', {
      method: 'POST'
    });
  } catch (error) {
    console.error(error);
  }
});


// =====================================================
// BUTTON EVENTS
// =====================================================

startBtn.addEventListener('click', () => {

  const magnet = magnetInput.value.trim();

  if (!magnet) {
    return alert('Paste magnet link');
  }

  startStream(magnet);
});

historyBtn.addEventListener('click', loadHistory);


// =====================================================
// INITIAL LOAD
// =====================================================

loadTheme();