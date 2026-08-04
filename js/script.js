// ===============================
// ACCESS CODE SYSTEM
// ===============================
let accessLevel = null;

function showAccessCodePopup() {
  const overlay = document.createElement('div');
  overlay.id = 'accessCodeOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(100,100,200,0.95);display:flex;align-items:center;justify-content:center;z-index:10000;';
  
  const popup = document.createElement('div');
  popup.style.cssText = 'background:white;padding:30px;border-radius:12px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.3);max-width:350px;width:90%;';
  
  popup.innerHTML = `
    <h2 style="margin:0 0 20px 0;color:#333;font-size:20px;">Masukan Kode Akses</h2>
    <input type="text" id="accessCodeInput" placeholder="Kode Akses = BTU999" style="width:100%;padding:12px;font-size:16px;border:2px solid #ddd;border-radius:8px;box-sizing:border-box;margin-bottom:15px;text-align:center;">
    <p id="accessCodeError" style="color:#c62828;font-size:14px;margin:0 0 15px 0;display:none;">Kode akses tidak valid!</p>
    <button id="accessCodeSubmit" style="width:100%;padding:12px;background:#4CAF50;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;">Masuk</button>
  `;
  
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  
  const input = document.getElementById('accessCodeInput');
  const submitBtn = document.getElementById('accessCodeSubmit');
  const errorMsg = document.getElementById('accessCodeError');
  
  function validateCode() {
    const code = input.value.trim().toUpperCase();
    if (code === 'E000') {
      accessLevel = 'admin';
      sessionStorage.setItem('access_level', 'admin'); // Simpan level akses admin
      sessionStorage.setItem('imb_access', 'e000'); // Simpan akses untuk IMB
      overlay.remove();
      applyAccessRestrictions();
      
      // Wait a little and try to show admin button (in case admin.js is loaded)
      setTimeout(() => {
        if (typeof showAdminButton === 'function') {
          showAdminButton();
        }
      }, 100);
      
      // Otomatisasi status setelah 2 detik
      setTimeout(() => {
        if (typeof fetchKavlingStatus === 'function') {
          fetchKavlingStatus();
        }
      }, 2000);
    } else if (code === 'F888') {
      accessLevel = 'full';
      sessionStorage.setItem('access_level', 'full'); // Simpan level akses
      sessionStorage.setItem('imb_access', 'f888'); // Simpan akses untuk IMB
      overlay.remove();
      applyAccessRestrictions();
      
      // Otomatisasi status setelah 2 detik
      setTimeout(() => {
        if (typeof fetchKavlingStatus === 'function') {
          fetchKavlingStatus();
        }
      }, 2000);
    } else if (code === 'BTU999') {
      accessLevel = 'limited';
      sessionStorage.setItem('access_level', 'limited'); // Simpan level akses
      sessionStorage.setItem('imb_access', 'btu999'); // Simpan akses untuk IMB (BTU999)
      overlay.remove();
      applyAccessRestrictions();

      // Otomatisasi status setelah 2 detik
      setTimeout(() => {
        if (typeof fetchKavlingStatus === 'function') {
          fetchKavlingStatus();
        }
      }, 2000);
    } else {
      errorMsg.style.display = 'block';
      input.style.borderColor = '#c62828';
    }
  }
  
  submitBtn.addEventListener('click', validateCode);
  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') validateCode();
  });
  input.addEventListener('input', function() {
    errorMsg.style.display = 'none';
    input.style.borderColor = '#ddd';
  });
  
  input.focus();
}

function applyAccessRestrictions() {
  if (accessLevel === 'limited') {
    const certBtn = document.getElementById('searchByCertificate');
    if (certBtn) certBtn.style.display = 'none';
    
    // Sembunyikan tombol SITE MAP SERTIFIKAT jika akses terbatas (btu999)
    const certMapBtn = document.getElementById('openCertMap');
    if (certMapBtn) certMapBtn.style.display = 'none';

    // Tampilkan tombol SITEMAP BTU KNC REPORT untuk BTU999
    const reportMapBtn = document.getElementById('openReportMap');
    if (reportMapBtn) reportMapBtn.style.display = 'block';

    // Tombol IMB tetap terlihat untuk BTU999
    const imbBtn = document.getElementById('checkImbStatus');
    if (imbBtn) imbBtn.style.display = 'block';
  } else if (accessLevel === 'full' || accessLevel === 'admin') {
    // Pastikan semua tombol terlihat jika akses penuh (f888) atau admin (E000)
    const certBtn = document.getElementById('searchByCertificate');
    if (certBtn) certBtn.style.display = 'block';
    
    const imbBtn = document.getElementById('checkImbStatus');
    if (imbBtn) imbBtn.style.display = 'block';

    const certMapBtn = document.getElementById('openCertMap');
    if (certMapBtn) certMapBtn.style.display = 'block';

    const reportMapBtn = document.getElementById('openReportMap');
    if (reportMapBtn) reportMapBtn.style.display = 'block';
    
    // Show admin button if access is admin
    if (accessLevel === 'admin' && typeof showAdminButton === 'function') {
      showAdminButton();
    }
  }
}

window.addEventListener('DOMContentLoaded', function() {
  // Initialize filter defaults ONCE (only when visiting for the first time)
  const hasInitializedFilters = localStorage.getItem('hasInitializedFilters');
  if (!hasInitializedFilters) {
    const filterKeys = [
      'filter_stok_imb',
      'filter_stok_no_imb',
      'filter_tersewa_imb',
      'filter_tersewa_no_imb',
      'filter_dipinjam_imb',
      'filter_dipinjam_no_imb',
      'filter_terjual_imb',
      'filter_terjual_no_imb',
      'filter_rekom_imb',
      'filter_rekom_no_imb',
      'filter_unknown_no_induk',
      'filter_unknown_with_induk'
    ];
    
    filterKeys.forEach(key => {
      localStorage.setItem(key, 'true');
    });
    
    // Set "highlight on hand" to OFF by default (unchecked)
    localStorage.setItem('onHandFilter', 'false');
    
    // Mark that we've initialized filters so we don't overwrite user choices later
    localStorage.setItem('hasInitializedFilters', 'true');
  }
  
  const savedAccess = sessionStorage.getItem('access_level');
  if (savedAccess) {
    accessLevel = savedAccess;
    applyAccessRestrictions();
    // Otomatisasi status jika sudah login
    setTimeout(() => {
      if (typeof fetchKavlingStatus === 'function') {
        fetchKavlingStatus();
      }
    }, 1000);
  } else {
    showAccessCodePopup();
  }
});

// ===============================
// QUOTES SYSTEM
// ===============================
const quotes = [
  "Jangan takut, aku menyertaimu.", "Segala sesuatu dapat kutanggung.", "Kasih tidak berkesudahan.",
  "Untuk segala ada waktunya.", "Engkaulah kekuatan dan perisaiku.", "Aku merancang damai untukmu.",
  "Lakukan dengan segenap hatimu.", "Serahkan hidup pada kebaikan.", "Percayalah dengan sepenuh hati.",
  "Harapan tak pernah mengecewakan.", "Damai sejahtera untuk semua.", "Mintalah, maka akan diberikan.",
  "Saat lemah, kita justru kuat.", "Hidup berkelimpahan menantimu.", "Bersukacitalah senantiasa.",
  "Gembalamu takkan meninggalkanmu.", "Kekuatanmu diperbarui setiap hari.", "Yakinlah pada akhir yang baik.",
  "Jalan kebenaran adalah cahaya.", "Kasih setia baru tiap pagi.", "Iman adalah dasar pengharapan.",
  "Dalam kesesakan ada pertolongan.", "Tetaplah percaya dan berharap.", "Dekatlah pada yang patah hati.",
  "Rahmat dan kebenaran menyertaimu.", "Bersama kesulitan ada kemudahan.", "Bersabarlah, kebaikan menyertaimu.",
  "Jangan berduka, kita bersama.", "Hati yang tenang adalah anugerah.", "Pertolongan selalu sangat dekat.",
  "Bersyukurlah atas setiap nikmat.", "Beban tak pernah melebihi kekuatan.", "Berbuat baiklah, cinta mengasihi.",
  "Hati tenang dengan mengingat kebaikan.", "Pengampunan dan kasih sayang nyata.", "Berlomba-lombalah dalam kebaikan.",
  "Berikanlah kabar gembira selalu.", "Menanglah dengan kesabaranmu.", "Kebaikan hapuskan kejahatan.",
  "Derajatmu akan ditinggikan.", "Mohonlah pertolongan dengan sabar.", "Jalan keluar pasti akan datang.",
  "Rezeki telah dijamin untukmu.", "Jangan putus asa dari rahmat.", "Kebaikanmu takkan disia-siakan.",
  "Berjalanlah dengan rendah hati.", "Tetaplah di jalan yang lurus.", "Kemenangan bagi yang bertakwa.",
  "Tempat kembali pada kebaikan.", "Kasih sayang untuk yang berserah.", "Hati adalah pangkal segalanya.",
  "Pikiran adalah pelopor segalanya.", "Kasih sayang adalah obat dunia.", "Kunci kebahagiaan ada di dalam.",
  "Seribu lilin dari satu nyala.", "Perbuatan baik adalah harta sejati.", "Kesabaran adalah kekuatan tertinggi.",
  "Perhatikan saat ini, hadiah sejati.", "Kejelasan pikiran bawakan damai.", "Bebaskan diri dari kebencian.",
  "Kebahagiaan tumbuh dari kebaikan.", "Kehidupan adalah perjalanan belajar.", "Penguasaan diri adalah kemenangan.",
  "Hargailah setiap nafas kehidupan.", "Batin yang tenang adalah karunia.", "Lakukan dengan penuh perhatian.",
  "Kebijaksanaan membebaskan derita.", "Kedamaian dimulai dari senyuman.", "Cinta kasih melampaui segalanya.",
  "Setiap awal adalah momen baru.", "Kendalikan pikiran, kuasai hidup.", "Kehidupan adalah anugerah berharga.",
  "Kebaikan adalah investasi terbaik.", "Semua makhluk pantas bahagia.", "Jadilah cahaya bagi dirimu sendiri.",
  "Percayalah pada perjalanan hidupmu.", "Besok adalah halaman baru.", "Kamu lebih kuat dari yang kaukira.",
  "Kebahagiaan adalah sebuah pilihan.", "Kegagalan adalah guru terbaik.", "Mimpi memberi sayap pada jiwa.",
  "Lakukan yang terbaik, itu cukup.", "Harapan adalah kompas kehidupan.", "Setiap langkah kecil berarti.",
  "Kebesaran hati mengalahkan segalanya.", "Teruslah bergerak maju.", "Percaya pada proses waktumu.",
  "Keberanian adalah tindakan berani.", "Setiap awan memiliki cahaya.", "Hidup adalah petualangan berani.",
  "Syukur mengubah apa yang kita punya.", "Kamu layak mendapatkan kebaikan.", "Mulailah dari tempatmu berdiri.",
  "Cahaya terang dalam gelap.", "Keajaiban terjadi setiap hari.", "Percaya, ceritamu belum selesai.",
  "Waktu yang tepat adalah sekarang.", "Bangkit setiap kali terjatuh.", "Kamu adalah kapten jiwamu.",
  "Dunia butuh cahaya unikmu."
];

function updateQuote() {
  const displayElement = document.getElementById('quote-display');
  if (!displayElement) return;

  // Fade out
  displayElement.classList.remove('visible');

  setTimeout(() => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    displayElement.textContent = quotes[randomIndex];
    // Fade in
    displayElement.classList.add('visible');
  }, 1500); // Wait for fade out to complete
}

setInterval(updateQuote, 15000);
window.addEventListener('DOMContentLoaded', updateQuote);

// ===============================
// DATE & TIME DISPLAY
// ===============================
function updateDateTime() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  };
  const dateTimeString = now.toLocaleDateString('id-ID', options);
  const displayElement = document.getElementById('datetime-display');
  if (displayElement) {
    displayElement.textContent = dateTimeString;
  }
}

setInterval(updateDateTime, 1000);
updateDateTime();

// ===============================
// FINAL CLEAN SCRIPT – SVG MAP
// Search blok & kavling, zoom, pan, click sync + STATUS KAVLING
// ===============================

const API_URL = 'https://script.google.com/macros/s/AKfycbwH8txRUzzpGc_2Y8rjvkNuxqaL_omv29xsiW0nGaNDPLNbE3auB3zx9ZndopWzBLwv/exec';
const CERT_API_URL = 'https://script.google.com/macros/s/AKfycbxuAe7llIpc3SxGAhJ-d_HHYa4Ut9z-nHj8MVUGx4-_Qo7W5mwSLHEKStifg4MRD5Nofg/exec';
// 🔗 ALIAS untuk API Kavling (sama dengan API_URL)
const KAVLING_API_URL = API_URL; // SAMA, karena database kavling
//------------------- pembeda saja -----------------------
//----
const DB_CACHE_KEY = 'fullCertDatabaseCache';
const DB_CACHE_DURATION = 15 * 60 * 1000; // 15 menit
let certificateDB = new Map();
//----
let kavlingIndex = [];
let currentKavlingResults = [];
let originalViewBox = null;
let viewBoxState = null;
let lastFocusedEl = null;
let zoomPadding = null;
let elementMap = new Map(); // Cache untuk elemen SVG

let isPanning = false;
let isDragging = false;
let panStart = { x: 0, y: 0 };
let svgCache = null;
let isSvgLoaded = false;
let isStatusMode = false;
let statusData = null;
let kavlingStatusIndex = new Map();

