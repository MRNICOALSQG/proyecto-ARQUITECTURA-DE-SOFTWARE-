/* ==========================================================
   Rin'ne — Dashboard Preview (Functional Prototype)
   ========================================================== */

// ---- MOCK DATA ----

const DEFAULT_SONGS = [
  { id: 's1', title: 'Neon Lights', artist: 'Aetheric', album: 'Digital Dreams', duration: 214, cover: null, mime: 'audio/mpeg' },
  { id: 's2', title: 'Midnight Run', artist: 'Crystal Waves', album: 'Night Drive', duration: 187, cover: null, mime: 'audio/mpeg' },
  { id: 's3', title: 'Electric Sky', artist: 'Synthwave', album: 'Retro Future', duration: 245, cover: null, mime: 'audio/mpeg' },
  { id: 's4', title: 'Deep Blue', artist: 'Oceanic', album: 'Abyss', duration: 198, cover: null, mime: 'audio/mpeg' },
  { id: 's5', title: 'Stardust', artist: 'Cosmic', album: 'Galaxy', duration: 267, cover: null, mime: 'audio/mpeg' },
  { id: 's6', title: 'Shadow Dance', artist: 'Nocturnal', album: 'Darkness', duration: 203, cover: null, mime: 'audio/mpeg' },
  { id: 's7', title: 'Crystal Rain', artist: 'Aetheric', album: 'Digital Dreams', duration: 231, cover: null, mime: 'audio/mpeg' },
  { id: 's8', title: 'Velocity', artist: 'Turbo', album: 'Fast Lane', duration: 176, cover: null, mime: 'audio/mpeg' },
  { id: 's9', title: 'Lunar Eclipse', artist: 'Cosmic', album: 'Galaxy', duration: 289, cover: null, mime: 'audio/mpeg' },
  { id: 's10', title: 'Pulse', artist: 'Synthwave', album: 'Retro Future', duration: 158, cover: null, mime: 'audio/mpeg' },
  { id: 's11', title: 'Echoes', artist: 'Nocturnal', album: 'Darkness', duration: 222, cover: null, mime: 'audio/mpeg' },
  { id: 's12', title: 'Aurora', artist: 'Aetheric', album: 'Digital Dreams', duration: 195, cover: null, mime: 'audio/mpeg' },
];

const DEFAULT_PLAYLISTS = [
  { id: 'p1', name: 'Chill Vibes', songCount: 4, cover: null },
  { id: 'p2', name: 'Workout', songCount: 3, cover: null },
  { id: 'p3', name: 'Late Night', songCount: 2, cover: null },
];

// ---- STATE ----

let songs = JSON.parse(localStorage.getItem('rinne_songs')) || [...DEFAULT_SONGS];
let playlists = JSON.parse(localStorage.getItem('rinne_playlists')) || [...DEFAULT_PLAYLISTS.map(p => ({ ...p, songs: [] }))];
let favorites = JSON.parse(localStorage.getItem('rinne_favorites')) || ['s1', 's4', 's7'];
let currentTab = 'library';
let currentSongIndex = -1;
let isPlaying = false;
let progressInterval = null;
let currentTime = 0;

// Audio context for generating tones
let audioCtx = null;
let gainNode = null;
let oscillatorNode = null;

// Particles
let particleMode = localStorage.getItem('rinne_particles') || 'snow';
let particleSpeed = parseFloat(localStorage.getItem('rinne_particleSpeed')) || 1;
let particleAnimId = null;

// HUD
let hudColor = localStorage.getItem('rinne_hudColor') || '#00dbe9';
let hudOpacity = parseFloat(localStorage.getItem('rinne_hudOpacity')) || 0.8;
let bgType = localStorage.getItem('rinne_bgType') || 'solid';
let bgValue = localStorage.getItem('rinne_bgValue') || '#131315';

// Refs for uploads
let pendingUploadFiles = [];