async function preloadKavlingStatusData() {
  try {
    // Check for offline mode first
    const offlineModeActive = localStorage.getItem('offlineModeActive') === 'true';
    const offlineDataStr = localStorage.getItem('offlineKavlingData');
    if (offlineModeActive && offlineDataStr) {
      try {
        const offlineData = JSON.parse(offlineDataStr);
        if (offlineData.data) {
          statusData = offlineData;
          buildKavlingStatusIndex(statusData);
          console.log('⚡ Preload status kavling dari OFFLINE MODE');
          return;
        }
      } catch (e) {
        console.warn('Error loading offline data:', e);
      }
    }
    
    const CACHE_KEY = 'kavlingStatusData';
    const CACHE_EXPIRY = 10 * 60 * 1000;
    const cachedString = localStorage.getItem(CACHE_KEY);
    if (cachedString) {
      try {
        const cachedObj = JSON.parse(cachedString);
        const age = Date.now() - cachedObj.timestamp;
        if (age < CACHE_EXPIRY && cachedObj.data) {
          statusData = cachedObj.data;
          if (cachedObj.index && typeof cachedObj.index === 'object') {
            kavlingStatusIndex.clear();
            Object.keys(cachedObj.index).forEach(k => {
              const upperKey = k.toUpperCase();
              kavlingStatusIndex.set(upperKey, cachedObj.index[k]);
            });
          } else {
            buildKavlingStatusIndex(statusData);
          }
          console.log('⚡ Preload status kavling dari cache browser');
          return;
        }
      } catch (e) {
        console.warn('Error preload cache status kavling:', e);
        localStorage.removeItem(CACHE_KEY);
      }
    }
    const url = `${API_URL}?action=status&_t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.data) return;
    statusData = data;
    buildKavlingStatusIndex(statusData);
    const indexObj = {};
    kavlingStatusIndex.forEach((v, k) => {
      indexObj[k] = v;
    });
    try {
      localStorage.setItem('kavlingStatusData', JSON.stringify({
        timestamp: Date.now(),
        data: data,
        index: indexObj
      }));
      console.log('✅ Preload status kavling dari API selesai (cached)');
    } catch (err) {
      console.warn('⚠️ Preload status kavling: gagal menyimpan ke localStorage (kemungkinan quota penuh)', err);
      console.log('✅ Preload status kavling dari API selesai (tanpa cache persistent)');
    }
  } catch (e) {
    console.warn('Preload status kavling gagal:', e);
  }
}

// ===============================
// CACHE SYSTEM
// ===============================
const searchCache = new Map();
const certSearchCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000;

// Load caches from LocalStorage
try {
  const savedSearch = localStorage.getItem('searchCache');
  if (savedSearch) {
    const parsed = JSON.parse(savedSearch);
    Object.keys(parsed).forEach(key => searchCache.set(key, parsed[key]));
  }
  
  const savedCert = localStorage.getItem('certSearchCache');
  if (savedCert) {
    const parsed = JSON.parse(savedCert);
    Object.keys(parsed).forEach(key => certSearchCache.set(key, parsed[key]));
  }
} catch (e) {
  console.warn('Failed to load cache from LocalStorage', e);
}

function saveSearchCache() {
  try {
    const obj = {};
    searchCache.forEach((v, k) => {
      // Only save if not expired to keep storage clean
      if (Date.now() - v.timestamp < CACHE_DURATION) {
        obj[k] = v;
      }
    });
    localStorage.setItem('searchCache', JSON.stringify(obj));
  } catch (e) {
    console.warn('Failed to save searchCache', e);
  }
}

function saveCertCache() {
  try {
    const obj = {};
    certSearchCache.forEach((v, k) => {
      if (Date.now() - v.timestamp < CACHE_DURATION) {
        obj[k] = v;
      }
    });
    localStorage.setItem('certSearchCache', JSON.stringify(obj));
  } catch (e) {
    console.warn('Failed to save certSearchCache', e);
  }
}

// ===============================
// DARK MODE FUNCTIONALITY
// ===============================
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// Fungsi untuk toggle dark mode
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  localStorage.setItem('darkMode', isDarkMode);

  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    document.getElementById('darkModeToggle').classList.add('active');
    document.getElementById('darkModeToggle').innerHTML = '<span>☀️</span> Light Mode';
  } else {
    document.body.classList.remove('dark-mode');
    document.getElementById('darkModeToggle').classList.remove('active');
    document.getElementById('darkModeToggle').innerHTML = '<span>🌙</span> Dark Mode';
  }
}

// Fungsi untuk apply dark mode saat halaman dimuat
function applyDarkMode() {
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    document.getElementById('darkModeToggle').classList.add('active');
    document.getElementById('darkModeToggle').innerHTML = '<span>☀️</span> Light Mode';
  }
}
// ===============================
// AUDIO SETTINGS
// ===============================
const clickSound = new Audio('js/klik.mp3');
clickSound.volume = 0.5;

// ===============================
// CLICK HANDLER GLOBAL
// ===============================
document.addEventListener('click', function(e) {
  // Hanya ambil target yang merupakan "Frame" (memiliki ID spesifik yang valid untuk pencarian)
  const target = e.target.closest('g[id^="GA"], g[id^="UJ"], g[id^="KR"], g[id^="M"], g[id^="Blok"]');
  
  if (target && target.id && target.id !== 'map') {
    const kode = target.id;
    
    // Play sound
    clickSound.currentTime = 0;
    clickSound.play().catch(err => console.log('Audio play failed:', err));
    
    // Remove previous highlight
    document.querySelectorAll('.highlight-kavling').forEach(el => {
      el.classList.remove('highlight-kavling');
    });
    
    // Add new highlight ke semua elemen di dalam grup Frame tersebut
    target.querySelectorAll('rect, path, polygon, circle').forEach(child => {
      child.classList.add('highlight-kavling');
    });
    
    // Show Popup - Gunakan fetchDataForAddress agar mengambil data dari API
    if (typeof fetchDataForAddress === 'function') {
      fetchDataForAddress(kode);
    }
  }
});
function parseViewBox(vb) {
  const [x, y, w, h] = vb.split(' ').map(Number);
  return { x, y, w, h };
}

function applyViewBox(svg) {
  if (!svg || !viewBoxState) return;
  svg.setAttribute('viewBox', `${viewBoxState.x} ${viewBoxState.y} ${viewBoxState.w} ${viewBoxState.h}`);
}

function clearHighlight() {
  document.querySelectorAll('#map rect, #map path, #map polygon')
    .forEach(el => {
      // ABAIKAN jika ini adalah bagian dari overlay arsiran (ON HAND atau UNKNOWN HATCH)
      if (el.closest('.on-hand-overlay') || el.closest('.unknown-hatch-overlay')) return;

      // Don't clear style if it's a status color class element
      const parent = el.closest('g');
      const target = (parent && parent.id && parent.id !== 'map') ? parent : el;

      // Cek apakah target memiliki salah satu class status (termasuk variasi -no-imb)
      const hasStatus = Array.from(target.classList).some(cls => cls.startsWith('kavling-status-'));

      if (!hasStatus) {
        el.style.cssText = '';
      } else {
        // Jika berstatus, pastikan stroke-width kembali normal
        el.style.strokeWidth = '';
        el.style.stroke = '';
      }
    });
}

// ===============================
// CERTIFICATE DATABASE CACHE (FULL LOAD)
// ===============================
const normalizeCertId = (raw) => {
  if (!raw) return '';
  return String(raw)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[-_.]/g, '')
    .replace(/\//g, '')
    .trim();
};

async function loadFullCertificateDatabase() {
  console.log('📦 Memulai pemuatan database sertifikat...');
  
  // 1. Cek LocalStorage
  const cached = localStorage.getItem(DB_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;
      
      if (age < DB_CACHE_DURATION && Array.isArray(parsed.data)) {
        console.log(`⚡ Menggunakan cache database sertifikat (${Math.round(age/1000/60)} menit yang lalu)`);
        buildCertificateDB(parsed.data);
        return;
      }
    } catch (e) {
      console.warn('⚠️ Gagal parse cache database:', e);
      localStorage.removeItem(DB_CACHE_KEY);
    }
  }

  // 2. Jika tidak ada cache, ambil dari API
  try {
    const url = `${CERT_API_URL}?action=get_all&_t=${Date.now()}`;
    console.log('🌐 Mengambil database sertifikat dari API...');
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.status === 'success' && Array.isArray(data.data)) {
      console.log(`✅ Database sertifikat dimuat: ${data.data.length} baris`);
      
      // Simpan ke cache
      localStorage.setItem(DB_CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: data.data
      }));
      
      buildCertificateDB(data.data);
    }
  } catch (err) {
    console.error('❌ Gagal memuat database sertifikat:', err);
  }
}

function buildCertificateDB(rows) {
  certificateDB.clear();
  rows.forEach(row => {
    // Gunakan kolom pertama (indeks 0) sebagai kunci (Nomor Sertifikat/Kavling)
    const rawKey = row[0] || '';
    if (!rawKey) return;
    
    const key = normalizeCertId(rawKey);
    // Simpan data lengkapnya
    certificateDB.set(key, {
      nomor: rawKey,
      data: row[34] || '', // Kolom AI (indeks 34)
      fullData: row
    });
  });
  console.log(`🚀 Index database sertifikat siap: ${certificateDB.size} entri`);
}

// ===============================
// FUNGSI STATUS KAVLING (DIPERBAIKI)
// ===============================

function buildKavlingStatusIndex(data) {
  kavlingStatusIndex.clear();
  if (!data || !Array.isArray(data.data)) return;
  const list = data.data;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const kode = (item.kode || '').toString().trim().toUpperCase();
    if (!kode) continue;
    const raw = Array.isArray(item.rawData) ? item.rawData : [];
    const aiValue = raw.length > 34 && raw[34] != null ? String(raw[34]).trim() : '';
    const status = {
      kategori: (item.kategori || 'unknown').toLowerCase(),
      imbCategory: item.imbCategory || '',
      hasImb: Object.prototype.hasOwnProperty.call(item, 'hasImb') ? item.hasImb : null,
      ai: aiValue
    };
    kavlingStatusIndex.set(kode, status);
  }
}

async function fetchKavlingStatus() {
  try {
    console.log('🔍 Mengambil data status kavling...');

    // Tampilkan loading di panel status langsung
    const panel = document.getElementById('statusPanel');
    const panelBody = document.querySelector('.status-panel-body');

    // Tampilkan panel dulu
    panel.style.display = 'block';
    isStatusMode = true;

    // Cek apakah sebelumnya minimized
    const wasMinimized = localStorage.getItem('statusPanelMinimized') === 'true';
    if (wasMinimized && panelBody) {
      panelBody.classList.add('minimized');
    } else if (panelBody) {
      panelBody.classList.remove('minimized');
    }
    // Aktifkan tombol status
    const statusBtn = document.getElementById('statusKavling');
    if (statusBtn) statusBtn.classList.add('active');

    // ==========================================
    // ⏳ LOADING UI (SELALU MUNCUL DULU)
    // ==========================================
    panelBody.innerHTML = `
      <div class="status-loading">
        <div class="status-loading-spinner"></div>
        <div style="color:#666;font-size:14px;margin-top:10px;">
          Memuat data status kavling...
          <br><span style="font-size:12px;color:#999;">Mohon tunggu...</span>
        </div>
        <div class="status-progress">
          <div class="status-progress-bar"></div>
        </div>
      </div>
    `;

    // Helper untuk mengaktifkan tombol IMB
    const enableImbButton = () => {
      const btn = document.getElementById('checkImbStatus');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🏗️</span> Lihat STATUS Kavling IMB/PBG/SLF';
        btn.title = 'Klik untuk melihat detail status IMB/PBG/SLF';
        btn.classList.remove('disabled');
      }
    };

    // ==========================================
    // ⚡ CHECK OFFLINE MODE FIRST
    // ==========================================
    const offlineModeActive = localStorage.getItem('offlineModeActive') === 'true';
    const offlineDataStr = localStorage.getItem('offlineKavlingData');
    if (offlineModeActive && offlineDataStr) {
      try {
        const offlineData = JSON.parse(offlineDataStr);
        if (offlineData.data) {
          console.log('⚡ Menggunakan data status dari OFFLINE MODE');
          
          // Beri jeda sedikit agar loading terlihat
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Simpan ke variabel global
          statusData = offlineData;
          window.lastFetchedKavlingData = statusData.data;
          buildKavlingStatusIndex(statusData);
          
          // Beri warna pada kavling
          colorizeKavling(statusData.data || []);
          
          // Tampilkan data di panel
          updateStatusPanel(statusData);
          enableImbButton();
          
          return statusData;
        }
      } catch (e) {
        console.warn('Error loading offline data in fetchKavlingStatus:', e);
      }
    }
    
    // ==========================================
    // ⚡ CACHE STRATEGY (LOCALSTORAGE)
    // ==========================================
    const CACHE_KEY = 'kavlingStatusData';
    const CACHE_EXPIRY = 10 * 60 * 1000;
    const cachedString = localStorage.getItem(CACHE_KEY);

    if (cachedString) {
      try {
        const cachedObj = JSON.parse(cachedString);
        const age = Date.now() - cachedObj.timestamp;
        
        if (age < CACHE_EXPIRY && cachedObj.data) {
          console.log(`⚡ Menggunakan data status dari CACHE (Umur: ${(age/1000).toFixed(1)}s)`);
          
          // Beri jeda sedikit agar loading terlihat (UX Requirement)
          await new Promise(resolve => setTimeout(resolve, 500));

          // Simpan ke variabel global
        statusData = cachedObj.data;
        window.lastFetchedKavlingData = statusData.data; // Simpan untuk ekspor Excel
        if (cachedObj.index && typeof cachedObj.index === 'object') {
          kavlingStatusIndex.clear();
          Object.keys(cachedObj.index).forEach(k => {
            const upperKey = k.toUpperCase();
            kavlingStatusIndex.set(upperKey, cachedObj.index[k]);
          });
        } else {
          buildKavlingStatusIndex(statusData);
        }

          // Beri warna pada kavling di peta DULUAN (Heavy Operation)
          colorizeKavling(statusData.data || []);

          // BARU Tampilkan data di panel (Menghapus loading)
          updateStatusPanel(statusData);
          
          // Aktifkan tombol IMB
          enableImbButton();

          // Return early - tidak perlu fetch
          return statusData;
        } else {
          console.log('⌛ Cache status kadaluarsa atau invalid, mengambil ulang...');
        }
      } catch (e) {
        console.warn('⚠️ Error parsing cache status:', e);
        localStorage.removeItem(CACHE_KEY);
      }
    }

    const url = `${API_URL}?action=status&_t=${Date.now()}`;
    console.log('🌐 API URL:', url);

    // Fetch dengan timeout 30 detik
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    console.log('📊 Response Status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Data status diterima:', data);

    // DEBUG KHUSUS: Cari M1_177 di response
    const m1InResponse = data.data?.find(item => item.kode === 'M1_177');
    if (m1InResponse) {
      console.log('🔍 DEBUG API RESPONSE M1_177:', m1InResponse);
      console.log(`   Kategori dari API: "${m1InResponse.kategori}"`);
      console.log(`   Skema dari API: "${m1InResponse.skema}"`);
      console.log(`   Harusnya class: kavling-status-${m1InResponse.kategori}`);
    }

    // Simpan data ke variabel global
    statusData = data;
    window.lastFetchedKavlingData = data.data; // Simpan untuk ekspor Excel
    buildKavlingStatusIndex(statusData);

    if (data && data.data) {
      const indexObj = {};
      kavlingStatusIndex.forEach((v, k) => {
        indexObj[k] = v;
      });
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: data,
          index: indexObj
        }));
      } catch (err) {
        console.warn('⚠️ Gagal menyimpan kavlingStatusData ke localStorage (kemungkinan quota penuh)', err);
      }
    }

    // Tampilkan data di panel
    updateStatusPanel(data);

    // Beri warna pada kavling di peta
    colorizeKavling(data.data || []);

    // Aktifkan tombol IMB
    enableImbButton();

    return data;

  } catch (error) {
    console.error('❌ Gagal mengambil data status:', error);

    // Update panel dengan error message
    const panelBody = document.querySelector('.status-panel-body');
    if (panelBody) {
      panelBody.innerHTML = `
        <div style="padding:20px;text-align:center;color:#c62828;">
          <div style="font-size:16px;margin-bottom:10px;">❌ Gagal mengambil data</div>
          <div style="font-size:14px;margin-bottom:15px;">${error.message}</div>
          <button onclick="fetchKavlingStatus()" style="padding:8px 16px;background:#2196F3;color:white;border:none;border-radius:4px;cursor:pointer;">
            🔄 Coba Lagi
          </button>
          <div class="status-debug-info">
            <h5>Debug Info:</h5>
            URL: ${API_URL}?action=status<br>
            Time: ${new Date().toLocaleTimeString()}<br>
            Error: ${error.toString()}
          </div>
        </div>
      `;
    }

    return null;
  }
}

// ===============================
// UPDATE STATUS PANEL
// ===============================
function updateStatusPanel(data) {
  const panelBody = document.querySelector('.status-panel-body');

  if (!panelBody) {
    console.error('❌ Panel body tidak ditemukan');
    return;
  }

  const counts = {
    terjual_imb: 0,
    terjual_no_imb: 0,
    stok_imb: 0,
    stok_no_imb: 0,
    rekom_imb: 0,
    rekom_no_imb: 0,
    tersewa_imb: 0,
    tersewa_no_imb: 0,
    dipinjam_imb: 0,
    dipinjam_no_imb: 0,
    unknown_no_induk: 0,
    unknown_with_induk: 0,
    total: 0
  };

  if (data && data.summaryImb) {
    const summaryImb = data.summaryImb;
    counts.terjual_imb = summaryImb.terjual_imb || 0;
    counts.terjual_no_imb = summaryImb.terjual_no_imb || 0;
    counts.stok_imb = summaryImb.stok_imb || 0;
    counts.stok_no_imb = summaryImb.stok_no_imb || 0;
    counts.rekom_imb = summaryImb.rekom_imb || 0;
    counts.rekom_no_imb = summaryImb.rekom_no_imb || 0;
    counts.tersewa_imb = summaryImb.tersewa_imb || 0;
    counts.tersewa_no_imb = summaryImb.tersewa_no_imb || 0;
    counts.dipinjam_imb = summaryImb.dipinjam_imb || 0;
    counts.dipinjam_no_imb = summaryImb.dipinjam_no_imb || 0;
    
    // Split unknown from summaryImb if it exists as a single count
    if (summaryImb.unknown !== undefined) {
      // If we only have a single 'unknown' count from API, we need to split it manually from data
      if (data.data) {
        data.data.forEach(item => {
          if (item.imbCategory === 'unknown' || item.kategori === 'unknown') {
            const raw = item.rawData || [];
            const refInduk = raw.length > 4 ? String(raw[4] || '').trim() : '';
            const noSgb = raw.length > 12 ? String(raw[12] || '').trim() : ''; // Kolom M
            const noInduk = raw.length > 15 ? String(raw[15] || '').trim() : ''; // Kolom P
            
            const hasCertificate = (refInduk !== '' && refInduk !== '-') || 
                                  (noSgb !== '' && noSgb !== '-') || 
                                  (noInduk !== '' && noInduk !== '-');
                                  
            if (hasCertificate) counts.unknown_with_induk++;
            else counts.unknown_no_induk++;
          }
        });
      } else {
        counts.unknown_no_induk = summaryImb.unknown || 0;
      }
    } else {
      counts.unknown_no_induk = summaryImb.unknown_no_induk || 0;
      counts.unknown_with_induk = summaryImb.unknown_with_induk || 0;
    }

    counts.total = summaryImb.total || (
      counts.terjual_imb +
      counts.terjual_no_imb +
      counts.stok_imb +
      counts.stok_no_imb +
      counts.rekom_imb +
      counts.rekom_no_imb +
      counts.tersewa_imb +
      counts.tersewa_no_imb +
      counts.dipinjam_imb +
      counts.dipinjam_no_imb +
      counts.unknown_no_induk +
      counts.unknown_with_induk
    );
  } else if (data && Array.isArray(data.data)) {
    data.data.forEach(item => {
      const raw = item.rawData || [];
      let hasImb = typeof item.hasImb === 'boolean' ? item.hasImb : null;

      if (hasImb === null && raw.length > 31) {
        const noImbStr = String(raw[31] || '').trim();
        const lower = noImbStr.toLowerCase();
        hasImb = noImbStr !== '' && noImbStr !== '-' && !lower.includes('belum') && !lower.includes('[belum memiliki]');
      }

      const skema = (item.skema || '').toUpperCase();
      let imbCategory = item.imbCategory || 'unknown';

      if (!item.imbCategory || item.imbCategory === 'unknown') {
        if (skema.includes('DIPINJAM') || skema.includes('PINJAM')) {
          imbCategory = hasImb ? 'dipinjam_imb' : 'dipinjam_no_imb';
        } else if (skema.includes('DISEWAKAN') || skema.includes('SEWA')) {
          imbCategory = hasImb ? 'tersewa_imb' : 'tersewa_no_imb';
        } else if (skema.includes('REKOM') || skema.includes('REKOMENDASI')) {
          imbCategory = hasImb ? 'rekom_imb' : 'rekom_no_imb';
        } else if (
          skema.includes('KPR') ||
          skema.includes('TUNAI') ||
          skema.includes('SOLD') ||
          skema.includes('TERJUAL') ||
          skema.includes('LUNAS') ||
          skema.includes('DP') ||
          skema.includes('DIHUNI')
        ) {
          imbCategory = hasImb ? 'terjual_imb' : 'terjual_no_imb';
        } else if (skema.includes('STOK')) {
          imbCategory = hasImb ? 'stok_imb' : 'stok_no_imb';
        } else {
          // Check Ref Induk, SGB, and Induk if category is unknown
          const raw = item.rawData || [];
          const refInduk = raw.length > 4 ? String(raw[4] || '').trim() : '';
          const noSgb = raw.length > 12 ? String(raw[12] || '').trim() : ''; // Kolom M
          const noInduk = raw.length > 15 ? String(raw[15] || '').trim() : ''; // Kolom P
          
          const hasCertificate = (refInduk !== '' && refInduk !== '-') || 
                                (noSgb !== '' && noSgb !== '-') || 
                                (noInduk !== '' && noInduk !== '-');
                                
          imbCategory = hasCertificate ? 'unknown_with_induk' : 'unknown_no_induk';
        }
      }

      if (Object.prototype.hasOwnProperty.call(counts, imbCategory)) {
        counts[imbCategory]++;
      } else if (imbCategory === 'unknown_no_induk') {
        counts.unknown_no_induk++;
      } else if (imbCategory === 'unknown_with_induk') {
        counts.unknown_with_induk++;
      } else {
        counts.unknown_no_induk++;
      }
    });

    counts.total =
      counts.terjual_imb +
      counts.terjual_no_imb +
      counts.stok_imb +
      counts.stok_no_imb +
      counts.rekom_imb +
      counts.rekom_no_imb +
      counts.tersewa_imb +
      counts.tersewa_no_imb +
      counts.dipinjam_imb +
      counts.dipinjam_no_imb +
      counts.unknown_no_induk +
      counts.unknown_with_induk;
  }

  // ========== BUAT HTML PANEL ==========
  const onHandActive = localStorage.getItem('onHandFilter') === 'true';

  // Hitung ON HAND dari data
  let onHandTotal = 0;
  if (data && Array.isArray(data.data)) {
    data.data.forEach(item => {
      const raw = item.rawData || [];
      const qValue = raw.length > 16 ? String(raw[16] || '').trim().toUpperCase() : '';
      const kValue = raw.length > 10 ? String(raw[10] || '').trim().toUpperCase() : '';
      if (qValue.includes('ON_HAND') || kValue.includes('ON_HAND')) onHandTotal++;
    });
  }

  const offlineModeActive = localStorage.getItem('offlineModeActive') === 'true';
  let html = `
    <div class="status-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: ${offlineModeActive ? '#009688' : '#673ab7'}; color: white; gap: 8px;">
      <h4 style="margin: 0; font-size: 14px;">📊 Statistik Kavling (IMB)${offlineModeActive ? ' - OFFLINE MODE' : ''}</h4>
      <button id="refreshKavlingStatusBtn"
        style="margin: 0; padding: 6px 10px; font-size: 11px; border-radius: 999px; border: none; cursor: pointer;
               background: #ff9800; color: #ffffff; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.25); display: inline-flex; align-items: center; gap: 4px;">
        <span>🔄</span><span>Refresh Status Kavling</span>
      </button>
    </div>
    ${offlineModeActive ? `
    <div style="background: #e0f2f1; padding: 8px 12px; border-left: 4px solid #009688; font-size: 12px; color: #00796b; margin-bottom: 10px;">
      📁 Menggunakan database lokal (offline mode)
    </div>` : ''}
    <div class="status-content" style="padding: 12px;">
      <!-- FILTER ON HAND -->
      <div style="margin-bottom: 15px; display: flex; align-items: center; background: ${onHandActive ? '#fff9c4' : '#f5f5f5'}; padding: 10px 14px; border-radius: 12px; border: 2px solid ${onHandActive ? '#fbc02d' : '#ddd'}; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s ease;" id="onHandToggleContainer">
        <input type="checkbox" id="onHandFilter" ${onHandActive ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: #fbc02d;">
        <label for="onHandFilter" style="cursor: pointer; font-size: 14px; font-weight: 800; color: ${onHandActive ? '#827717' : '#666'}; margin-left: 12px; display: flex; align-items: center; gap: 8px; flex: 1;">
          <span style="font-size: 18px;">✨</span> HIGHLIGHT ON HAND
        </label>
        <div id="countONHAND" style="font-size: 12px; background: ${onHandActive ? '#fbc02d' : '#999'}; color: white; padding: 2px 10px; border-radius: 12px; font-weight: 900; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">${onHandTotal}</div>
      </div>
  `;

  const categories = [
    // STOK (IMB / belum IMB)
    { id: 'stok_imb', title: 'Stok dengan IMB/PBG/SLF' },
    { id: 'stok_no_imb', title: 'Stok belum ada IMB/PBG/SLF' },
    // TERSEWA (IMB / tanpa IMB)
    { id: 'tersewa_imb', title: 'Tersewa dengan IMB/PBG/SLF' },
    { id: 'tersewa_no_imb', title: 'Tersewa tanpa IMB/PBG/SLF' },
    // DIPINJAM (IMB / belum IMB)
    { id: 'dipinjam_imb', title: 'Dipinjam dengan IMB/PBG/SLF' },
    { id: 'dipinjam_no_imb', title: 'Dipinjam belum ada IMB/PBG/SLF' },
    // TERJUAL / SOLD (IMB / tanpa IMB)
    { id: 'terjual_imb', title: 'Terjual dengan IMB/PBG/SLF' },
    { id: 'terjual_no_imb', title: 'Terjual tanpa IMB/PBG/SLF' },
    // REKOM (IMB / belum IMB)
    { id: 'rekom_imb', title: 'Rekom dengan IMB/PBG/SLF' },
    { id: 'rekom_no_imb', title: 'Rekom belum ada IMB/PBG/SLF' },
    // LAINNYA
    { id: 'unknown_no_induk', title: 'Tidak diketahui (tanpa sertifikat induk)' },
    { id: 'unknown_with_induk', title: 'Tidak diketahui (dengan sertifikat induk)' }
  ];

  categories.forEach(cat => {
    const count = counts[cat.id] || 0;
    const borderStyle = cat.id.startsWith('unknown') ? 'border: 1px solid #ddd;' : '';
    
    // Background solid dan Darker untuk area "ID" (ikon sebelah kiri)
    let btnBg = '#ffffff';
    let darkerBg = '#cccccc';
    let textColor = 'white';
    let textShadow = '-0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000, 1px 1px 2px rgba(0,0,0,0.5)';
    let countBg = 'rgba(255,255,255,0.2)';
    let countColor = 'white';
    let countBorder = 'rgba(255,255,255,0.3)';

    // State visibilitas warna (default true jika belum ada)
    const filterKey = `filter_${cat.id}`;
    const isVisible = localStorage.getItem(filterKey) !== 'false';

    if (cat.id === 'terjual_imb') { btnBg = 'grey'; darkerBg = '#555555'; }
    else if (cat.id === 'terjual_no_imb') { btnBg = 'lightgrey'; darkerBg = '#999999'; }
    else if (cat.id === 'stok_imb') { btnBg = '#2ecc71'; darkerBg = '#27ae60'; }
    else if (cat.id === 'stok_no_imb') { 
      btnBg = '#c6f7c6ff'; 
      darkerBg = '#b0ffb0'; 
      textColor = '#333333'; 
      textShadow = 'none';
      countBg = 'rgba(0,0,0,0.05)';
      countColor = '#333333';
      countBorder = 'rgba(0,0,0,0.1)';
    }
    else if (cat.id === 'rekom_imb') { btnBg = '#9c27b0'; darkerBg = '#7b1fa2'; }
    else if (cat.id === 'rekom_no_imb') { 
      btnBg = '#9c27b0'; 
      darkerBg = '#7b1fa2'; 
    }
    else if (cat.id === 'dipinjam_imb') { btnBg = '#26a69a'; darkerBg = '#00897b'; }
    else if (cat.id === 'dipinjam_no_imb') { btnBg = '#4db6ac'; darkerBg = '#00897b'; }
    else if (cat.id === 'tersewa_imb') { btnBg = '#42A5F5'; darkerBg = '#1E88E5'; }
    else if (cat.id === 'tersewa_no_imb') { btnBg = '#1E88E5'; darkerBg = '#1565C0'; }
    else if (cat.id === 'unknown_no_induk') { 
      btnBg = 'red'; 
      darkerBg = '#cc0000';
      textColor = 'white'; 
      textShadow = '-0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000, 1px 1px 2px rgba(0,0,0,0.5)';
      countBg = 'rgba(255,255,255,0.2)';
      countColor = 'white';
      countBorder = 'rgba(255,255,255,0.3)';
    }
    else if (cat.id === 'unknown_with_induk') { 
      btnBg = 'white'; 
      darkerBg = 'red';
      textColor = '#333333'; 
      textShadow = 'none';
      countBg = 'rgba(0,0,0,0.05)';
      countColor = '#333333';
      countBorder = 'rgba(0,0,0,0.1)';
    }

    html += `
      <div class="status-item-container" style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; width: 100%;">
        <div class="status-visibility-toggle" style="flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #eee; padding: 10px; border-radius: 10px; border: 1px solid #ddd; cursor: pointer; height: 44px; box-sizing: border-box;" 
             title="Tampilkan/Sembunyikan warna ini di peta" data-id="${cat.id}">
          <input type="checkbox" class="color-filter-checkbox" data-id="${cat.id}" ${isVisible ? 'checked' : ''} 
                 style="width: 18px; height: 18px; cursor: pointer; accent-color: #673ab7; margin: 0;">
        </div>
        <div class="status-item clickable-status-item" data-type="${cat.id}" 
             style="display: flex; align-items: center; padding: 10px; 
                    background: ${btnBg}; border-radius: 10px; box-shadow: 0 3px 0 rgba(0,0,0,0.15); 
                    cursor: pointer; transition: all 0.1s ease; border: 1px solid rgba(0,0,0,0.1);
                    color: ${textColor}; font-weight: 700;
                    text-shadow: ${textShadow}; flex: 1; box-sizing: border-box; overflow: hidden; height: 44px;">
          <div class="status-color-sample" style="flex-shrink: 0; width: 18px; height: 18px; border-radius: 4px; margin-right: 10px; background-color: ${darkerBg}; border: 1px solid rgba(0,0,0,0.2); box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);"></div>
          <div class="status-info" style="flex: 1; display: flex; justify-content: space-between; align-items: center; min-width: 0;">
            <div class="status-title" style="font-size: 11px; font-weight: 700; line-height: 1.2; white-space: normal; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-right: 5px;">${cat.title}</div>
            <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
              <div class="status-count" id="count${cat.id.toUpperCase()}" style="font-size: 12px; font-weight: 800; background: ${countBg}; color: ${countColor}; padding: 1px 8px; border-radius: 12px; border: 1px solid ${countBorder}; min-width: 20px; text-align: center;">${count}</div>
              <span style="font-size: 14px; font-weight: 800; opacity: 0.7;">›</span>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  html += `
    <div class="status-total" style="text-align: center; padding: 12px; margin-top: 10px; background: #e8f5e9; border-radius: 8px; font-size: 15px; border: 1px solid #c8e6c9; width: 100%; box-sizing: border-box;">
      <strong>Total Kavling: <span id="totalAll" style="color: #2E7D32;">${counts.total}</span></strong>
    </div>

    <div class="status-debug-info" style="margin-top: 10px; padding: 10px; background: #f9f9f9; border-radius: 6px; font-size: 11px; color: #666; width: 100%; box-sizing: border-box; overflow: hidden;">
      <h5 style="margin: 0 0 5px 0; color: #333; font-size: 11px;">Info Data:</h5>
      API Sync Active<br>
      Total: <span id="totalApiRecords">${data.totalRecords || 0}</span> | ${new Date().toLocaleTimeString()}
    </div>
  </div>`;

  panelBody.innerHTML = html;

  // Tombol Select All / Clear All
  const selectAllContainer = document.createElement('div');
  selectAllContainer.style.cssText = 'margin-bottom: 12px; display: flex; align-items: center; background: #f0f0f0; padding: 8px 12px; border-radius: 10px; border: 1px solid #ddd; cursor: pointer;';
  
  // Tentukan status awal checkbox "Semua"
  const allCheckboxes = document.querySelectorAll('.color-filter-checkbox');
  const allChecked = Array.from(document.querySelectorAll('.color-filter-checkbox')).every(cb => cb.checked);
  
  selectAllContainer.innerHTML = `
    <input type="checkbox" id="allColorsFilter" ${allChecked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: #673ab7; margin: 0;">
    <label for="allColorsFilter" style="cursor: pointer; font-size: 13px; font-weight: 700; color: #555; margin-left: 10px; flex: 1;">
      TAMPILKAN SEMUA WARNA
    </label>
  `;
  
  const statusContent = panelBody.querySelector('.status-content');
  if (statusContent) {
    statusContent.insertBefore(selectAllContainer, statusContent.querySelector('.status-item-container'));
  }

  // Event listener untuk Select All
  const allToggle = document.getElementById('allColorsFilter');
  if (allToggle) {
    allToggle.addEventListener('change', function() {
      const isChecked = this.checked;
      document.querySelectorAll('.color-filter-checkbox').forEach(cb => {
        if (cb.checked !== isChecked) {
          cb.checked = isChecked;
          const id = cb.getAttribute('data-id');
          localStorage.setItem(`filter_${id}`, isChecked);
        }
      });
      
      // Re-colorize map
      if (statusData && Array.isArray(statusData.data)) {
        colorizeKavling(statusData.data);
      }
    });
    
    selectAllContainer.addEventListener('click', function(e) {
      if (e.target !== allToggle && e.target.tagName !== 'LABEL') {
        allToggle.checked = !allToggle.checked;
        allToggle.dispatchEvent(new Event('change'));
      }
    });
  }

  // Event listener untuk Filter Visibilitas Warna
  document.querySelectorAll('.status-visibility-toggle').forEach(toggle => {
    toggle.addEventListener('click', function(e) {
      const checkbox = this.querySelector('.color-filter-checkbox');
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });
  });

  document.querySelectorAll('.color-filter-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const id = this.getAttribute('data-id');
      localStorage.setItem(`filter_${id}`, this.checked);
      
      // Update checkbox "Semua"
      const allToggle = document.getElementById('allColorsFilter');
      if (allToggle) {
        const anyUnchecked = Array.from(document.querySelectorAll('.color-filter-checkbox')).some(cb => !cb.checked);
        allToggle.checked = !anyUnchecked;
      }

      // Re-colorize map to apply filter
      if (statusData && Array.isArray(statusData.data)) {
        colorizeKavling(statusData.data);
      }
    });
  });

  const refreshBtn = document.getElementById('refreshKavlingStatusBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      try {
        const originalHtml = refreshBtn.innerHTML;
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.7';
        refreshBtn.innerHTML = '<span>⏳</span><span>Merefresh...</span>';

        localStorage.removeItem('kavlingStatusData');
        statusData = null;

        await fetchKavlingStatus();

        refreshBtn.innerHTML = originalHtml;
        refreshBtn.style.opacity = '1';
        refreshBtn.disabled = false;
      } catch (err) {
        console.error('Error saat refresh status kavling:', err);
        alert('Gagal refresh status kavling. Silakan coba lagi.');
        refreshBtn.disabled = false;
        refreshBtn.style.opacity = '1';
      }
    });
  }

  // Re-attach event listeners - Seluruh kotak sekarang menjadi tombol
  const currentAccess = accessLevel || sessionStorage.getItem('access_level') || null;

  document.querySelectorAll('.clickable-status-item').forEach(item => {
    const type = item.getAttribute('data-type');

    if (currentAccess === 'limited' && type !== 'stok_imb' && type !== 'stok_no_imb') {
      item.style.pointerEvents = 'none';
      item.style.filter = 'grayscale(0.2)';
      item.title = 'Akses terbatas. Gunakan kode F888 untuk fitur penuh.';
    } else {
      item.style.pointerEvents = 'auto';
      item.style.opacity = '';
      item.style.filter = '';
      item.title = '';

      item.addEventListener('click', function() {
        const t = this.getAttribute('data-type');
        showImbStatsPopup(t);
      });
    }
  });

  // Event listener untuk Filter ON HAND
  const onHandCheckbox = document.getElementById('onHandFilter');
  const onHandContainer = document.getElementById('onHandToggleContainer');

  if (onHandCheckbox && onHandContainer) {
    onHandContainer.addEventListener('click', function(e) {
      // Jika klik bukan pada checkbox itu sendiri, toggle checkbox
      if (e.target !== onHandCheckbox) {
        onHandCheckbox.checked = !onHandCheckbox.checked;
        // Trigger change event manual
        onHandCheckbox.dispatchEvent(new Event('change'));
      }
    });

    onHandCheckbox.addEventListener('change', function() {
      localStorage.setItem('onHandFilter', this.checked);
      // Re-render panel UI
      updateStatusPanel(data);
      // Re-colorize map to show/hide labels
      if (statusData && Array.isArray(statusData.data)) {
        colorizeKavling(statusData.data);
      }
    });
  }

  const closeBtn = panelBody.querySelector('.close-status-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      resetStatusMode();
    });
  }
}

// ===============================
// BERI WARNA PADA KAVLING BERDASARKAN STATUS
// ===============================
function colorizeKavling(kavlingData) {
  const svgMap = document.querySelector('#map svg');
  if (!svgMap) {
    console.error('❌ SVG map tidak ditemukan');
    return;
  }

  // ENSURE PATTERN DEFINITION
  let defs = svgMap.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svgMap.insertBefore(defs, svgMap.firstChild);
  }
  if (!document.getElementById('onHandHatch')) {
    const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute('id', 'onHandHatch');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', '8');
    pattern.setAttribute('height', '8');
    pattern.setAttribute('patternTransform', 'rotate(45)');
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '0'); line.setAttribute('y2', '6');
    line.setAttribute('stroke', '#e0d100ff');
    line.setAttribute('stroke-width', '3.5');
    line.setAttribute('stroke-opacity', '1');
    pattern.appendChild(line);
    defs.appendChild(pattern);
  }
  
  if (!document.getElementById('unknownHatch')) {
    const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute('id', 'unknownHatch');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', '20'); // Lebih lebar agar jarang-jarang
    pattern.setAttribute('height', '20');
    pattern.setAttribute('patternTransform', 'rotate(45)');
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute('x1', '7.5'); line.setAttribute('y1', '0');
    line.setAttribute('x2', '7.5'); line.setAttribute('y2', '15');
    line.setAttribute('stroke', 'red');
    line.setAttribute('stroke-width', '1.5'); // Garis lebih tipis
    line.setAttribute('stroke-opacity', '0.8'); // Sedikit lebih transparan
    pattern.appendChild(line);
    defs.appendChild(pattern);
  }

  console.log(`🎨 Mulai mewarnai ${kavlingData.length} kavling`);

  // LOG DISTRIBUSI KATEGORI
  const categoryCount = {};
  kavlingData.forEach(item => {
    categoryCount[item.kategori] = (categoryCount[item.kategori] || 0) + 1;
  });
  console.log('📊 Distribusi kategori dari API:', categoryCount);

  clearStatusColors();

  let coloredCount = 0;
  let notFoundCount = 0;
  let onHandCount = 0; // Tambahkan counter untuk ON HAND
  let processedIds = new Set();

  kavlingData.forEach(item => {
    if (!item.kode) return;

    const kode = item.kode.trim().toUpperCase();
    const hasImb = Object.prototype.hasOwnProperty.call(item, 'hasImb') ? item.hasImb : null;
    let kategori = (item.kategori || 'unknown').toLowerCase();
    const skemaText = (item.skema || '').toString().toUpperCase();

    // Cek status ON HAND (Hanya dari Kolom "SKEMA PEMBIAYAAN" / Kolom K / Index 10)
    const rawData = item.rawData || [];
    const skemaPembiayaan = rawData.length > 10 ? String(rawData[10] || '').trim().toUpperCase() : '';
    const isOnHand = skemaPembiayaan.includes('ON HAND') || skemaPembiayaan.includes('ON_HAND') || skemaPembiayaan.includes('ON-HAND');
    if (isOnHand) onHandCount++; // Hitung total ON HAND

    if (kategori === 'unknown' && skemaText) {
      if (skemaText.includes('DISEWAKAN') || skemaText.includes('SEWA') || skemaText.includes('DIPINJAM')) {
        kategori = 'disewakan';
      } else if (skemaText.includes('REKOM') || skemaText.includes('REKOMENDASI')) {
        kategori = 'rekom';
      } else if (
        skemaText.includes('KPR') ||
        skemaText.includes('TUNAI') ||
        skemaText.includes('SOLD') ||
        skemaText.includes('TERJUAL') ||
        skemaText.includes('LUNAS') ||
        skemaText.includes('DP') ||
        skemaText.includes('DIHUNI')
      ) {
        kategori = 'kpr';
      } else if (skemaText.includes('STOK')) {
        kategori = 'stok';
      }
    }

    let className = null;
    let imbCategory = '';

    if (kategori === 'kpr') {
      imbCategory = hasImb === false ? 'terjual_no_imb' : 'terjual_imb';
      className = hasImb === false ? 'kavling-status-kpr-no-imb' : 'kavling-status-kpr';
    } else if (kategori === 'stok') {
      imbCategory = hasImb === false ? 'stok_no_imb' : 'stok_imb';
      className = hasImb === false ? 'kavling-status-stok-no-imb' : 'kavling-status-stok';
    } else if (kategori === 'rekom') {
      imbCategory = hasImb === false ? 'rekom_no_imb' : 'rekom_imb';
      className = hasImb === false ? 'kavling-status-rekom-no-imb' : 'kavling-status-rekom';
    } else if (kategori === 'disewakan') {
      imbCategory = hasImb === false ? 'tersewa_no_imb' : 'tersewa_imb';
      className = hasImb === false ? 'kavling-status-disewakan-no-imb' : 'kavling-status-disewakan';
    } else if (kategori === 'dipinjam') {
      imbCategory = hasImb === false ? 'dipinjam_no_imb' : 'dipinjam_imb';
      className = hasImb === false ? 'kavling-status-dipinjam-no-imb' : 'kavling-status-dipinjam';
    } else if (kategori === 'unknown') {
      const refInduk = rawData.length > 4 ? String(rawData[4] || '').trim() : '';
      const noSgb = rawData.length > 12 ? String(rawData[12] || '').trim() : ''; // Kolom M
      const noInduk = rawData.length > 15 ? String(rawData[15] || '').trim() : ''; // Kolom P
      
      const hasRefInduk = refInduk !== '' && refInduk !== '-';
      const hasNoSgb = noSgb !== '' && noSgb !== '-';
      const hasNoInduk = noInduk !== '' && noInduk !== '-';
      
      // Jika ada data di Ref Induk ATAU SGB ATAU Induk, maka masuk ke "dengan sertifikat"
      const withCertificate = hasRefInduk || hasNoSgb || hasNoInduk;
      
      imbCategory = withCertificate ? 'unknown_with_induk' : 'unknown_no_induk';
      className = withCertificate ? 'kavling-status-unknown-with-induk' : 'kavling-status-unknown-no-induk';
    }

    // Cek visibilitas warna berdasarkan filter checkbox
    const isFilteredOut = imbCategory && localStorage.getItem(`filter_${imbCategory}`) === 'false';
    if (isFilteredOut) {
      className = null;
    }

    // Coba cari elemen dengan ID persis
    let element = document.getElementById(kode);

    if (!element) {
      // PERBAIKAN: Normalisasi format kode (Contoh: UJ22_11 -> UJ22-11 jika di SVG pakai dash)
      const normalizedKode = kode.replace(/[-_]/g, '');
      const allElements = document.querySelectorAll('[id]');
      for (let i = 0; i < allElements.length; i++) {
        const normalizedId = allElements[i].id.toUpperCase().replace(/[-_]/g, '');
        if (normalizedId === normalizedKode) {
          element = allElements[i];
          break;
        }
      }
    }

    if (element) {
      if (element.id) processedIds.add(element.id);

      // Cek status ON HAND (Hanya dari Kolom "SKEMA PEMBIAYAAN" / Kolom K / Index 10)
      const onHandActive = localStorage.getItem('onHandFilter') === 'true';
      const rawData = item.rawData || [];
      const skemaPembiayaan = rawData.length > 10 ? String(rawData[10] || '').trim().toUpperCase() : '';
      const isOnHand = skemaPembiayaan.includes('ON HAND') || skemaPembiayaan.includes('ON_HAND') || skemaPembiayaan.includes('ON-HAND');

      // Terapkan highlight kuning jika ON HAND aktif dan data cocok
      const applyHighlight = onHandActive && isOnHand;

      // Hapus semua kelas status sebelumnya pada group (sekadar bersih-bersih)
      element.classList.remove(
        'kavling-status-kpr',
        'kavling-status-kpr-no-imb',
        'kavling-status-stok', 
        'kavling-status-stok-no-imb',
        'kavling-status-rekom',
        'kavling-status-rekom-no-imb',
        'kavling-status-disewakan',
        'kavling-status-disewakan-no-imb',
        'kavling-status-dipinjam',
        'kavling-status-dipinjam-no-imb',
        'kavling-status-unknown',
        'kavling-status-unknown-no-induk',
        'kavling-status-unknown-with-induk'
      );

      // Tambahkan class status baru ke group agar clearHighlight bisa mengenalinya
      if (className) {
        element.classList.add(className);
      }

      // Terapkan highlight ON HAND jika diperlukan (ARSIRAN)
      // Bersihkan overlay lama baik di dalam maupun di luar elemen
      element.querySelectorAll('.on-hand-overlay, .unknown-hatch-overlay').forEach(ov => ov.remove());
      const externalOverlay = document.querySelector(`.on-hand-overlay[data-for="${kode}"], .unknown-hatch-overlay[data-for="${kode}"]`);
      if (externalOverlay) externalOverlay.remove();

      // Tentukan apakah perlu overlay: ON HAND (selalu jika aktif) atau UNKNOWN_WITH_INDUK (hanya jika tidak difilter)
      const needsUnknownHatch = (imbCategory === 'unknown_with_induk' && !isFilteredOut);
      
      if (applyHighlight || needsUnknownHatch) {
        // Buat clone sebagai overlay arsiran
        const overlay = element.cloneNode(true);
        overlay.removeAttribute('id'); // Jangan duplikasi ID
        
        // Prioritaskan ON HAND overlay jika keduanya aktif
        const overlayClass = applyHighlight ? 'on-hand-overlay' : 'unknown-hatch-overlay';
        overlay.setAttribute('class', overlayClass);
        overlay.setAttribute('data-for', kode); // Untuk memudahkan pembersihan
        overlay.style.pointerEvents = 'none'; // Biar tetep bisa klik elemen aslinya
        
        const hatchId = applyHighlight ? 'onHandHatch' : 'unknownHatch';

        if (element.tagName.toLowerCase() === 'g') {
          // Atur isi overlay agar hanya berisi arsiran
          const children = overlay.querySelectorAll('rect, path, polygon, circle');
          children.forEach(child => {
            child.style.fill = `url(#${hatchId})`;
            child.style.stroke = 'none';
            child.style.filter = 'none';
            child.classList.remove('on-hand-highlight', 'kavling-status-unknown-with-induk');
            child.className = ''; 
          });
          element.appendChild(overlay);
        } else {
          // Jika bukan group tapi single element
          overlay.style.fill = `url(#${hatchId})`;
          overlay.style.stroke = 'none';
          overlay.className = overlayClass;
          // Sisipkan setelah elemen asli agar berada di atasnya
          element.parentNode.insertBefore(overlay, element.nextSibling);
        }
      }

      // Jika element adalah group, tambahkan ke child elements juga
      if (element.tagName.toLowerCase() === 'g') {
        element.querySelectorAll('rect, path, polygon, circle').forEach(child => {
          // Abaikan jika ini adalah overlay arsiran
          if (child.closest('.on-hand-overlay') || child.closest('.unknown-hatch-overlay')) return;

          child.classList.remove(
            'kavling-status-kpr',
            'kavling-status-kpr-no-imb',
            'kavling-status-stok', 
            'kavling-status-stok-no-imb',
            'kavling-status-rekom',
            'kavling-status-rekom-no-imb',
            'kavling-status-disewakan',
            'kavling-status-disewakan-no-imb',
            'kavling-status-dipinjam',
            'kavling-status-dipinjam-no-imb',
            'kavling-status-unknown',
            'kavling-status-unknown-no-induk',
            'kavling-status-unknown-with-induk'
          );
          if (className) {
            child.classList.add(className);
          }
        });
      }

      coloredCount++;

      // LOG untuk beberapa kavling (sample)
      if (coloredCount <= 5) {
        console.log(`  ${kode} → ${className} (skema: "${item.skema}")`);
      }

    } else {
      notFoundCount++;
      if (notFoundCount <= 5) {
        console.warn(`❓ Kavling tidak ditemukan: "${kode}"`);
      }
    }
  });

  // Hitung kavling tanpa status (tidak diwarnai, dibiarkan sesuai gambar awal)
  const allBlocksWithId = document.querySelectorAll('[id^="GA"], [id^="UJ"], [id^="KR"], [id^="M"], [id^="Blok"]');
  let unknownCount = 0;

  allBlocksWithId.forEach(el => {
    const hasAnyStatus = Array.from(el.classList).some(cls => cls.startsWith('kavling-status-') && cls !== 'kavling-status-unknown');

    if (el.id && !processedIds.has(el.id) && !hasAnyStatus) {
      // Default untuk yang ada di SVG tapi tidak di DB: unknown_no_induk (merah)
      if (localStorage.getItem('filter_unknown_no_induk') !== 'false') {
        el.classList.add('kavling-status-unknown-no-induk');
        
        // Jika element adalah group, tambahkan ke child elements juga
        if (el.tagName.toLowerCase() === 'g') {
          el.querySelectorAll('rect, path, polygon, circle').forEach(child => {
            if (!child.closest('.on-hand-overlay') && !child.closest('.unknown-hatch-overlay')) {
              child.classList.add('kavling-status-unknown-no-induk');
            }
          });
        }
      }
      unknownCount++;
    }
  });

  console.log(`✅ Selesai: ${coloredCount} kavling berwarna, ${unknownCount} tanpa status (diwarnai merah), ${notFoundCount} tidak ditemukan`);

  // LOG hasil akhir
  const finalCategoryCount = {};
  allBlocksWithId.forEach(el => {
    if (el.classList.contains('kavling-status-kpr')) finalCategoryCount.kpr = (finalCategoryCount.kpr || 0) + 1;
    if (el.classList.contains('kavling-status-stok')) finalCategoryCount.stok = (finalCategoryCount.stok || 0) + 1;
    if (el.classList.contains('kavling-status-rekom')) finalCategoryCount.rekom = (finalCategoryCount.rekom || 0) + 1;
    if (el.classList.contains('kavling-status-disewakan')) finalCategoryCount.disewakan = (finalCategoryCount.disewakan || 0) + 1;
  });

  console.log('🎯 Hasil akhir pewarnaan:', finalCategoryCount);
}