// ---- PERSISTENCE HELPERS ----
function saveSongs() { localStorage.setItem('rinne_songs', JSON.stringify(songs)); }
function savePlaylists() { localStorage.setItem('rinne_playlists', JSON.stringify(playlists.map(p => ({ id: p.id, name: p.name, songCount: p.songs.length, cover: p.cover })))); }
function saveFavorites() { localStorage.setItem('rinne_favorites', JSON.stringify(favorites)); }
function savePreferences() {
  localStorage.setItem('rinne_hudColor', hudColor);
  localStorage.setItem('rinne_hudOpacity', hudOpacity.toString());
  localStorage.setItem('rinne_bgType', bgType);
  localStorage.setItem('rinne_bgValue', bgValue);
}

// ---- TOAST ----
let toastTimeout = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('toast-show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('toast-show'), 2200);
}

// ---- FORMAT TIME ----
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---- SWITCH TAB ----
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + tab).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`.nav-btn[data-tab="${tab}"]`).forEach(b => b.classList.add('active'));
  if (tab === 'favorites') renderFavorites();
}

// ---- RENDER SONGS ----
function renderSongs(filter = '') {
  const grid = document.getElementById('songs-grid');
  const noSongs = document.getElementById('no-songs');
  const filtered = songs.filter(s =>
    s.title.toLowerCase().includes(filter.toLowerCase()) ||
    s.artist.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    grid.innerHTML = '';
    noSongs.classList.remove('hidden');
    return;
  }
  noSongs.classList.add('hidden');

  grid.innerHTML = filtered.map((s, i) => {
    const realIndex = songs.indexOf(s);
    const isFav = favorites.includes(s.id);
    const isCurrent = currentSongIndex === realIndex;
    const colors = ['from-[#00dbe9]/20 to-[#e9b3ff]/20', 'from-[#e9b3ff]/20 to-[#ff6b8a]/20', 'from-[#ffcc00]/20 to-[#00ff88]/20', 'from-[#00ff88]/20 to-[#00dbe9]/20', 'from-[#ff6b8a]/20 to-[#00dbe9]/20', 'from-[#00dbe9]/20 to-[#ffcc00]/20'];
    const grad = colors[i % colors.length];
    return `
      <div class="song-card ${isCurrent ? 'playing' : ''}" onclick="playSong(${realIndex})" data-id="${s.id}">
        <div class="relative aspect-square bg-white/5 ${grad} flex items-center justify-center overflow-hidden">
          <span class="text-3xl font-black text-white/10 select-none">${s.title[0]}</span>
          <div class="play-overlay absolute inset-0 bg-black/30 flex items-center justify-center">
            <div class="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <svg class="w-5 h-5 ml-0.5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </div>
        <div class="p-3">
          <p class="text-sm font-medium text-white/90 truncate">${s.title}</p>
          <p class="text-xs text-white/40 truncate mt-0.5">${s.artist}</p>
          <div class="flex items-center justify-between mt-2">
            <span class="chip">${formatTime(s.duration)}</span>
            <button onclick="event.stopPropagation();toggleFav('${s.id}')" class="text-white/20 hover:text-[#ff6b8a] transition-colors ${isFav ? 'text-[#ff6b8a]' : ''}">
              <svg class="w-4 h-4" fill="${isFav ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ---- RENDER PLAYLISTS ----
function renderPlaylists() {
  const grid = document.getElementById('playlists-grid');
  const colors = ['from-[#00dbe9]/20 to-[#00dbe9]/5', 'from-[#e9b3ff]/20 to-[#e9b3ff]/5', 'from-[#ff6b8a]/20 to-[#ff6b8a]/5', 'from-[#00ff88]/20 to-[#00ff88]/5', 'from-[#ffcc00]/20 to-[#ffcc00]/5'];

  grid.innerHTML = playlists.map((p, i) => `
    <div class="playlist-card" onclick="openPlaylistDetail('${p.id}')">
      <div class="aspect-square bg-white/5 ${colors[i % colors.length]} flex items-center justify-center">
        <svg class="w-12 h-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/></svg>
      </div>
      <div class="p-3">
        <p class="text-sm font-medium text-white/90 truncate">${p.name}</p>
        <p class="text-xs text-white/40 mt-0.5">${p.songs.length} songs</p>
      </div>
    </div>
  `).join('');
}

// ---- RENDER FAVORITES ----
function renderFavorites() {
  const list = document.getElementById('favorites-list');
  const noFav = document.getElementById('no-favorites');
  const favSongs = songs.filter(s => favorites.includes(s.id));

  if (favSongs.length === 0) {
    list.innerHTML = '';
    noFav.classList.remove('hidden');
    return;
  }
  noFav.classList.add('hidden');

  list.innerHTML = favSongs.map((s, i) => {
    const realIndex = songs.indexOf(s);
    return `
      <div class="fav-row" onclick="playSong(${realIndex})">
        <div class="w-10 h-10 rounded-lg bg-white/5 bg-gradient-to-br from-[#ff6b8a]/20 to-[#ff6b8a]/5 flex items-center justify-center text-white/30 shrink-0">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"/></svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white/90 truncate">${s.title}</p>
          <p class="text-xs text-white/40 truncate">${s.artist} · ${s.album}</p>
        </div>
        <span class="chip shrink-0">${formatTime(s.duration)}</span>
        <button onclick="event.stopPropagation();toggleFav('${s.id}')" class="text-[#ff6b8a] hover:scale-110 transition-transform shrink-0">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
        </button>
      </div>
    `;
  }).join('');
}

// ---- SEARCH ----
function filterSongs(query) {
  renderSongs(query);
}

// ---- PLAY SONG ----
function playSong(index) {
  if (index < 0 || index >= songs.length) return;

  // Remove playing class from all cards
  document.querySelectorAll('.song-card.playing').forEach(c => c.classList.remove('playing'));

  currentSongIndex = index;

  // Add playing class to current card
  const cards = document.querySelectorAll('.song-card');
  if (cards[index]) cards[index].classList.add('playing');

  const song = songs[index];

  // Update player UI
  document.getElementById('player-title').textContent = song.title;
  document.getElementById('player-artist').textContent = `${song.artist} · ${song.album}`;
  document.getElementById('total-time').textContent = formatTime(song.duration);

  // Update cover with first letter
  const cover = document.getElementById('player-cover');
  cover.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-[${hudColor}]/20 to-[#e9b3ff]/20 flex items-center justify-center text-white/40 text-lg font-black">${song.title[0]}</div>`;

  // Update fav button in player
  updatePlayerFavBtn();

  // Reset progress
  currentTime = 0;
  document.getElementById('current-time').textContent = '0:00';
  document.getElementById('progress-fill').style.width = '0%';

  // Start playback simulation
  startPlayback();
}

function startPlayback() {
  if (!isPlaying) {
    isPlaying = true;
    updatePlayPauseIcons();
    startProgressSimulation();
  }
}

function togglePlay() {
  if (currentSongIndex === -1 && songs.length > 0) {
    playSong(0);
    return;
  }
  if (currentSongIndex === -1) return;

  isPlaying = !isPlaying;
  updatePlayPauseIcons();

  if (isPlaying) {
    startProgressSimulation();
  } else {
    stopProgressSimulation();
  }
}

function updatePlayPauseIcons() {
  document.getElementById('play-icon').classList.toggle('hidden', isPlaying);
  document.getElementById('pause-icon').classList.toggle('hidden', !isPlaying);
}

// ---- PROGRESS SIMULATION ----
function startProgressSimulation() {
  stopProgressSimulation();
  const song = songs[currentSongIndex];
  if (!song) return;

  const interval = 100; // ms
  const step = 0.1; // seconds per tick

  progressInterval = setInterval(() => {
    if (!isPlaying) return;

    currentTime += step;
    if (currentTime >= song.duration) {
      currentTime = song.duration;
      document.getElementById('progress-fill').style.width = '100%';
      document.getElementById('current-time').textContent = formatTime(currentTime);
      nextSong();
      return;
    }

    const pct = (currentTime / song.duration) * 100;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('current-time').textContent = formatTime(currentTime);
  }, interval);
}

function stopProgressSimulation() {
  clearInterval(progressInterval);
  progressInterval = null;
}

// ---- NEXT / PREV ----
function nextSong() {
  if (songs.length === 0) return;
  const next = (currentSongIndex + 1) % songs.length;
  playSong(next);
}

function prevSong() {
  if (songs.length === 0) return;
  // If more than 3 seconds in, restart current song
  if (currentTime > 3) {
    currentTime = 0;
    document.getElementById('current-time').textContent = '0:00';
    document.getElementById('progress-fill').style.width = '0%';
    return;
  }
  const prev = (currentSongIndex - 1 + songs.length) % songs.length;
  playSong(prev);
}

// ---- SEEK ----
function seekPlayer(e) {
  if (currentSongIndex === -1) return;
  const bar = e.currentTarget;
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const song = songs[currentSongIndex];
  currentTime = pct * song.duration;
  document.getElementById('progress-fill').style.width = (pct * 100) + '%';
  document.getElementById('current-time').textContent = formatTime(currentTime);
}

// ---- VOLUME ----
function setVolume(val) {
  if (gainNode) {
    gainNode.gain.value = parseFloat(val);
  }
}

// ---- FAVORITES ----
function toggleFav(songId) {
  const idx = favorites.indexOf(songId);
  if (idx > -1) {
    favorites.splice(idx, 1);
  } else {
    favorites.push(songId);
  }
  saveFavorites();

  // Re-render current view
  if (currentTab === 'favorites') renderFavorites();
  renderSongs(document.getElementById('search-input').value);
  updatePlayerFavBtn();
  showToast(favorites.includes(songId) ? 'Added to favorites' : 'Removed from favorites');
}

function toggleFavoriteFromPlayer() {
  if (currentSongIndex === -1) return;
  toggleFav(songs[currentSongIndex].id);
}

function updatePlayerFavBtn() {
  const btn = document.getElementById('player-fav-btn');
  if (!btn) return;
  if (currentSongIndex === -1) {
    btn.classList.add('text-white/30');
    btn.classList.remove('text-[#ff6b8a]');
    return;
  }
  const isFav = favorites.includes(songs[currentSongIndex].id);
  btn.classList.toggle('text-[#ff6b8a]', isFav);
  btn.classList.toggle('text-white/30', !isFav);
}

// ---- UPLOAD ----
function openUploadModal() {
  pendingUploadFiles = [];
  document.getElementById('upload-preview').innerHTML = '';
  document.getElementById('upload-modal').classList.remove('hidden');
}

function closeUploadModal() {
  document.getElementById('upload-modal').classList.add('hidden');
}

function handleUploadFiles(files) {
  pendingUploadFiles = Array.from(files);
  const preview = document.getElementById('upload-preview');
  preview.innerHTML = pendingUploadFiles.map(f =>
    `<div class="flex items-center gap-2 text-xs text-white/60 py-1"><span class="w-4 h-4 rounded bg-white/10 flex items-center justify-center text-[9px] text-white/40">♪</span>${f.name}</div>`
  ).join('');
}

function confirmUpload() {
  if (pendingUploadFiles.length === 0) {
    showToast('Select files to upload');
    return;
  }
  const artist = document.getElementById('upload-artist').value || 'Unknown Artist';
  const album = document.getElementById('upload-album').value || 'Unknown Album';

  pendingUploadFiles.forEach(f => {
    const name = f.name.replace(/\.[^/.]+$/, '');
    songs.push({
      id: 's' + Date.now() + Math.random().toString(36).slice(2, 6),
      title: name,
      artist: artist,
      album: album,
      duration: Math.floor(Math.random() * 120 + 120),
      cover: null,
      mime: f.type || 'audio/mpeg',
    });
  });

  saveSongs();
  renderSongs(document.getElementById('search-input').value);
  closeUploadModal();
  showToast(`${pendingUploadFiles.length} song(s) uploaded`);
  pendingUploadFiles = [];
}

// ---- PLAYLISTS ----
function openCreatePlaylistModal() {
  document.getElementById('playlist-name-input').value = '';
  document.getElementById('create-playlist-modal').classList.remove('hidden');
}

function closeCreatePlaylistModal() {
  document.getElementById('create-playlist-modal').classList.add('hidden');
}

function confirmCreatePlaylist() {
  const name = document.getElementById('playlist-name-input').value.trim();
  if (!name) { showToast('Enter a playlist name'); return; }
  playlists.push({ id: 'p' + Date.now(), name, songs: [], cover: null });
  savePlaylists();
  renderPlaylists();
  closeCreatePlaylistModal();
  showToast(`Playlist "${name}" created`);
}

function openPlaylistDetail(playlistId) {
  // For the preview, show a toast with the playlist songs
  const pl = playlists.find(p => p.id === playlistId);
  if (!pl) return;
  const count = pl.songs.length;
  showToast(`"${pl.name}" — ${count} songs (manage in full app)`);
}

// ---- PREFERENCES ----
function togglePreferences() {
  const panel = document.getElementById('preferences-panel');
  panel.classList.toggle('translate-x-full');
}

function updateHUDColor(color) {
  hudColor = color;
  document.getElementById('hud-color-input').value = color;
  document.getElementById('hud-color-value').textContent = color;
  document.documentElement.style.setProperty('--hud-color', color);
  document.querySelectorAll('.nav-btn.active').forEach(b => {
    b.style.color = color;
    b.style.background = `${color}15`;
    b.style.boxShadow = `inset 0 0 0 1px ${color}30`;
  });
  // Update sidebar logo glow
  document.querySelectorAll('.font-display.text-xl').forEach(el => {
    el.style.textShadow = `0 0 10px ${color}50`;
  });
  savePreferences();
}

function setBgType(type) {
  bgType = type;
  document.getElementById('bg-solid-btn').className = type === 'solid'
    ? 'flex-1 py-2 rounded-lg bg-[#00dbe9]/10 text-[#00dbe9] text-xs font-semibold border border-[#00dbe9]/30'
    : 'flex-1 py-2 rounded-lg bg-white/5 text-white/50 text-xs font-semibold border border-white/10';
  document.getElementById('bg-image-btn').className = type === 'image'
    ? 'flex-1 py-2 rounded-lg bg-[#00dbe9]/10 text-[#00dbe9] text-xs font-semibold border border-[#00dbe9]/30'
    : 'flex-1 py-2 rounded-lg bg-white/5 text-white/50 text-xs font-semibold border border-white/10';
  document.getElementById('bg-solid-control').classList.toggle('hidden', type !== 'solid');
  document.getElementById('bg-image-control').classList.toggle('hidden', type !== 'image');
  applyBg();
  savePreferences();
}

function updateBgColor(color) {
  bgValue = color;
  applyBg();
  savePreferences();
}

function updateBgImage(url) {
  bgValue = url;
  applyBg();
  savePreferences();
}

function applyBg() {
  const app = document.getElementById('app');
  if (bgType === 'solid') {
    app.style.background = bgValue;
    app.style.backgroundImage = 'none';
  } else if (bgType === 'image' && bgValue) {
    app.style.background = 'none';
    app.style.backgroundImage = `url("${bgValue}")`;
    app.style.backgroundSize = 'cover';
    app.style.backgroundPosition = 'center';
  }
}

function updateHudOpacity(val) {
  hudOpacity = parseFloat(val);
  document.getElementById('hud-opacity-value').textContent = hudOpacity.toFixed(2);
  savePreferences();
}

function setParticles(type) {
  particleMode = type;
  document.querySelectorAll('.particle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === type);
  });
  localStorage.setItem('rinne_particles', type);
  initParticles();
}

function updateParticlesSpeed(val) {
  particleSpeed = parseFloat(val);
  document.getElementById('particles-speed-value').textContent = particleSpeed.toFixed(1);
  localStorage.setItem('rinne_particleSpeed', val);
  initParticles();
}

// ---- PARTICLES (Canvas) ----
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas.getContext('2d');
  cancelAnimationFrame(particleAnimId);

  if (particleMode === 'none') {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = [];
  const count = particleMode === 'snow' ? 80 : particleMode === 'lines' ? 50 : 60;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: particleMode === 'snow' ? Math.random() * 3 + 1 : Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.5 * particleSpeed * 2,
      dy: particleMode === 'snow' ? (Math.random() * 1 + 0.3) * particleSpeed * 2 : (Math.random() - 0.5) * 0.5 * particleSpeed * 2,
      alpha: Math.random() * 0.5 + 0.2,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.dx;
      p.y += p.dy;

      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
      ctx.fill();
    });

    if (particleMode === 'lines') {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    particleAnimId = requestAnimationFrame(draw);
  }

  draw();
}