// ===============================
// HAPUS SEMUA WARNA STATUS
// ===============================
function clearStatusColors() {
  // Hapus kelas warna dari semua elemen kavling
  document.querySelectorAll('[id^="GA"], [id^="UJ"], [id^="KR"], [id^="M"], [id^="Blok"]')
    .forEach(el => {
      // Hapus inline style fill/stroke agar tidak menimpa class CSS
      el.style.fill = '';
      el.style.stroke = '';

      // Hapus highlight ON HAND jika ada
      el.classList.remove('on-hand-highlight');
      el.querySelectorAll('.on-hand-overlay, .unknown-hatch-overlay').forEach(ov => ov.remove());
      // Cari dan hapus overlay eksternal jika ada
      if (el.id) {
        const extOv = document.querySelector(`.on-hand-overlay[data-for="${el.id.toUpperCase()}"], .unknown-hatch-overlay[data-for="${el.id.toUpperCase()}"]`);
        if (extOv) extOv.remove();
      }

      el.classList.remove(
        'kavling-status-kpr',
        'kavling-status-stok', 
        'kavling-status-rekom',
        'kavling-status-disewakan',
        'kavling-status-unknown',
        'kavling-status-unknown-no-induk',
        'kavling-status-unknown-with-induk'
      );

      // Hapus juga dari child elements jika group
      if (el.tagName.toLowerCase() === 'g') {
        el.querySelectorAll('rect, path, polygon').forEach(child => {
          child.style.fill = '';
          child.style.stroke = '';
          child.classList.remove(
            'on-hand-highlight',
            'kavling-status-kpr',
            'kavling-status-stok', 
            'kavling-status-rekom',
            'kavling-status-disewakan',
            'kavling-status-unknown',
            'kavling-status-unknown-no-induk',
            'kavling-status-unknown-with-induk'
          );
        });
      }
    });
}

// Fungsi untuk hitung ulang dari peta
function countKavlingFromMap() {
  console.log('🧮 Menghitung ulang dari peta (semua frame ID)...');

  const counts = {
    kpr: 0,
    stok: 0,
    rekom: 0,
    disewakan: 0,
    unknown_no_induk: 0,
    unknown_with_induk: 0,
    total: 0
  };

  // Query SEMUA elemen frame
  const allFrameElements = document.querySelectorAll('[id^="GA"], [id^="UJ"], [id^="KR"], [id^="M"], [id^="Blok"]');

  console.log(`📊 Total frame elements ditemukan: ${allFrameElements.length}`);

  // Definisikan semua kelas status
  const statusClasses = [
    'kavling-status-kpr', 
    'kavling-status-stok', 
    'kavling-status-rekom', 
    'kavling-status-disewakan',
    'kavling-status-unknown-no-induk',
    'kavling-status-unknown-with-induk'
  ];

  // Hitung status untuk setiap frame element
  allFrameElements.forEach(el => {
    if (el.id && el.id.trim() !== '') {
      let foundStatus = false;

      // Cek setiap kelas status
      statusClasses.forEach(className => {
        if (el.classList.contains(className)) {
          const type = className.replace('kavling-status-', '').replace(/-/g, '_');
          counts[type]++;
          foundStatus = true;
        }
      });

      // Jika tidak ada kelas status, maka termasuk UNKNOWN_NO_INDUK (merah)
      if (!foundStatus) {
        counts.unknown_no_induk++;
      }
    }
  });

  // Hitung total
  counts.total = counts.kpr + counts.stok + counts.rekom + counts.disewakan + counts.unknown_no_induk + counts.unknown_with_induk;

  console.log('📈 Hasil hitung real-time dari peta:', counts);

  // Update UI langsung
  const safeUpdate = (elementId, value) => {
    const element = document.getElementById(elementId);
    if (element) element.textContent = value !== undefined ? value : 0;
  };

  safeUpdate('countKPR', counts.kpr);
  safeUpdate('countSTOK', counts.stok);
  safeUpdate('countREKOM', counts.rekom);
  safeUpdate('countDISEWAKAN', counts.disewakan);
  safeUpdate('countUNKNOWN_NO_INDUK', counts.unknown_no_induk);
  safeUpdate('countUNKNOWN_WITH_INDUK', counts.unknown_with_induk);
  safeUpdate('totalAll', counts.total);

  return counts;
}

// Tampilkan panel statistik (fungsi lama - mungkin masih digunakan)
function showStatusPanel(data) {
  const panel = document.getElementById('statusPanel');
  if (!panel) return;

  // Update angka di panel
  if (data.summary) {
    document.getElementById('countKPR').textContent = data.summary.kpr || 0;
    document.getElementById('countSTOK').textContent = data.summary.stok || 0;
    document.getElementById('countREKOM').textContent = data.summary.rekom || 0;
    document.getElementById('countDISEWAKAN').textContent = data.summary.disewakan || 0;
    document.getElementById('totalAll').textContent = data.summary.total || 0;
  }

  // Tampilkan panel
  panel.style.display = 'block';
  isStatusMode = true;

  // Aktifkan tombol status
  const statusBtn = document.getElementById('statusKavling');
  if (statusBtn) statusBtn.classList.add('active');
}

// Nonaktifkan mode status
function resetStatusMode() {
  // Sembunyikan panel
  const panel = document.getElementById('statusPanel');
  if (panel) panel.style.display = 'none';

  // Nonaktifkan tombol
  const statusBtn = document.getElementById('statusKavling');
  if (statusBtn) statusBtn.classList.remove('active');

  isStatusMode = false;
  statusData = null;
  console.log('🔄 Mode status dinonaktifkan (warna tetap disimpan)');
}

// Ambil list blok berdasarkan kategori warna dari peta - DIPERBAIKI
function getKavlingListFromMap(type) {
  const kavlingList = [];
  const className = `kavling-status-${type}`;
  const allFrameElements = document.querySelectorAll('[id^="GA"], [id^="UJ"], [id^="KR"], [id^="M"], [id^="Blok"]');

  console.log(`🔍 Mencari kavling tipe ${type}, total frame: ${allFrameElements.length}`);

  allFrameElements.forEach(el => {
    if (el.id && el.id.trim() !== '') {
      // Untuk kategori "unknown", kita perlu menangani khusus
      if (type === 'unknown') {
        // Cek apakah elemen TIDAK memiliki kelas status apapun
        const hasStatus = el.classList.contains('kavling-status-kpr') ||
                         el.classList.contains('kavling-status-stok') ||
                         el.classList.contains('kavling-status-rekom') ||
                         el.classList.contains('kavling-status-disewakan') ||
                         el.classList.contains('kavling-status-unknown');

        if (!hasStatus) {
          kavlingList.push(el.id);
        }
      } 
      // Untuk kategori lain, cek kelas yang sesuai
      else if (el.classList.contains(className)) {
        kavlingList.push(el.id);
      }
    }
  });

  console.log(`📊 Ditemukan ${kavlingList.length} kavling untuk tipe ${type}`);
  if (kavlingList.length > 0) {
    console.log(`📝 Contoh kavling ${type}:`, kavlingList.slice(0, 5));
  }

  return kavlingList.sort();
}

// Download data per kategori - DIPERBAIKI
function showKavlingListByCategory(type) {
  const statusType = type.toLowerCase();
  const resultsBox = document.getElementById('kavlingResults');
  const modal = document.getElementById('kavlingModal');
  const excelBtn = document.getElementById('downloadExcelKavling');
  
  if (!modal || !resultsBox) return;
  
  const modalHeader = modal.querySelector('.modal-header h3');
  if (modalHeader) modalHeader.innerText = `🔍 Detail Kavling Status: ${statusType.toUpperCase()}`;
  
  modal.style.display = 'flex';
  
  resultsBox.innerHTML = `
    <div class="cert-loading">
      <div class="cert-loading-spinner"></div>
      <div style="color:#666;font-size:14px;margin-top:10px;">
        Mengambil data kavling ${statusType.toUpperCase()}...
      </div>
    </div>
  `;
  
  const baseData = (statusData && statusData.data) ? statusData.data : [];
  const legacyStatuses = ['kpr', 'stok', 'rekom', 'disewakan', 'unknown'];

  const data = baseData.filter(item => {
    if (legacyStatuses.includes(statusType)) {
      return (item.kategori || '').toLowerCase() === statusType;
    }
    return (item.imbCategory || '').toLowerCase() === statusType;
  });

  setTimeout(() => {
    if (!data || data.length === 0) {
      resultsBox.innerHTML = `
        <div style="padding:30px; text-align:center; color:#666;">
          Tidak ditemukan data dengan status "${statusType}"
        </div>
      `;
      if (excelBtn) excelBtn.style.display = 'none';
      return;
    }
    
    currentKavlingResults = data.map(item => ({
      kode: item.kode,
      skema: item.skema || '',
      tgl_ho: item.tgl_ho || '',
      kategori: item.kategori || '',
      searchTerm: statusType,
      searchType: `Status ${statusType.toUpperCase()}`
    }));
    
    if (excelBtn) excelBtn.style.display = 'inline-flex';

    let displayStatus = statusType.toUpperCase();
    if (displayStatus === 'KPR') displayStatus = 'KPR/TUNAI (SOLD)';

    let html = `<div class="cert-total-found">
      ✅ Ditemukan: <strong>${data.length}</strong> kavling dengan status: 
      <strong>${displayStatus}</strong>
    </div>`;

    data.forEach((item, index) => {
      html += `
        <div class="cert-result-item">
          <div style="font-weight:600; margin-bottom:8px; color:#2196f3; font-size:14px;">
            <span style="background:#e3f2fd; padding:2px 8px; border-radius:4px; margin-right:8px;">${index + 1}</span>
            Kavling: <strong>${item.kode}</strong>
          </div>
          
          <div style="font-size:13px; color:#666; margin-bottom:5px;">
            📋 Skema: ${item.skema || '-'}
          </div>
          
          ${item.tgl_ho ? `
          <div style="font-size:13px; color:#666; margin-bottom:10px;">
            📅 Tanggal HO: ${item.tgl_ho}
          </div>` : ''}
        </div>
      `;
    });

    resultsBox.innerHTML = html;
  }, 500);
}

// Ganti fungsi lama dengan yang baru
async function downloadKavlingData(type) {
  showKavlingListByCategory(type);
}

// Popup untuk menampilkan list blok dari peta - DIPERBAIKI
function showDownloadPopupFromMap(kavlingList, type) {
  // Hapus popup lama jika ada
  const oldPopup = document.querySelector('.kavling-popup');
  if (oldPopup) {
    document.body.removeChild(oldPopup);
  }

  // Buat popup baru
  const popup = document.createElement('div');
  popup.className = 'kavling-popup';

  let title = '';
  let description = '';

  // Sesuaikan judul berdasarkan tipe
  switch(type) {
    case 'kpr':
      title = 'KPR, TUNAI (SOLD)';
      description = 'Kavling yang sudah terjual (KPR/TUNAI)';
      break;
    case 'stok':
      title = 'STOK';
      description = 'Kavling yang masih tersedia (STOK)';
      break;
    case 'rekom':
      title = 'REKOM';
      description = 'Kavling rekomendasi';
      break;
    case 'disewakan':
      title = 'DISEWAKAN';
      description = 'Kavling yang disewakan';
      break;
    case 'unknown':
      title = 'TIDAK DIKETAHUI (PUTIH)';
      description = 'Kavling tanpa status informasi';
      break;
    default:
      title = type.toUpperCase();
      description = `Kavling dengan status: ${type}`;
  }

  let content = `
    <div class="download-info-header" style="margin-bottom:15px; padding:15px; background:#e8f5e9; border-radius:6px; text-align:center;">
      <div style="font-size:18px; font-weight:bold; color:#1b5e20;">${kavlingList.length} Kavling</div>
      <div style="font-size:14px; color:#666; margin-top:5px;" class="download-desc">${description}</div>
      <div style="font-size:12px; color:#999; margin-top:5px;" class="download-status-label">Status: <strong>${title}</strong></div>
    </div>

    <div style="margin-bottom:15px; display: flex; gap: 10px; justify-content: center;">
      <button onclick="copyToClipboard()" style="padding:10px 20px; background:#2196F3; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:600;">
        📋 Copy Semua
      </button>
      <button onclick="downloadAsCSV('${type}')" style="padding:10px 20px; background:#4CAF50; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:600;">
        📥 CSV
      </button>
      <button id="downloadExcelMap" style="padding:10px 20px; background:#2e7d32; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:600;">
        📊 Excel
      </button>
    </div>

    <div class="download-list-container" style="font-family:monospace; font-size:13px; line-height:1.8; background:#f5f5f5; padding:15px; border-radius:6px; max-height:400px; overflow-y:auto; border:1px solid #e0e0e0; color: #333;">
  `;

  if (kavlingList.length > 0) {
    kavlingList.forEach((kode, index) => {
      content += `<div class="download-item" style="padding: 3px 0;">${index + 1}. ${kode}</div>`;
    });
  } else {
    content += `<div style="text-align:center; padding:20px; color:#666;">Tidak ada data ditemukan</div>`;
  }

  content += `</div>`;

  popup.innerHTML = `
    <div class="kavling-popup-content" style="max-width:600px;">
      <div class="kavling-popup-header">
        <h3>📥 List Kavling: ${title}</h3>
        <button class="close-kavling-popup">&times;</button>
      </div>
      <div class="kavling-popup-body" id="downloadListBody">
        ${content}
      </div>
      <div class="kavling-popup-footer">
        <button class="kavling-close-btn">Tutup</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Tambahkan event listener untuk download Excel
  const excelBtn = popup.querySelector('#downloadExcelMap');
  if (excelBtn) {
    excelBtn.addEventListener('click', () => {
      generateExcelFromKavlingList(kavlingList, title);
    });
  }

  // Simpan list untuk copy
  window.currentDownloadList = kavlingList;

  // Event listeners untuk popup
  const closePopup = () => {
    document.body.removeChild(popup);
  };

  const closeBtn = popup.querySelector('.close-kavling-popup');
  const closeBtn2 = popup.querySelector('.kavling-close-btn');

  if (closeBtn) closeBtn.addEventListener('click', closePopup);
  if (closeBtn2) closeBtn2.addEventListener('click', closePopup);

  // Tutup jika klik di luar konten
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      closePopup();
    }
  });

  popup.style.display = 'flex';
}

// Fungsi untuk mapping nama status yang lebih deskriptif
function getStatusDisplayName(type) {
  const statusMap = {
    'kpr': 'KPR,TUNAI (SOLD)',
    'stok': 'Kavling Stok',
    'rekom': 'REKOM',
    'disewakan': 'Disewakan',
    'dipinjam': 'Dipinjam',
    'unknown': 'Status Belum ada data'
  };
  return statusMap[type] || type.toUpperCase();
}

// Fungsi untuk download sebagai CSV 
function downloadAsCSV(type) {
  if (!window.currentDownloadList || window.currentDownloadList.length === 0) {
    alert('Tidak ada data untuk didownload');
    return;
  }

  // Dapatkan nama status yang lebih deskriptif
  const statusDisplayName = getStatusDisplayName(type);

  // Buat header CSV dengan kolom tambahan
  let csvContent = "No,Kode Kavling,Status,Keterangan\n";

  // Tambahkan data
  window.currentDownloadList.forEach((kode, index) => {
    csvContent += `${index + 1},"${kode}","${statusDisplayName}",""\n`;
  });

  // Buat blob dan download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  // Buat nama file yang lebih informatif
  const fileName = `kavling_${type}_${new Date().toISOString().slice(0,10)}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log(`✅ CSV untuk ${type} berhasil didownload (${window.currentDownloadList.length} data)`);
}

// Copy list ke clipboard
function copyToClipboard() {
  if (window.currentDownloadList && window.currentDownloadList.length > 0) {
    const text = window.currentDownloadList.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      alert(`✅ ${window.currentDownloadList.length} kavling disalin ke clipboard!`);
    }).catch(err => {
      console.error('Gagal copy:', err);
      alert('Gagal menyalin. Coba secara manual.');
    });
  }
}

function showImbStatsPopup(type) {
  const statusType = (type || '').toLowerCase();
  const baseData = (statusData && statusData.data) ? statusData.data : [];
  const legacyStatuses = ['kpr', 'stok', 'rekom', 'disewakan', 'unknown'];

  const filtered = baseData.filter(item => {
    if (legacyStatuses.includes(statusType)) {
      if (statusType === 'unknown') {
        // If they click 'unknown' (legacy), show all unknown
        return (item.kategori || '').toLowerCase() === 'unknown';
      }
      return (item.kategori || '').toLowerCase() === statusType;
    }
    
    // Check new types: unknown_no_induk or unknown_with_induk
    if (statusType === 'unknown_no_induk' || statusType === 'unknown_with_induk') {
      if ((item.kategori || '').toLowerCase() !== 'unknown') return false;
      const raw = item.rawData || [];
      const refInduk = raw.length > 4 ? String(raw[4] || '').trim() : '';
      const noSgb = raw.length > 12 ? String(raw[12] || '').trim() : ''; // Kolom M
      const noInduk = raw.length > 15 ? String(raw[15] || '').trim() : ''; // Kolom P
      
      const hasCertificate = (refInduk !== '' && refInduk !== '-') || 
                            (noSgb !== '' && noSgb !== '-') || 
                            (noInduk !== '' && noInduk !== '-');
                            
      const targetType = hasCertificate ? 'unknown_with_induk' : 'unknown_no_induk';
      return statusType === targetType;
    }

    return (item.imbCategory || '').toLowerCase() === statusType;
  });

  const oldPopup = document.querySelector('.kavling-popup');
  if (oldPopup) {
    document.body.removeChild(oldPopup);
  }

  const popup = document.createElement('div');
  popup.className = 'kavling-popup';

  const titleMap = {
    'terjual_imb': 'Terjual dengan IMB/PBG/SLF',
    'terjual_no_imb': 'Terjual tanpa IMB/PBG/SLF',
    'stok_imb': 'Stok dengan IMB/PBG/SLF',
    'stok_no_imb': 'Stok belum ada IMB/PBG/SLF',
    'rekom_imb': 'Rekom dengan IMB/PBG/SLF',
    'rekom_no_imb': 'Rekom belum ada IMB/PBG/SLF',
    'tersewa_imb': 'Tersewa dengan IMB/PBG/SLF',
    'tersewa_no_imb': 'Tersewa tanpa IMB/PBG/SLF',
    'dipinjam_imb': 'Dipinjam dengan IMB/PBG/SLF',
    'dipinjam_no_imb': 'Dipinjam belum ada IMB/PBG/SLF',
    'unknown_no_induk': 'Tidak diketahui (tanpa sertifikat induk)',
    'unknown_with_induk': 'Tidak diketahui (dengan sertifikat induk)',
    'unknown': 'Tidak diketahui'
  };

  const displayTitle = titleMap[statusType] || statusType.toUpperCase();

  let rowsHtml = '';

  if (filtered.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="4" style="text-align:center; padding:12px; color:#666;">
          Tidak ada data kavling untuk kategori ini.
        </td>
      </tr>
    `;
  } else {
    rowsHtml = filtered.map((item, index) => {
      const raw = item.rawData || [];
      const nomorSertifikat = raw.length > 12 ? (raw[12] || '') : '';
      const nomorImb = raw.length > 31 ? (raw[31] || '') : '';
      const namaKavling = item.kode || '';
      const skema = item.skema || '';
      return `
        <tr>
          <td style="text-align:center; padding:6px 8px; border:1px solid #ddd;">${index + 1}</td>
          <td style="padding:6px 8px; border:1px solid #ddd;">${namaKavling}</td>
          <td style="padding:6px 8px; border:1px solid #ddd;">${nomorSertifikat}</td>
          <td style="padding:6px 8px; border:1px solid #ddd;">${nomorImb}</td>
          <td style="padding:6px 8px; border:1px solid #ddd;">${skema}</td>
        </tr>
      `;
    }).join('');
  }

  popup.innerHTML = `
    <div class="kavling-popup-content" style="max-width:720px;">
      <div class="kavling-popup-header">
        <h3>📊 Detail Statistik IMB: ${displayTitle}</h3>
        <button class="close-kavling-popup">&times;</button>
      </div>
      <div class="kavling-popup-body" style="padding:15px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="font-size:13px; color:#555;">
            Total: <strong>${filtered.length}</strong> kavling
          </div>
          <button id="downloadExcelImb" style="background:#2e7d32; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:5px;">
            <span>📊</span> Excel
          </button>
        </div>
        <div style="max-height:400px; overflow-y:auto; border:1px solid #e0e0e0; border-radius:8px;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:8px; border:1px solid #ddd; width:50px; text-align:center;">No</th>
                <th style="padding:8px; border:1px solid #ddd;">Nama Kavling</th>
                <th style="padding:8px; border:1px solid #ddd;">No. Sertifikat</th>
                <th style="padding:8px; border:1px solid #ddd;">No. IMB/PBG/SLF</th>
                <th style="padding:8px; border:1px solid #ddd;">Skema Penjualan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
      <div class="kavling-popup-footer">
        <button class="kavling-close-btn">Tutup</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Tambahkan event listener untuk download Excel
  const excelBtn = popup.querySelector('#downloadExcelImb');
  if (excelBtn) {
    excelBtn.addEventListener('click', () => {
      generateExcelFromImbStats(filtered, displayTitle);
    });
  }

  const closePopup = () => {
    if (popup && popup.parentNode) {
      document.body.removeChild(popup);
    }
  };

  const closeBtn = popup.querySelector('.close-kavling-popup');
  const closeBtn2 = popup.querySelector('.kavling-close-btn');

  if (closeBtn) closeBtn.addEventListener('click', closePopup);
  if (closeBtn2) closeBtn2.addEventListener('click', closePopup);

  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      closePopup();
    }
  });

  popup.style.display = 'flex';
}