// ---- MODALS ----
function openProfileModal() {
  document.getElementById('profile-modal').classList.remove('hidden');
}
function closeProfileModal() {
  document.getElementById('profile-modal').classList.add('hidden');
}

// ---- MOBILE SIDEBAR ----
function openMobileSidebar() {
  document.getElementById('mobile-sidebar').classList.remove('-translate-x-full');
  document.getElementById('mobile-overlay').classList.remove('hidden');
}
function closeMobileSidebar() {
  document.getElementById('mobile-sidebar').classList.add('-translate-x-full');
  document.getElementById('mobile-overlay').classList.add('hidden');
}

// ---- INIT ----
function init() {
  // Apply HUD color
  updateHUDColor(hudColor);

  // Apply background
  if (bgType === 'solid') {
    document.getElementById('bg-solid-btn').className = 'flex-1 py-2 rounded-lg bg-[#00dbe9]/10 text-[#00dbe9] text-xs font-semibold border border-[#00dbe9]/30';
    document.getElementById('bg-color-input').value = bgValue;
  } else {
    document.getElementById('bg-image-btn').className = 'flex-1 py-2 rounded-lg bg-[#00dbe9]/10 text-[#00dbe9] text-xs font-semibold border border-[#00dbe9]/30';
    document.getElementById('bg-solid-control').classList.add('hidden');
    document.getElementById('bg-image-control').classList.remove('hidden');
  }
  applyBg();

  // HUD opacity
  document.querySelectorAll('.opacity-slider').forEach(s => s.value = hudOpacity);
  document.getElementById('hud-opacity-value').textContent = hudOpacity.toFixed(2);

  // Particles init
  document.querySelectorAll('.particle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === particleMode);
  });
  document.querySelectorAll('.opacity-slider').forEach(s => {
    if (s.id.includes('speed')) s.value = particleSpeed;
  });
  document.getElementById('particles-speed-value').textContent = particleSpeed.toFixed(1);
  initParticles();

  // Render initial data
  renderSongs();
  renderPlaylists();
  renderFavorites();

  // Default to library view
  switchTab('library');

  // Set default player state
  if (songs.length > 0) {
    document.getElementById('player-title').textContent = 'Select a song';
    document.getElementById('player-artist').textContent = `${songs.length} songs in library`;
  }

  console.log('🎵 Rin\'ne Dashboard Preview initialized');
  console.log(`📀 ${songs.length} songs, ${playlists.length} playlists, ${favorites.length} favorites`);
}

document.addEventListener('DOMContentLoaded', init);