// Popup untuk menampilkan data download
function showDownloadPopup(data, type) {
  // Hapus popup lama jika ada
  const oldPopup = document.querySelector('.kavling-popup');
  if (oldPopup) {
    document.body.removeChild(oldPopup);
  }

  // Buat popup baru
  const popup = document.createElement('div');
  popup.className = 'kavling-popup';

  let content = `<h3 style="margin-top:0;">Data ${type.toUpperCase()} (${data.count || 0} item)</h3>`;

  if (data.data && data.data.length > 0) {
    // Format tabel sederhana
    content += '<div style="overflow-x:auto;">';
    content += '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
    content += '<tr style="background:#f5f5f5;">';
    content += '<th style="padding:8px; border:1px solid #ddd; text-align:left;">No</th>';
    content += '<th style="padding:8px; border:1px solid #ddd; text-align:left;">Kode Kavling</th>';
    content += '<th style="padding:8px; border:1px solid #ddd; text-align:left;">Skema</th>';
    content += '<th style="padding:8px; border:1px solid #ddd; text-align:left;">Tanggal</th>';
    content += '<th style="padding:8px; border:1px solid #ddd; text-align:left;">Data</th>';
    content += '</tr>';

    data.data.forEach((item, index) => {
      const rowColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
      content += `<tr style="background:${rowColor};">`;
      content += `<td style="padding:8px; border:1px solid #ddd;">${index + 1}</td>`;
      content += `<td style="padding:8px; border:1px solid #ddd;"><strong>${item.kode || ''}</strong></td>`;
      content += `<td style="padding:8px; border:1px solid #ddd;">${item.skema || ''}</td>`;
      content += `<td style="padding:8px; border:1px solid #ddd;">${item.tanggal || ''}</td>`;
      content += `<td style="padding:8px; border:1px solid #ddd; font-family:monospace; font-size:12px;">${item.data || ''}</td>`;
      content += '</tr>';
    });

    content += '</table></div>';
  } else {
    content += '<p style="text-align:center; color:#666; padding:20px;">Tidak ada data</p>';
  }

  popup.innerHTML = `
    <div class="kavling-popup-content" style="max-width:800px;">
      <div class="kavling-popup-header">
        <h3>Download Data: ${type.toUpperCase()}</h3>
        <button class="close-kavling-popup">&times;</button>
      </div>
      <div class="kavling-popup-body">
        <div style="margin-bottom:15px; padding:10px; background:#e8f5e9; border-radius:6px;">
          Total data: <strong>${data.count || 0}</strong> kavling
        </div>
        ${content}
      </div>
      <div class="kavling-popup-footer">
        <button class="kavling-close-btn">Tutup</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Event listeners untuk popup
  const closePopup = () => {
    document.body.removeChild(popup);
  };

  const closeBtn = popup.querySelector('.close-kavling-popup');
  const closeBtn2 = popup.querySelector('.kavling-close-btn');

  if (closeBtn) closeBtn.addEventListener('click', closePopup);
  if (closeBtn2) closeBtn2.addEventListener('click', closePopup);

  // Tutup jika klik di luar konten
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      closePopup();
    }
  });

  // Tampilkan popup
  setTimeout(() => {
    popup.style.display = 'flex';
  }, 10);
}

// ===============================
// POPUP MANAGEMENT (ASLI)
// ===============================
function showKavlingPopup(address, result) {
  // Hapus popup lama jika ada
  const oldPopup = document.querySelector('.kavling-popup');
  if (oldPopup) {
    document.body.removeChild(oldPopup);
  }

  // Buat popup baru
  const popup = document.createElement('div');
  popup.className = 'kavling-popup';

  let statusClass = '';
  let statusText = '';
  let dataContent = '';
  let statusInfoContent = '';

  const key = (address || '').toString().trim().toUpperCase();
  const statusEntry = kavlingStatusIndex.get(key);
  if (statusEntry) {
    const kategori = (statusEntry.kategori || 'unknown').toLowerCase();
    const imbCategory = (statusEntry.imbCategory || '').toLowerCase();
    let kategoriLabel = '';
    if (kategori === 'kpr') kategoriLabel = 'KPR/TUNAI (Sudah terjual)';
    else if (kategori === 'stok') kategoriLabel = 'STOK (Masih tersedia)';
    else if (kategori === 'rekom') kategoriLabel = 'REKOM (Kavling rekomendasi)';
    else if (kategori === 'disewakan') kategoriLabel = 'DISEWAKAN';
    else if (kategori === 'dipinjam') kategoriLabel = 'DIPINJAM';
    else kategoriLabel = 'Status belum diketahui';
    let hasImbEffective = null;
    if (typeof statusEntry.hasImb === 'boolean') {
      hasImbEffective = statusEntry.hasImb;
    } else if (imbCategory.endsWith('_imb')) {
      hasImbEffective = true;
    } else if (imbCategory.endsWith('no_imb')) {
      hasImbEffective = false;
    }
    let imbLabel = '';
    if (hasImbEffective === true) {
      imbLabel = 'Sudah memiliki IMB/PBG/SLF';
    } else if (hasImbEffective === false) {
      imbLabel = 'Belum memiliki IMB/PBG/SLF';
    } else {
      imbLabel = 'Status IMB belum diketahui';
    }
    statusInfoContent = `
      <div style="margin-bottom:10px; padding:10px; border-radius:8px; background:#f5f5f5; font-size:13px; color:#333;">
        <div style="margin-bottom:4px;"><strong>Status Kavling Ini:</strong></div>
        <div style="margin-bottom:2px;">• Kategori: <strong>${kategoriLabel}</strong></div>
        <div>• Status IMB: <strong>${imbLabel}</strong></div>
      </div>
    `;
  }

  // Set berdasarkan status
  switch (result.status) {
    case 'loading':
      statusClass = 'kavling-status-loading';
      statusText = '⏳ Mencari data...';
      dataContent = `
        <div style="text-align:center;padding:40px 20px;">
          <div class="loading-spinner"></div>
          <div class="loading-text">
            Mencari data untuk: <strong>${address}</strong>
            <span class="loading-dots"></span>
          </div>
          <div style="font-size:12px;color:#999;margin-top:15px;">
            Mohon tunggu, proses mungkin memakan waktu hingga 30 detik
          </div>
        </div>
      `;
      popup.classList.add('kavling-popup-loading');
      break;

    case 'success':
      statusClass = 'kavling-status-success';
      statusText = '✅ Data ditemukan';
      if (result.data && result.data.trim() !== '') {
        // Normalisasi data: hapus spasi berlebih di awal tiap baris
        const normalizedData = result.data.trim().split('\n').map(line => line.trim()).join('\n');
        dataContent = `<div class="kavling-data-content">${normalizedData}</div>`;
      } else {
        dataContent = '<div style="text-align:center;padding:30px;color:#666;">Data kosong</div>';
      }
      break;

    case 'empty':
      statusClass = 'kavling-status-empty';
      statusText = 'ℹ️ Data ditemukan tetapi kolom kosong';
      dataContent = '<div style="text-align:center;padding:30px;color:#666;">Tidak ada data di kolom AI</div>';
      break;

    case 'notfound':
      statusClass = 'kavling-status-notfound';
      statusText = '🔍 Data tidak ditemukan';
      dataContent = `
        <div style="text-align:center;padding:20px;">
          <div style="margin-bottom:10px;color:#e65100;">⚠️ Kode <strong>${address}</strong> tidak terdaftar</div>
          <div style="color:#757575;font-size:13px;">Periksa kembali penulisan kode</div>
        </div>
      `;
      break;

    case 'error':
      statusClass = 'kavling-status-error';
      statusText = '❌ Kesalahan';
      dataContent = `
        <div style="text-align:center;padding:20px;">
          <div style="margin-bottom:10px;color:#c62828;">Gagal mengambil data</div>
          <div style="color:#757575;font-size:13px;">${result.message || 'Terjadi kesalahan tidak diketahui'}</div>
        </div>
      `;
      break;

    default:
      statusClass = 'kavling-status-loading';
      statusText = '⏳ Memproses...';
      dataContent = `
        <div style="text-align:center;padding:40px 20px;">
          <div class="loading-spinner"></div>
          <div class="loading-text">
            Mohon tunggu<span class="loading-dots"></span>
          </div>
        </div>
      `;
      popup.classList.add('kavling-popup-loading');
  }

  popup.innerHTML = `
    <div class="kavling-popup-content">
      <div class="kavling-popup-header">
        <h3>Hasil Pencarian: ${address}</h3>
        <button class="close-kavling-popup">&times;</button>
      </div>
      <div class="kavling-popup-body">
        ${statusText ? `<div class="${statusClass}">${statusText}</div>` : ''}
        ${statusInfoContent}
        ${dataContent}
      </div>
      ${result.status !== 'loading' ? `
      <div class="kavling-popup-footer">
        <button class="kavling-close-btn">Tutup</button>
      </div>
      ` : ''}
    </div>
  `;

  // Tambahkan ke body
  document.body.appendChild(popup);

  // Event listeners untuk popup (kecuali jika loading)
  if (result.status !== 'loading') {
    const closeBtn = popup.querySelector('.close-kavling-popup');
    const closeBtn2 = popup.querySelector('.kavling-close-btn');

    const closePopup = () => {
      document.body.removeChild(popup);
    };

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    if (closeBtn2) closeBtn2.addEventListener('click', closePopup);

    // Tutup jika klik di luar konten
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        closePopup();
      }
    });
  }

  // Tampilkan popup
  setTimeout(() => {
    popup.style.display = 'flex';
  }, 10);
}

function closeKavlingPopup() {
  const popup = document.querySelector('.kavling-popup');
  if (popup) {
    document.body.removeChild(popup);
  }
}

// Tombol-tombol pencarian modal
const btnDownloadExcel = document.getElementById('downloadExcel');

// Fungsi untuk toggle visibilitas tombol download Excel
function toggleDownloadExcelButton() {
  const resultsBox = document.getElementById('certificateResults');
  const hasResults = resultsBox.querySelectorAll('.cert-result-item').length > 0;
  if (btnDownloadExcel) {
    btnDownloadExcel.style.display = hasResults ? 'inline-flex' : 'none';
  }
}

// Event listener untuk download Excel
if (btnDownloadExcel) {
  btnDownloadExcel.addEventListener('click', generateExcelFromResults);
}

function parseDataContent(content) {
  const rows = {};
  if (!content) return rows;
  
  // Pisahkan berdasarkan baris baru
  const lines = content.split('\n');
  lines.forEach(line => {
    if (line.includes('=')) {
      const parts = line.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim(); // Ambil sisanya jika ada tanda = lain
      if (key) rows[key] = val;
    }
  });
  return rows;
}

async function generateExcelFromResults() {
  try {
    if (typeof XLSX === 'undefined') {
      alert('Library Excel belum dimuat. Silakan tunggu sebentar atau muat ulang halaman.');
      return;
    }

    const resultsBox = document.getElementById('certificateResults');
    const items = resultsBox.querySelectorAll('.cert-result-item');
    
    if (items.length === 0) {
      alert('Tidak ada data untuk di-download.');
      return;
    }

    btnDownloadExcel.disabled = true;
    const originalHTML = btnDownloadExcel.innerHTML;
    btnDownloadExcel.innerHTML = '<span>⏳</span>...';

    const finalData = [];
    items.forEach(item => {
      const row = {};
      
      // Kavling
      const header = item.querySelector('div[style*="font-weight:bold"]');
      if (header) {
        row['KAVLING'] = header.innerText.replace('KAVLING:', '').trim();
      }

      // Grid data
      const details = item.querySelectorAll('div[style*="display:grid"] > div');
      for (let i = 0; i < details.length; i += 2) {
        const key = details[i].innerText.replace(':', '').trim();
        const val = details[i+1].innerText.trim();
        row[key] = val;
      }
      
      // Parse isi konten "= "
      const contentEl = item.querySelector('div[style*="font-family: \'Consolas\'"]');
      if (contentEl) {
        const parsed = parseDataContent(contentEl.innerText);
        Object.assign(row, parsed);
      }

      finalData.push(row);
    });

    const worksheet = XLSX.utils.json_to_sheet(finalData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    
    // Simpan file dengan nama dinamis berdasarkan hasil pencarian
    const totalFoundEl = document.getElementById('certificateResults').querySelector('.cert-total-found');
    let fileName = `btu_export_${new Date().getTime()}.xlsx`;
    
    if (totalFoundEl) {
      // Ambil teks pencarian dan jumlah hasil (contoh: "3 hasil untuk Nama SHM: UMANG GIANTO")
      let cleanTitle = totalFoundEl.innerText
        .replace('✅', '')
        .replace('Ditemukan:', 'Ditemukan')
        .replace(/["']/g, '')
        .trim();
      
      // Ganti karakter yang tidak aman untuk nama file (spasi, dsb menjadi underscore)
      const safeName = cleanTitle.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
      fileName = `${safeName}.xlsx`;
    }

    XLSX.writeFile(workbook, fileName);
    
    btnDownloadExcel.disabled = false;
    btnDownloadExcel.innerHTML = originalHTML;
  } catch (error) {
    console.error('Excel error:', error);
    btnDownloadExcel.disabled = false;
    btnDownloadExcel.innerHTML = '<span>📊</span> Download Excel';
  }
}

// Hapus fungsi Word yang tidak digunakan lagi
// function generateWordFromResults() { ... }

// ===============================
// FUNGSI PENCARIAN SERTIFIKAT
// ===============================
async function searchCertificateNew(certNumber, certType, displayName) {
  if (!certNumber) {
    alert(`Mohon masukkan ${displayName}`);
    return;
  }

  console.log(`🔍 Mencari ${displayName}:`, certNumber);

  // Tampilkan loading di modal
  const resultsBox = document.getElementById('certificateResults');
  resultsBox.innerHTML = `
    <div class="cert-loading">
      <div class="cert-loading-spinner"></div>
      <div style="color:#666;font-size:14px;margin-top:10px;">
        Mencari ${displayName}: <strong>${certNumber}</strong>
        <br><span style="font-size:12px;color:#999;">Mohon tunggu...</span>
      </div>
    </div>
  `;
  toggleDownloadExcelButton();

  try {
    // Cek cache dulu
    const cacheKey = `${certType}:${certNumber.toUpperCase()}`;
    const cached = certSearchCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log('⚡ HIT CACHE SERTIFIKAT:', cacheKey);
      displayCertificateResults(cached.data, certNumber, certType, displayName);
      return;
    }

    // Panggil API database sertifikat
    const encodedCert = encodeURIComponent(certNumber);
    const url = `${CERT_API_URL}?certificate=${encodedCert}&type=${certType}&_t=${Date.now()}`;

    console.log('🌐 Mengakses API Sertifikat:', url);

    const res = await fetch(url);
    const data = await res.json();

    console.log('📦 Response API Sertifikat:', data);

    // Simpan ke cache jika sukses
    if (data.status === 'success') {
      certSearchCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });
      saveCertCache();
    }

    // Tampilkan hasil
    displayCertificateResults(data, certNumber, certType, displayName);
    toggleDownloadExcelButton();

  } catch (error) {
    console.error(`❌ Error mencari ${displayName}:`, error);

    let errorMessage = 'Gagal terhubung ke server';
    if (error.name === 'AbortError') {
      errorMessage = 'Timeout: Server tidak merespons';
    } else if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Gagal terhubung. Periksa koneksi internet.';
    } else {
      errorMessage = `Error: ${error.message}`;
    }

    const resultsBox = document.getElementById('certificateResults');
    resultsBox.innerHTML = `
      <div style="padding:20px;text-align:center;color:#c62828;">
        <div style="font-size:16px;margin-bottom:10px;">❌ ${errorMessage}</div>
        <div style="font-size:14px;">Coba refresh halaman atau coba lagi nanti</div>
      </div>
    `;
  }
}

function displayCertificateResults(data, certNumber, certType, displayName) {
  const resultsBox = document.getElementById('certificateResults');

  if (data.status === 'success' && data.results && data.results.length > 0) {
    let html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <!-- JUMLAH DATA DITEMUKAN (BOLD & BESAR) -->
        <div class="cert-total-found">
          ✅ Ditemukan: <strong>${data.totalFound}</strong> hasil untuk 
          <strong>${displayName}: "${certNumber}"</strong>
        </div>
    `;

    // Tampilkan semua hasil
    data.results.forEach((result, index) => {
      const nomorDisplay = certType === 'nama_shm' ? result.nama : result.nomor;
      html += `
        <div class="cert-result-item">
          <div style="font-weight:600; margin-bottom:8px; color:#2196f3; font-size:14px;">
            <span style="background:#e3f2fd; padding:2px 8px; border-radius:4px; margin-right:8px;">${index + 1}</span>
            ${certType === 'nama_shm' ? 'Nama' : 'Nomor'}: <strong>${nomorDisplay}</strong>
          </div>

          ${result.nama && certType !== 'nama_shm' ? 
            `<div style="font-size:13px; color:#666; margin-bottom:8px;">
               👤 <strong>Nama:</strong> ${result.nama}
             </div>` : ''}

          <div style="font-size:12px; color:#999; margin-bottom:10px;">
            📍 <strong>Baris database:</strong> ${result.row}
          </div>
      `;

      if (result.data && result.data.trim() !== '') {
        html += `
          <div style="font-family: 'Consolas', 'Monaco', 'Courier New', monospace; 
                     font-size:12px; line-height:1.5; white-space:pre-wrap; 
                     background:#f9f9f9; padding:12px; border-radius:6px; 
                     border:1px dashed #ddd; margin-top:8px;">
            ${result.data.trim()}
          </div>
        `;
      } else {
        html += `
          <div style="text-align:center; padding:15px; color:#757575; font-style:italic; 
                     background:#f5f5f5; border-radius:6px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            📭 Kolom AI kosong untuk data ini
          </div>
        `;
      }

      html += `</div>`;
    });

    html += `</div>`;
    resultsBox.innerHTML = html;

  } else if (data.status === 'not_found') {
    resultsBox.innerHTML = `
      <div style="padding:30px; text-align:center; color:#e65100; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="font-size:18px; margin-bottom:15px; font-weight:600;">
          🔍 ${displayName} tidak ditemukan
        </div>
        <div style="font-size:15px; margin-bottom:20px; background:#fff3e0; padding:12px; border-radius:6px;">
          ${certType === 'nama_shm' ? 'Nama' : 'Nomor'}: <strong>${certNumber}</strong>
        </div>
        <div style="font-size:14px; color:#757575; background:#f5f5f5; padding:12px; border-radius:6px;">
          Periksa kembali ${certType === 'nama_shm' ? 'nama' : 'nomor'} yang dimasukkan
        </div>
      </div>
    `;
  } else {
    resultsBox.innerHTML = `
      <div style="padding:30px; text-align:center; color:#c62828; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="font-size:18px; margin-bottom:15px; font-weight:600;">
          ❌ Terjadi kesalahan
        </div>
        <div style="font-size:14px; background:#ffebee; padding:15px; border-radius:6px;">
          ${data.message || 'Gagal mengambil data'}
        </div>
      </div>
    `;
  }
}

// ===============================
// FUNGSI UTAMA: AMBIL DATA KAVLING DARI API (DENGAN CACHE)
// ===============================
async function fetchDataForAddress(address) {
  if (!address || !address.trim()) {
    console.log('❌ Address kosong');
    return;
  }

  const cleanAddress = address.trim().toUpperCase();
  console.log('🔍 Mencari data kavling untuk:', cleanAddress);

  const statusEntry = kavlingStatusIndex.get(cleanAddress);
  if (statusEntry && Object.prototype.hasOwnProperty.call(statusEntry, 'ai')) {
    const ai = statusEntry.ai || '';
    console.log('⚡ HIT KAVLNG STATUS CACHE:', cleanAddress);
    showKavlingPopup(cleanAddress, {
      status: ai ? 'success' : 'empty',
      data: ai,
      message: ai ? 'Data ditemukan (Cache Status Kavling)' : 'Data ditemukan, kolom AI kosong (Cache Status Kavling)'
    });
    return;
  }

  const dbKey = normalizeCertId(cleanAddress);
  const dbResult = certificateDB.get(dbKey);
  if (dbResult) {
    console.log('⚡ HIT DATABASE LOKAL:', cleanAddress);
    showKavlingPopup(cleanAddress, {
      status: dbResult.data ? 'success' : 'empty',
      data: dbResult.data || '',
      message: 'Data ditemukan (Local DB)'
    });
    return;
  }

  // Tampilkan loading di popup (status: 'loading')
  showKavlingPopup(cleanAddress, { 
    status: 'loading',
    message: 'Sedang mencari data...'
  });

  // 2. CEK CACHE PENCARIAN (Per Query)
  const cached = searchCache.get(cleanAddress);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    console.log('⚡ HIT CACHE KAVLING:', cleanAddress);
    showKavlingPopup(cleanAddress, {
      status: 'success',
      data: cached.data,
      message: 'Data ditemukan (Cached)'
    });
    return;
  }

  try {
    // Encode address untuk URL
    const encodedAddress = encodeURIComponent(cleanAddress);
    const url = `${API_URL}?address=${encodedAddress}`;

    console.log('🌐 Mengambil data kavling dari:', url);

    // Tambahkan timestamp untuk menghindari cache
    const fetchUrl = url + '&_t=' + Date.now();

    // Fetch data dengan timeout 40 DETIK
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);

    const res = await fetch(fetchUrl, { 
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    console.log('📊 Status respons:', res.status, res.statusText);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    // Parse JSON
    const data = await res.json();
    console.log('📦 Data kavling diterima:', data);

    // SIMPAN KE CACHE jika success
    if (data.status === 'success' && data.data) {
      console.log('💾 Menyimpan kavling ke cache:', cleanAddress);
      searchCache.set(cleanAddress, {
        data: data.data || '',
        timestamp: Date.now()
      });
      saveSearchCache();
    }

    // HANDLE BERDASARKAN STATUS DARI API
    // Coba dapatkan rawData dari response API
    let apiRawData = [];
    if (data && data.results && Array.isArray(data.results) && data.results.length > 0) {
      apiRawData = data.results[0].rawData || [];
    } else if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
      // Cari item yang cocok dengan cleanAddress di data.data
      const matchedItem = data.data.find(item => (item.kode || '').toString().trim().toUpperCase() === cleanAddress);
      if (matchedItem && matchedItem.rawData) {
        apiRawData = matchedItem.rawData;
      }
    }
    
    switch (data.status) {
      case 'success':
      case 'empty':
        showKavlingPopup(cleanAddress, { 
          status: 'success',
          message: data.message || 'Data ditemukan',
          data: data.data || '',
          rawData: apiRawData
        });
        break;

      case 'not_found':
        showKavlingPopup(cleanAddress, { 
          status: 'notfound',
          message: data.message || 'Kode tidak ditemukan'
        });
        break;

      case 'error':
        showKavlingPopup(cleanAddress, { 
          status: 'error', 
          message: data.message || 'Error dari server'
        });
        break;

      default:
        showKavlingPopup(cleanAddress, { 
          status: 'error', 
          message: 'Format respons tidak dikenal'
        });
    }

  } catch (err) {
    console.error('❌ Error fetch data kavling:', err);

    // Deteksi jenis error
    let errorMessage = 'Gagal mengambil data';

    if (err.name === 'AbortError') {
      errorMessage = 'Timeout: Server tidak merespons dalam 40 detik';
    } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      errorMessage = 'Gagal terhubung ke server. Periksa koneksi internet.';
    } else if (err.message.includes('CORS')) {
      errorMessage = 'Error CORS. Coba deploy ulang Google Apps Script.';
    } else {
      errorMessage = `Error: ${err.message}`;
    }

    showKavlingPopup(cleanAddress, { 
      status: 'error', 
      message: errorMessage 
    });
  }
}

// FUNGSI GENERATE EXCEL DARI HASIL KAVLING
async function generateExcelFromKavlingResults() {
  try {
    if (typeof XLSX === 'undefined') {
      alert('Library Excel belum dimuat. Silakan tunggu sebentar atau muat ulang halaman.');
      return;
    }
    
    if (currentKavlingResults.length === 0) {
      alert('Tidak ada data untuk di-download.');
      return;
    }
    
    const excelBtn = document.getElementById('downloadExcelKavling');
    const originalHTML = excelBtn ? excelBtn.innerHTML : '<span>📊</span> Excel';
    if (excelBtn) {
      excelBtn.disabled = true;
      excelBtn.innerHTML = '<span>⏳</span>...';
    }
    
    const finalData = [];
    
    // Format data untuk Excel
    currentKavlingResults.forEach((item, index) => {
      finalData.push({
        'No': index + 1,
        'Kode Kavling': item.kode || '',
        'Skema': item.skema || '',
        'Tanggal HO': item.tgl_ho || '',
        'Kategori': item.kategori || ''
      });
    });
    
    const worksheet = XLSX.utils.json_to_sheet(finalData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Kavling");
    
    // Generate nama file
    const searchType = (currentKavlingResults[0]?.searchType || 'Detail').replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
    const searchTerm = (currentKavlingResults[0]?.searchTerm || 'Export').toUpperCase();
    const fileName = `Laporan_Kavling_${searchTerm}_${new Date().toISOString().slice(0,10)}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);
    
    if (excelBtn) {
      excelBtn.disabled = false;
      excelBtn.innerHTML = originalHTML;
    }
    
    console.log(`✅ Excel kavling berhasil didownload (${currentKavlingResults.length} data)`);
    
  } catch (error) {
    console.error('Excel kavling error:', error);
    const excelBtn = document.getElementById('downloadExcelKavling');
    if (excelBtn) {
      excelBtn.disabled = false;
      excelBtn.innerHTML = '<span>📊</span> Excel';
    }
    alert('Gagal membuat file Excel. Error: ' + error.message);
  }
}

// FUNGSI GENERATE EXCEL KHUSUS STATISTIK IMB
async function generateExcelFromImbStats(data, title) {
  try {
    if (typeof XLSX === 'undefined') {
      alert('Library Excel belum dimuat. Silakan tunggu sebentar atau muat ulang halaman.');
      return;
    }
    
    if (!data || data.length === 0) {
      alert('Tidak ada data untuk di-download.');
      return;
    }
    
    const excelBtn = document.getElementById('downloadExcelImb');
    if (excelBtn) {
      excelBtn.disabled = true;
      excelBtn.innerHTML = '<span>⏳</span>...';
    }
    
    const finalData = [];
    
    // Format data untuk Excel
    data.forEach((item, index) => {
      const raw = item.rawData || [];
      const nomorSertifikat = raw.length > 12 ? (raw[12] || '') : '';
      const nomorImb = raw.length > 31 ? (raw[31] || '') : '';
      
      finalData.push({
        'No': index + 1,
        'Nama Kavling': item.kode || '',
        'No. Sertifikat': nomorSertifikat,
        'No. IMB/PBG/SLF': nomorImb,
        'Skema Penjualan': item.skema || ''
      });
    });
    
    const worksheet = XLSX.utils.json_to_sheet(finalData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data IMB");
    
    // Generate nama file
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
    const fileName = `Laporan_IMB_${safeTitle}_${new Date().toISOString().slice(0,10)}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);
    
    if (excelBtn) {
      excelBtn.disabled = false;
      excelBtn.innerHTML = '<span>📊</span> Excel';
    }
    
    console.log(`✅ Excel IMB berhasil didownload (${data.length} data)`);
    
  } catch (error) {
    console.error('Excel IMB error:', error);
    alert('Gagal membuat file Excel. Error: ' + error.message);
    const excelBtn = document.getElementById('downloadExcelImb');
    if (excelBtn) {
      excelBtn.disabled = false;
      excelBtn.innerHTML = '<span>📊</span> Excel';
    }
  }
}

// FUNGSI GENERATE EXCEL DARI DAFTAR KAVLING (List Nama Saja)
async function generateExcelFromKavlingList(list, title) {
  try {
    if (typeof XLSX === 'undefined') {
      alert('Library Excel belum dimuat. Silakan tunggu sebentar atau muat ulang halaman.');
      return;
    }
    
    if (!list || list.length === 0) {
      alert('Tidak ada data untuk di-download.');
      return;
    }
    
    const finalData = list.map((kode, index) => ({
      'No': index + 1,
      'Kode Kavling': kode
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(finalData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daftar Kavling");
    
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
    const fileName = `Daftar_Kavling_${safeTitle}_${new Date().toISOString().slice(0,10)}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);
    console.log(`✅ Excel list berhasil didownload (${list.length} data)`);
    
  } catch (error) {
    console.error('Excel list error:', error);
    alert('Gagal membuat file Excel. Error: ' + error.message);
  }
}

// ===============================
// DOM READY
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  // Load full certificate database background
  loadFullCertificateDatabase();
  preloadKavlingStatusData();

  const map = document.getElementById('map');
  const searchInput = document.getElementById('search');
  const resultsBox = document.getElementById('search-results');
  const resetBtn = document.getElementById('resetZoom');
// Di dalam DOMContentLoaded, tambahkan:
// Event listener untuk download Excel kavling
document.getElementById('downloadExcelKavling')?.addEventListener('click', generateExcelFromKavlingResults);
  searchInput.disabled = true;

  // ===============================
  // LOAD SVG DENGAN CACHE
  // ===============================
  function setupSVG(container) {
    const svg = container.querySelector('svg');
    if (!svg) return;

    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Setup viewbox
    try {
      originalViewBox = svg.getAttribute('viewBox');
      if (!originalViewBox) {
        const b = svg.getBBox();
        originalViewBox = `${b.x} ${b.y} ${b.width} ${b.height}`;
        svg.setAttribute('viewBox', originalViewBox);
      }
      viewBoxState = parseViewBox(originalViewBox);
    } catch (e) {
      console.warn("ViewBox error:", e);
      originalViewBox = "0 0 1000 1000";
      svg.setAttribute('viewBox', originalViewBox);
      viewBoxState = parseViewBox(originalViewBox);
    }

    // Indexing kavling
    const ids = container.querySelectorAll('[id]');
    kavlingIndex = [];
    elementMap.clear(); // Reset map
    const seen = new Set();

    ids.forEach(el => {
      const id = el.id.trim().toUpperCase();
      
      // Masukkan ke map untuk lookup cepat (termasuk normalized key)
      elementMap.set(id, el);
      const normalizedId = id.replace(/[-_]/g, '');
      if (normalizedId !== id) {
        elementMap.set(normalizedId, el);
      }

      if (id && /^(GA|UJ|KR|M|BLOK)/.test(id) && !seen.has(id)) {
        seen.add(id);
        kavlingIndex.push(id);
      }
    });

    kavlingIndex.sort((a, b) => a.localeCompare(b, 'id'));
    isSvgLoaded = true;
  }

  // Gunakan cache jika sudah pernah load
  if (svgCache) {
    map.innerHTML = svgCache;
    setupSVG(map);
    searchInput.disabled = false;
  } else {
    // Load SVG dengan timeout
    const loadTimeout = setTimeout(() => {
      searchInput.placeholder = "Memuat peta...";
      document.body.classList.add('loading');
    }, 500);

    // Cek versi SVG di localStorage untuk cache invalidation manual jika diperlukan nanti
    const svgVersion = 'v1.0'; 
    
    fetch('sitemap.svg', { cache: 'default' })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(svgText => {
        clearTimeout(loadTimeout);
        document.body.classList.remove('loading');
        svgCache = svgText;
        map.innerHTML = svgText;
        setupSVG(map);
        searchInput.disabled = false;
        searchInput.placeholder = "Cari kavling...";
      })
      .catch(err => {
        clearTimeout(loadTimeout);
        document.body.classList.remove('loading');
        console.error("Gagal memuat SVG:", err);
        searchInput.placeholder = "Gagal memuat peta";
        
        let errorMsg = 'Gagal memuat peta. Silakan refresh halaman.';
        if (window.location.protocol === 'file:') {
           errorMsg = '<strong>Gagal memuat peta (CORS Error)</strong><br><br>' + 
                      'Browser memblokir akses file SVG karena dibuka langsung (file://).<br>' +
                      'Mohon buka menggunakan <strong>Local Server</strong> (misal: Live Server di VSCode).';
        } else {
           errorMsg += '<br><small>' + err.message + '</small>';
        }

        map.innerHTML = `<div style="padding:40px;text-align:center;color:#c62828;line-height:1.6">${errorMsg}</div>`;
      });
  }

  // ===============================
  // DOWNLOAD MAP TO PDF (A3)
  // ===============================
  document.getElementById('downloadMap')?.addEventListener('click', async function() {
    const btn = this;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Mengolah PDF...';

    try {
      // Tunggu sebentar agar browser melepas memori
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const svgElement = document.querySelector('#map svg');
      if (!svgElement) throw new Error('Elemen peta (SVG) belum dimuat.');

      // ==========================================
      // METODE LIGHTWEIGHT: SVG DIRECT RENDER
      // ==========================================
      // Metode ini jauh lebih ringan daripada html2canvas dan mencegah "Force Close"
      
      const rect = svgElement.getBoundingClientRect();
      const width = rect.width || 1000;
      const height = rect.height || 800;
      
      // Clone SVG agar kita bisa memodifikasinya tanpa merusak tampilan asli
      const clonedSvg = svgElement.cloneNode(true);
      clonedSvg.setAttribute('width', width);
      clonedSvg.setAttribute('height', height);
      
      // Masukkan semua style CSS penting ke dalam SVG agar warna tetap muncul
      const style = document.createElement('style');
      style.textContent = `
        svg { background-color: #ffffff !important; }
        .kavling-status-kpr { fill: grey !important; }
        .kavling-status-kpr-no-imb { fill: lightgrey !important; }
        .kavling-status-stok { fill: #2ecc71 !important; }
        .kavling-status-stok-no-imb { fill: #c6f7c6ff !important; }
        .kavling-status-rekom { fill: #9c27b0 !important; }
        .kavling-status-rekom-no-imb { fill: #9c27b0 !important; }
        .kavling-status-disewakan { fill: #42A5F5 !important; }
        .kavling-status-disewakan-no-imb { fill: #1E88E5 !important; }
        .kavling-status-dipinjam { fill: #26a69a !important; }
        .kavling-status-dipinjam-no-imb { fill: #4db6ac !important; }
        .kavling-status-unknown-no-induk { fill: red !important; }
        .kavling-status-unknown-with-induk { fill: white !important; }
        path, rect, polygon, circle { stroke: #000000 !important; stroke-width: 1.2px !important; shape-rendering: geometricPrecision !important; }
        text { font-family: Arial, sans-serif !important; font-weight: bold !important; text-rendering: optimizeLegibility !important; }
        .on-hand-overlay rect, .on-hand-overlay path, .on-hand-overlay polygon { fill: url(#onHandHatch) !important; }
        .unknown-hatch-overlay rect, .unknown-hatch-overlay path, .unknown-hatch-overlay polygon { fill: url(#unknownHatch) !important; }
      `;
      clonedSvg.insertBefore(style, clonedSvg.firstChild);

      // Serialize SVG ke XML
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      // Render ke Canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const scale = 6; // Skala 6 untuk kualitas terbaik
      canvas.width = width * scale;
      canvas.height = height * scale;
      
      // Fill background PUTIH (Sesuai Layar)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = new Image();
      const imgLoadPromise = new Promise((resolve, reject) => {
        img.onload = () => {
          // Gunakan smoothing agar garis tidak pecah
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve();
        };
        img.onerror = () => reject(new Error('Gagal memproses gambar SVG'));
      });

      img.src = url;
      await imgLoadPromise;

      // Konversi ke JPEG dengan kualitas maksimal
      let imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      // Cleanup
      URL.revokeObjectURL(url);
      canvas.width = 0;
      canvas.height = 0;
      
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a3',
        compress: false 
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Alokasi ruang: Peta besar di seluruh halaman dengan margin untuk frame
      const margin = 10;
      const ratio = Math.min((pdfWidth - margin * 2) / width, (pdfHeight - margin * 2) / height);
      const finalWidth = width * ratio;
      const finalHeight = height * ratio;
      
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      // Draw frame (border) around the map
      pdf.setDrawColor(0,0,0);
      pdf.setLineWidth(0.5);
      pdf.rect(margin, margin, pdfWidth - margin*2, pdfHeight - margin*2);

      pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight, undefined, 'SLOW');
      imgData = null;

      // Tanggal cetak di kanan bawah
      pdf.setFontSize(10); 
      pdf.setTextColor(50, 50, 50); 
      const now = new Date();
      const dateStr = now.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      pdf.text(`Dicetak pada: ${dateStr}`, pdfWidth - margin - 50, pdfHeight - margin - 2, { align: 'right' });
      
      const fileNameDate = now.toLocaleDateString('id-ID').replace(/\//g, '-');
      const fileName = `Peta_BTU_${fileNameDate}.pdf`;
      
      pdf.save(fileName);
      
      btn.innerHTML = '<span>✅</span> Selesai!';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('Download error:', error);
      alert('Gagal mendownload peta: ' + (error.message || 'Terjadi kesalahan tidak diketahui'));
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });

  // ===============================
  // DOWNLOAD EXCEL STATISTIK
  // ===============================
  document.getElementById('downloadExcelStatistik')?.addEventListener('click', () => {
    const btn = document.getElementById('downloadExcelStatistik');
    const originalText = btn.innerHTML;
    
    try {
      btn.innerHTML = '<span>⏳</span> Memproses Data...';
      btn.disabled = true;

      // 1. Ambil data asli dari API (cached di global variable jika ada)
      // Jika menggunakan variabel global 'baseData' atau 'lastFetchedData'
      const dataToProcess = window.lastFetchedKavlingData || [];
      if (!dataToProcess || dataToProcess.length === 0) {
        throw new Error('Data belum dimuat dari API. Silakan tunggu atau refresh.');
      }

      // 2. Identifikasi kategori yang sedang aktif (tercentang)
      const activeFilters = {
        'stok_imb': localStorage.getItem('filter_stok_imb') !== 'false',
        'stok_no_imb': localStorage.getItem('filter_stok_no_imb') !== 'false',
        'tersewa_imb': localStorage.getItem('filter_tersewa_imb') !== 'false',
        'tersewa_no_imb': localStorage.getItem('filter_tersewa_no_imb') !== 'false',
        'dipinjam_imb': localStorage.getItem('filter_dipinjam_imb') !== 'false',
        'dipinjam_no_imb': localStorage.getItem('filter_dipinjam_no_imb') !== 'false',
        'terjual_imb': localStorage.getItem('filter_terjual_imb') !== 'false',
        'terjual_no_imb': localStorage.getItem('filter_terjual_no_imb') !== 'false',
        'rekom_imb': localStorage.getItem('filter_rekom_imb') !== 'false',
        'rekom_no_imb': localStorage.getItem('filter_rekom_no_imb') !== 'false',
        'unknown_no_induk': localStorage.getItem('filter_unknown_no_induk') !== 'false',
        'unknown_with_induk': localStorage.getItem('filter_unknown_with_induk') !== 'false',
        'on_hand': localStorage.getItem('onHandFilter') === 'true'
      };

      const excelData = [];
      
      // 3. Proses setiap kavling sesuai kriteria
      dataToProcess.forEach(item => {
        const raw = item.rawData || [];
        const skema = (item.skema || '').toUpperCase();
        
        // --- LOGIKA PENENTUAN KATEGORI YANG PERSIS DENGAN PEWARNAAN ---
        let baseKategori = (item.kategori || 'unknown').toLowerCase();
        
        // Re-evaluasi kategori berdasarkan Skema Jual (Kolom I / Index 8)
        const skemaJual = raw.length > 8 ? String(raw[8] || '').toUpperCase().trim() : skema;
        
        if (skemaJual.includes('DIPINJAM') || skemaJual.includes('PINJAM')) {
          baseKategori = 'dipinjam';
        } else if (skemaJual.includes('DISEWAKAN') || skemaJual.includes('SEWA')) {
          baseKategori = 'disewakan';
        } else if (skemaJual.includes('REKOM') || skemaJual.includes('REKOMENDASI')) {
          baseKategori = 'rekom';
        } else if (
          skemaJual.includes('KPR') ||
          skemaJual.includes('TUNAI') ||
          skemaJual.includes('SOLD') ||
          skemaJual.includes('TERJUAL') ||
          skemaJual.includes('LUNAS') ||
          skemaJual.includes('DP') ||
          skemaJual.includes('DIHUNI')
        ) {
          baseKategori = 'kpr'; // Ini adalah SOLD
        } else if (skemaJual.includes('STOK')) {
          baseKategori = 'stok';
        }

        // Tentukan imbCategory (Sub-kategori)
        let hasImb = typeof item.hasImb === 'boolean' ? item.hasImb : null;
        if (hasImb === null && raw.length > 31) {
          const noImbStr = String(raw[31] || '').trim();
          const lower = noImbStr.toLowerCase();
          hasImb = noImbStr !== '' && noImbStr !== '-' && !lower.includes('belum') && !lower.includes('[belum memiliki]');
        }

        let currentCat = '';
        if (baseKategori === 'kpr') {
          currentCat = hasImb === false ? 'terjual_no_imb' : 'terjual_imb';
        } else if (baseKategori === 'stok') {
          currentCat = hasImb === false ? 'stok_no_imb' : 'stok_imb';
        } else if (baseKategori === 'rekom') {
          currentCat = hasImb === false ? 'rekom_no_imb' : 'rekom_imb';
        } else if (baseKategori === 'disewakan') {
          currentCat = hasImb === false ? 'tersewa_no_imb' : 'tersewa_imb';
        } else if (baseKategori === 'dipinjam') {
          currentCat = hasImb === false ? 'dipinjam_no_imb' : 'dipinjam_imb';
        } else if (baseKategori === 'unknown') {
          const refInduk = raw.length > 4 ? String(raw[4] || '').trim() : '';
          const noSgb = raw.length > 12 ? String(raw[12] || '').trim() : '';
          const noInduk = raw.length > 15 ? String(raw[15] || '').trim() : '';
          const hasCert = (refInduk !== '' && refInduk !== '-') || (noSgb !== '' && noSgb !== '-') || (noInduk !== '' && noInduk !== '-');
          currentCat = hasCert ? 'unknown_with_induk' : 'unknown_no_induk';
        }

        // Deteksi On Hand
        const qValue = raw.length > 16 ? String(raw[16] || '').trim().toUpperCase() : '';
        const kValue = raw.length > 10 ? String(raw[10] || '').trim().toUpperCase() : '';
        const isOnHand = qValue.includes('ON_HAND') || kValue.includes('ON_HAND');

        // Cek apakah data ini harus dimasukkan ke Excel (sesuai filter centang status)
        const isCatActive = activeFilters[currentCat];
        
        // HANYA masukkan jika kategori status UTAMA-nya sedang dicentang
        if (isCatActive) {
          const statusTextMap = {
            'stok_imb': 'Stok Memilki IMB',
            'stok_no_imb': 'Stok Tanpa IMB',
            'tersewa_imb': 'Sewa Memilki IMB',
            'tersewa_no_imb': 'Sewa Tanpa IMB',
            'dipinjam_imb': 'Dipinjam Memiliki IMB',
            'dipinjam_no_imb': 'Dipinjam Tanpa IMB',
            'terjual_imb': 'Terjual Memiliki IMB',
            'terjual_no_imb': 'Terjual Tanpa IMB',
            'rekom_imb': 'Rekom Memiliki IMB',
            'rekom_no_imb': 'Rekom Tanpa IMB',
            'unknown_no_induk': 'Tidak ada Sertifikat',
            'unknown_with_induk': 'Ada Sertifikat/Induk'
          };

          excelData.push({
            "Nama Kavling": item.kode || raw[0] || '-',
            "Nomor Sertifikat": raw[12] || '-',
            "SGB": raw[12] || '-', // Kolom M
            "SHM": raw[14] || '-', // Kolom O
            "Ref Induk": raw[4] || '-', // Kolom E
            "Induk": raw[15] || '-', // Kolom P
            "Status Kavling": statusTextMap[currentCat] || item.kategori || '-',
            "Sertifikat (On Hand)": isOnHand ? "YA (ON HAND)" : "-",
            "Luas Tanah": raw[16] || '-',
            "Luas Bangunan": raw[42] || '-',
            "Pemegang Hak Lama": raw[39] || '-',
            "Skema Pembiayaan": raw[10] || '-',
            "Skema Penjualan": raw[8] || '-',
            "Tipe Kavling": raw[5] || '-',
            "Nomor IMB": raw[31] || '-'
          });
        }
      });

      if (excelData.length === 0) {
        alert('Tidak ada data untuk dicetak sesuai filter yang aktif.');
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
      }

      // 4. Generate Excel
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Statistik Kavling");
      
      // Auto-width kolom
      const wscols = [
        {wch: 15}, {wch: 25}, {wch: 20}, {wch: 20}, {wch: 15},
        {wch: 15}, {wch: 25}, {wch: 20}, {wch: 12}, {wch: 15},
        {wch: 25}, {wch: 18}, {wch: 18}, {wch: 15}, {wch: 18}
      ];
      ws['!cols'] = wscols;

      const dateStr = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
      
      const filterLabelMap = {
        'stok_imb': 'STOK_IMB',
        'stok_no_imb': 'STOK_BLM_IMB',
        'tersewa_imb': 'SEWA_IMB',
        'tersewa_no_imb': 'SEWA_BLM_IMB',
        'dipinjam_imb': 'PINJAM_IMB',
        'dipinjam_no_imb': 'PINJAM_BLM_IMB',
        'terjual_imb': 'SOLD_IMB',
        'terjual_no_imb': 'SOLD_BLM_IMB',
        'rekom_imb': 'REKOM_IMB',
        'rekom_no_imb': 'REKOM_BLM_IMB',
        'unknown_no_induk': 'TANPA_SERTIF',
        'unknown_with_induk': 'ADA_SERTIF',
        'on_hand': 'ONHAND'
      };

      const filterKeys = Object.keys(activeFilters || {});
      const filterKeysNoOnHand = filterKeys.filter(k => k !== 'on_hand');
      const isAllMainSelected = filterKeysNoOnHand.length > 0 && filterKeysNoOnHand.every(k => activeFilters[k]);

      let filterPart = '';
      if (isAllMainSelected) {
        filterPart = 'SEMUA';
      } else {
        filterPart = filterKeysNoOnHand.filter(k => activeFilters[k]).map(k => filterLabelMap[k] || k.toUpperCase()).join('_');
      }

      if (activeFilters?.on_hand) {
        filterPart = filterPart ? `${filterPart}_ONHAND` : 'ONHAND';
      }

      const safeFilterPart = (filterPart || 'TANPA_FILTER').replace(/[\\/:*?"<>|]/g, '').slice(0, 120);
      XLSX.writeFile(wb, `Data_Statistik_BTU_${safeFilterPart}_${dateStr}.xlsx`);

      btn.innerHTML = '<span>✅</span> Selesai!';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('Excel Download Error:', error);
      alert('Gagal mendownload Excel: ' + error.message);
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });

  // ===============================
  // DARK MODE TOGGLE
  // ===============================
  document.getElementById('darkModeToggle')?.addEventListener('click', toggleDarkMode);

  // ===============================
  // TOMBOL STATUS KAVLING
  // ===============================

  // Event listener untuk tombol Status Kavling
  document.getElementById('statusKavling')?.addEventListener('click', async () => {
    if (!isStatusMode) {
      // Mode status aktif
      await fetchKavlingStatus();
    } else {
      // Mode status nonaktif
      resetStatusMode();
    }
  });

  // Event listener untuk tutup panel status
  document.querySelector('.close-status-panel')?.addEventListener('click', () => {
    resetStatusMode();
  });

  // ===============================
  // MODAL SERTIFIKAT
  // ===============================

  // Buka modal (DIUBAH KE HALAMAN SENDIRI SESUAI REQUEST)
  document.getElementById('searchByCertificate')?.addEventListener('click', () => {
    window.location.href = 'pencarian_sertifikat.html';
  });
  document.getElementById('openCertMap')?.addEventListener('click', () => {
    window.location.href = 'sertifikat_map.html';
  });
  document.getElementById('openReportMap')?.addEventListener('click', () => {
    window.location.href = 'sitemap_btu_knc_report.html';
  });

  // Tutup modal
  document.querySelector('.close-modal')?.addEventListener('click', () => {
    document.getElementById('certificateModal').style.display = 'none';
  });

  document.getElementById('closeModal')?.addEventListener('click', () => {
    document.getElementById('certificateModal').style.display = 'none';
  });

  // Tutup modal kalau klik di luar konten
  document.getElementById('certificateModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-modal') || e.target.id === 'closeModal') {
      document.getElementById('certificateModal').style.display = 'none';
    }
  });

  // 🆕 Tutup modal kavling (Detail Statistik)
  document.querySelector('.close-kavling-modal')?.addEventListener('click', () => {
    document.getElementById('kavlingModal').style.display = 'none';
  });

  document.getElementById('closeKavlingModal')?.addEventListener('click', () => {
    document.getElementById('kavlingModal').style.display = 'none';
  });

// Sertifikat Induk
  document.getElementById('searchInduk')?.addEventListener('click', async () => {
    const certNumber = document.getElementById('certInduk').value.trim();
    await searchCertificateNew(certNumber, 'induk', 'Sertifikat Induk');
  });

  // SHGB
  document.getElementById('searchSHGB')?.addEventListener('click', async () => {
    const certNumber = document.getElementById('certSHGB').value.trim();
    await searchCertificateNew(certNumber, 'shgb', 'SHGB');
  });

  // SHM
  document.getElementById('searchSHM')?.addEventListener('click', async () => {
    const certNumber = document.getElementById('certSHM').value.trim();
    await searchCertificateNew(certNumber, 'shm', 'SHM');
  });

  // Nama SHM
  document.getElementById('searchNamaSHM')?.addEventListener('click', async () => {
    const certNumber = document.getElementById('certNamaSHM').value.trim();
    await searchCertificateNew(certNumber, 'nama_shm', 'Nama SHM');
  });
  // Nama Pemilik Lama / EX
  document.getElementById('searchExOwner')?.addEventListener('click', async () => {
    const certNumber = document.getElementById('certExOwner').value.trim();
    await searchCertificateNew(certNumber, 'ex_owner', 'Nama Pemilik Lama / EX');
  });
  // ===============================
  // ENTER KEY SUPPORT UNTUK SEMUA INPUT SERTIFIKAT
  // ===============================
  document.getElementById('certInduk')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('searchInduk').click();
    }
  });

  document.getElementById('certSHGB')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('searchSHGB').click();
    }
  });

  document.getElementById('certSHM')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('searchSHM').click();
    }
  });

  document.getElementById('certNamaSHM')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('searchNamaSHM').click();
    }
  });
  // ENTER KEY SUPPORT untuk Nama Pemilik Lama
  document.getElementById('certExOwner')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('searchExOwner').click();
    }
  });

  // ===============================
  // SEARCH (BLOK + KAVLING) TANPA AUTO-SELECT
  // ===============================
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    resultsBox.innerHTML = '';
    if (!q) return;

    const upper = q.toUpperCase();

    // BLOK OTOMATIS
    const blokItems = kavlingIndex.filter(id => id.startsWith(upper + '_'));
    if (blokItems.length && !q.includes('_')) {
      const liBlok = document.createElement('li');
      liBlok.textContent = `${upper} (${blokItems.length} kavling)`;
      liBlok.style.fontWeight = 'bold';
      liBlok.onclick = () => focusBlok(upper);
      resultsBox.appendChild(liBlok);
    }

    // KAVLING DETAIL
    kavlingIndex
      .filter(id => id.toLowerCase().includes(q))
      .slice(0, 20)
      .forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        li.onclick = () => focusKavling(name);
        resultsBox.appendChild(li);
      });

    if (!resultsBox.children.length) {
      resultsBox.innerHTML = '<li style="color:#777">Tidak ditemukan</li>';
    }
  });

  // ===============================
  // ENTER KEY SUPPORT UNTUK SEARCH INPUT KAVLING
  // ===============================
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchInput.value.trim().toUpperCase();

      if (!query) return;

      // Tutup dropdown jika terbuka
      resultsBox.innerHTML = '';

      // Cari berdasarkan tipe query
      if (query.includes('_')) {
        // Jika mengandung underscore, cari kavling spesifik
        if (kavlingIndex.includes(query)) {
          focusKavling(query);
        } else {
          // Jika tidak ditemukan, tampilkan popup not found
          showKavlingPopup(query, { 
            status: 'notfound',
            message: `Kode "${query}" tidak ditemukan`
          });
        }
      } else {
        // Jika tanpa underscore, cari blok
        const blokItems = kavlingIndex.filter(id => id.startsWith(query + '_'));
        if (blokItems.length > 0) {
          focusBlok(query);
        } else {
          // Coba cari sebagai kavling tanpa underscore
          if (kavlingIndex.includes(query)) {
            focusKavling(query);
          } else {
            showKavlingPopup(query, { 
              status: 'notfound',
              message: `Blok/Kavling "${query}" tidak ditemukan`
            });
          }
        }
      }
    }
  });

  // ===============================
  // FOCUS KAVLING
  // ===============================
  function focusKavling(id) {
    const svg = map.querySelector('svg');
    const el = document.getElementById(id);
    if (!el) return;

    // Hapus highlight warna sebelumnya
    clearHighlight();

    // HANYA hapus warna status jika mode status TIDAK aktif
    if (!isStatusMode) {
      clearStatusColors();
    }

    if (el.tagName.toLowerCase() === 'g') {
      el.querySelectorAll('rect, path, polygon').forEach(c => {
        // ABAIKAN jika ini adalah bagian dari overlay arsiran (ON HAND atau UNKNOWN HATCH)
        if (c.closest('.on-hand-overlay') || c.closest('.unknown-hatch-overlay')) return;

        // Only apply highlight style if it doesn't already have a status color
        const parent = c.closest('g');
        const target = (parent && parent.id && parent.id !== 'map') ? parent : c;

        // Gunakan regex untuk mengecek class status
        const hasStatus = Array.from(target.classList).some(cls => cls.startsWith('kavling-status-'));

        if (!hasStatus) {
          c.style.fill = '#ffd54f';
          c.style.stroke = '#ff6f00';
          c.style.strokeWidth = '2';
        }
      });
    } else {
      const hasStatus = Array.from(el.classList).some(cls => cls.startsWith('kavling-status-'));
      if (!hasStatus) {
        el.style.fill = '#ffd54f';
        el.style.stroke = '#ff6f00';
        el.style.strokeWidth = '2';
      }
    }

    const box = el.getBBox();
    zoomPadding = Math.max(box.width, box.height) * 0.6;

    viewBoxState = {
      x: box.x - zoomPadding,
      y: box.y - zoomPadding,
      w: box.width + zoomPadding * 2,
      h: box.height + zoomPadding * 2
    };

    lastFocusedEl = el;
    searchInput.value = id;
    applyViewBox(svg);

    // Panggil API dengan cache
    fetchDataForAddress(id);
  }

  // ===============================
  // FOCUS BLOK
  // ===============================
  function focusBlok(prefix) {
    const svg = map.querySelector('svg');
    clearHighlight();

    // HANYA hapus warna status jika mode status TIDAK aktif
    if (!isStatusMode) {
      clearStatusColors();
    }

    const els = [...map.querySelectorAll(`[id^="${prefix}_"]`)];
    if (!els.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    els.forEach(el => {
      if (el.tagName.toLowerCase() === 'g') {
        el.querySelectorAll('rect, path, polygon').forEach(c => {
          // ABAIKAN jika ini adalah bagian dari overlay arsiran (ON HAND atau UNKNOWN HATCH)
          if (c.closest('.on-hand-overlay') || c.closest('.unknown-hatch-overlay')) return;

          const parent = c.closest('g');
          const target = (parent && parent.id && parent.id !== 'map') ? parent : c;

          const hasStatus = Array.from(target.classList).some(cls => cls.startsWith('kavling-status-'));

          if (!hasStatus) {
            c.style.fill = '#ffd54f';
            c.style.stroke = '#ff6f00';
            c.style.strokeWidth = '2';
          }
        });
      } else {
        const hasStatus = Array.from(el.classList).some(cls => cls.startsWith('kavling-status-'));
        if (!hasStatus) {
          el.style.fill = '#ffd54f';
          el.style.stroke = '#ff6f00';
          el.style.strokeWidth = '2';
        }
      }

      const b = el.getBBox();
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });

    const pad = Math.max(maxX - minX, maxY - minY) * 0.4;

    viewBoxState = {
      x: minX - pad,
      y: minY - pad,
      w: (maxX - minX) + pad * 2,
      h: (maxY - minY) + pad * 2
    };

    lastFocusedEl = null;
    zoomPadding = null;
    searchInput.value = prefix;
    applyViewBox(svg);

    // Panggil API dengan cache
    fetchDataForAddress(prefix);
  }

  // ===============================
  // CLICK MAP
  // ===============================
  map.addEventListener('click', e => {
    if (isDragging) return;

    let t = e.target;

    // Cari elemen dengan ID yang valid
    while (t && t !== map) {
      if (t.id && /^(GA|UJ|KR|M|BLOK)/i.test(t.id)) {
        const id = t.id.toUpperCase();
        resultsBox.innerHTML = '';

        // Isi kotak pencarian
        searchInput.value = id;

        // Fokus berdasarkan tipe
        if (id.includes('_')) {
          focusKavling(id);
        } else {
          focusBlok(id);
        }

        return;
      }
      t = t.parentElement;
    }
  });

  // ===============================
  // PAN (DRAG)
  // ===============================
  map.addEventListener('mousedown', e => {
    isPanning = true;
    isDragging = false;
    panStart = { x: e.clientX, y: e.clientY };
    map.classList.add('grabbing');
  });

  map.addEventListener('mousemove', e => {
    if (!isPanning) return;

    const dxRaw = e.clientX - panStart.x;
    const dyRaw = e.clientY - panStart.y;

    if (Math.abs(dxRaw) > 3 || Math.abs(dyRaw) > 3) isDragging = true;

    const dx = dxRaw * (viewBoxState.w / map.clientWidth);
    const dy = dyRaw * (viewBoxState.h / map.clientHeight);

    viewBoxState.x -= dx;
    viewBoxState.y -= dy;

    panStart = { x: e.clientX, y: e.clientY };
    applyViewBox(map.querySelector('svg'));
  });

  map.addEventListener('mouseup', () => {
    isPanning = false;
    map.classList.remove('grabbing');
  });
  
  map.addEventListener('mouseleave', () => {
    isPanning = false;
    map.classList.remove('grabbing');
  });

  // ===============================
  // ZOOM SCROLL (TO CURSOR)
  // ===============================
  map.addEventListener('wheel', e => {
    e.preventDefault();

    const rect = map.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const factor = e.deltaY < 0 ? 0.9 : 1.1;

    const newW = viewBoxState.w * factor;
    const newH = viewBoxState.h * factor;

    viewBoxState.x += (viewBoxState.w - newW) * mx;
    viewBoxState.y += (viewBoxState.h - newH) * my;
    viewBoxState.w = newW;
    viewBoxState.h = newH;

    applyViewBox(map.querySelector('svg'));
  }, { passive: false });

  // ===============================
  // SMOOTH ZOOM
  // ===============================
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  let isZooming = false;

  function smoothZoom(factor, duration = 200) {
    if (isZooming || !viewBoxState) return;
    isZooming = true;

    const svg = map.querySelector('svg');
    if (!svg) {
      isZooming = false;
      return;
    }

    // Calculate center of current view
    const cx = viewBoxState.x + viewBoxState.w / 2;
    const cy = viewBoxState.y + viewBoxState.h / 2;

    // Target state
    const targetW = viewBoxState.w * factor;
    const targetH = viewBoxState.h * factor;
    const targetX = cx - targetW / 2;
    const targetY = cy - targetH / 2;

    // Starting state
    const startX = viewBoxState.x;
    const startY = viewBoxState.y;
    const startW = viewBoxState.w;
    const startH = viewBoxState.h;

    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out quad for smooth deceleration
      const ease = 1 - (1 - progress) * (1 - progress);

      viewBoxState.x = startX + (targetX - startX) * ease;
      viewBoxState.y = startY + (targetY - startY) * ease;
      viewBoxState.w = startW + (targetW - startW) * ease;
      viewBoxState.h = startH + (targetH - startH) * ease;

      applyViewBox(svg);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        isZooming = false;
      }
    }

    requestAnimationFrame(animate);
  }

  zoomInBtn.onclick = () => smoothZoom(0.8); // Zoom in (smaller viewBox)
  zoomOutBtn.onclick = () => smoothZoom(1.25); // Zoom out (larger viewBox)

  // ===============================
  // RESET
  // ===============================
  resetBtn.onclick = () => {
    const svg = map.querySelector('svg');
    clearHighlight();

    if (svg && originalViewBox) {
      svg.setAttribute('viewBox', originalViewBox);
      viewBoxState = parseViewBox(originalViewBox);
    }
    lastFocusedEl = null;
    zoomPadding = null;
    searchInput.value = '';
    resultsBox.innerHTML = '';
    closeKavlingPopup();

  };

  // ===============================
  // FUNGSI TESTING
  // ===============================
  window.testCertificateAPI = async function(type, value) {
    const testType = type || 'shm';
    const testValue = value || 'B.00350';

    console.log(`🧪 Testing API Sertifikat: ${testType} = ${testValue}`);

    const url = `${CERT_API_URL}?certificate=${encodeURIComponent(testValue)}&type=${testType}&_t=${Date.now()}`;

    console.log('URL:', url);

    try {
      const res = await fetch(url);
      console.log('Status:', res.status, res.statusText);

      const text = await res.text();
      console.log('Raw response:', text);

      try {
        const json = JSON.parse(text);
        console.log('Parsed JSON:', json);
        return json;
      } catch (e) {
        console.error('Gagal parse JSON:', e);
        return text;
      }
    } catch (err) {
      console.error('Fetch error:', err);
      return null;
    }
  };

  // ===============================
  // FUNGSI DEBUG API
  // ===============================

  // Fungsi untuk test koneksi API
  window.testStatusAPI = async function() {
    console.log('🧪 Testing Status API Connection...');

    const testUrls = [
      `${API_URL}?action=status`,
      `${API_URL}?action=status&callback=test`,
      'https://script.google.com/macros/s/AKfycbwbBmXFoTtWa0XxK-ogxueDUkjzAKzhE7sPQaDMQvTIy7_FhA-DGMBJyYzzTyUVXw/exec?action=status'
    ];

    for (let i = 0; i < testUrls.length; i++) {
      const url = testUrls[i];
      console.log(`\n🔗 Testing URL ${i+1}: ${url}`);

      try {
        const startTime = Date.now();
        const response = await fetch(url + '&_t=' + Date.now());
        const endTime = Date.now();

        console.log(`⏱️ Response time: ${endTime - startTime}ms`);
        console.log(`📊 Status: ${response.status} ${response.statusText}`);

        const text = await response.text();
        console.log(`📄 Response length: ${text.length} characters`);

        // Coba parse JSON
        try {
          const json = JSON.parse(text);
          console.log('✅ Valid JSON:', json);

          // Tampilkan summary jika ada
          if (json.summary) {
            console.log('📈 Summary:', json.summary);
          }
          if (json.data && Array.isArray(json.data)) {
            console.log(`📊 Data count: ${json.data.length}`);
            if (json.data.length > 0) {
              console.log('📝 Sample data:', json.data[0]);
            }
          }

        } catch (e) {
          console.log('⚠️ Not valid JSON, first 200 chars:', text.substring(0, 200));
        }

      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
    }

    console.log('\n📋 TEST COMPLETE');
  };

  // Fungsi untuk cek data langsung di Console
  window.checkStatusData = function() {
    console.log('🔍 Checking statusData:', statusData);
    console.log('🔍 Is Status Mode:', isStatusMode);

    if (statusData) {
      console.log('📊 Data structure:', {
        status: statusData.status,
        totalRecords: statusData.totalRecords,
        summary: statusData.summary,
        dataLength: statusData.data ? statusData.data.length : 0
      });

      // Hitung kategori manual
      if (statusData.data && Array.isArray(statusData.data)) {
        const counts = {
          kpr: 0,
          stok: 0,
          rekom: 0,
          disewakan: 0,
          lainnya: 0
        };

        statusData.data.forEach(item => {
          counts[item.kategori] = (counts[item.kategori] || 0) + 1;
        });

        console.log('🧮 Manual counts:', counts);
      }
    }
  };

  // ===============================
  // EVENT LISTENER UNTUK POPUP
  // ===============================

  // Event listener untuk klik di luar popup - MODIFIKASI
  document.addEventListener('click', function(e) {
    const popup = document.querySelector('.kavling-popup');
    const modal = document.getElementById('certificateModal');
    const statusPanel = document.getElementById('statusPanel');

    // JANGAN tutup panel status saat klik di luar
    if (statusPanel && statusPanel.style.display === 'block') {
      // Biarkan panel status tetap terbuka
      return;
    }

    // Untuk kavling popup
    if (popup && popup.style.display === 'flex') {
      const isCloseBtn = e.target.classList.contains('close-kavling-popup') || 
                         e.target.classList.contains('kavling-close-btn');

      // HANYA tutup jika klik tombol close
      if (isCloseBtn) {
        document.body.removeChild(popup);
      }
    }

    // Untuk modal sertifikat - HANYA tutup via tombol
    if (modal && modal.style.display === 'flex') {
      const isCloseBtn = e.target.classList.contains('close-modal') ||
                         e.target.id === 'closeModal';

      if (isCloseBtn) {
        modal.style.display = 'none';
      }
      // Abaikan klik di luar - jangan tutup
    }
  });
  // ===============================
  // BUTTON IMB/PBG/SLF
  // ===============================
  document.getElementById('checkImbStatus')?.addEventListener('click', () => {
    // Jika sudah memasukkan kode F888 atau BTU999 di awal, langsung masuk
    const currentImbAccess = sessionStorage.getItem('imb_access');
    if (currentImbAccess === 'f888' || currentImbAccess === 'btu999') {
      window.location.href = 'imb_status.html';
      return;
    }

    // Jika belum login, minta kode
    const accessCode = prompt('Masukkan Kode Akses Khusus IMB:');
    if (accessCode === 'f888') {
      sessionStorage.setItem('imb_access', 'f888');
      window.location.href = 'imb_status.html';
    } else if (accessCode === 'btu999') {
      sessionStorage.setItem('imb_access', 'btu999');
      window.location.href = 'imb_status.html';
    } else if (accessCode !== null) {
      alert('Kode akses salah!');
    }
  });

}); // PENUTUP UNTUK DOMContentLoaded
