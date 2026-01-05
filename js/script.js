// ===============================
// FINAL CLEAN SCRIPT – SVG MAP
// Search blok & kavling, zoom, pan, click sync + STATUS KAVLING (AUTO COLOR)
// ===============================

const API_URL = 'https://script.google.com/macros/s/AKfycbwT5KvNPeKS9BICvlJwYOAVYume-K_nMotzw0ElJ12J6xYJylmYTyZZPTPEnlbF1r0v/exec';
const CERT_API_URL = 'https://script.google.com/macros/s/AKfycbyEPaUBAg2n3732mTnukOnoxA6eN6eTEjso929InZZEbIqjycGzb8zuSJdLmyfaFEJf3w/exec';

let kavlingIndex = [];
let originalViewBox = null;
let viewBoxState = null;
let lastFocusedEl = null;
let zoomPadding = null;

let isPanning = false;
let isDragging = false;
let panStart = { x: 0, y: 0 };
let svgCache = null;
let isSvgLoaded = false;
let isStatusMode = false;
let statusData = null;

// ===============================
// CACHE SYSTEM
// ===============================
const searchCache = new Map();
const certSearchCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000;

// ===============================
// DARK MODE FUNCTIONALITY
// ===============================
let isDarkMode = localStorage.getItem('darkMode') === 'true';

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

function applyDarkMode() {
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    document.getElementById('darkModeToggle').classList.add('active');
    document.getElementById('darkModeToggle').innerHTML = '<span>☀️</span> Light Mode';
  }
}

// ===============================
// HELPERS
// ===============================
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
      const parent = el.closest('g');
      const target = (parent && parent.id && parent.id !== 'map') ? parent : el;

      if (!target.classList.contains('kavling-status-kpr') && 
          !target.classList.contains('kavling-status-stok') && 
          !target.classList.contains('kavling-status-rekom') && 
          !target.classList.contains('kavling-status-disewakan') &&
          !target.classList.contains('kavling-status-unknown')) {
        el.style.cssText = '';
      }
    });
}

// ===============================
// FUNGSI STATUS KAVLING - AUTO COLOR
// ===============================
async function fetchKavlingStatus() {
  try {
    console.log('🔍 Mengambil dan MEWARNAI data status kavling...');
    
    // Tampilkan loading di tombol
    const statusBtn = document.getElementById('statusKavling');
    const originalText = statusBtn.innerHTML;
    statusBtn.innerHTML = '<span>⏳</span> Memuat...';
    statusBtn.disabled = true;
    
    // Tampilkan panel
    const panel = document.getElementById('statusPanel');
    const panelBody = document.querySelector('.status-panel-body');
    panel.style.display = 'block';
    isStatusMode = true;
    
    // Loading di panel
    panelBody.innerHTML = `
      <div class="status-loading">
        <div class="status-loading-spinner"></div>
        <div style="color:#666;font-size:14px;margin-top:10px;">
          🔄 Memuat & Mewarnai kavling...
          <br><span style="font-size:12px;color:#999;">Mengambil data terbaru dari server</span>
        </div>
      </div>
    `;
    
    // Fetch data FRESH (no cache)
    const url = `${API_URL}?action=status&_t=${Date.now()}`;
    console.log('🌐 Fetch data FRESH:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    console.log('✅ Data status diterima:', data);
    
    // DEBUG: Cek UJ21_21
    const uj21Data = data.data?.find(item => item.kode === 'UJ21_21');
    if (uj21Data) {
      console.log(`🔍 DEBUG UJ21_21: kategori="${uj21Data.kategori}", skema="${uj21Data.skema}", tanggal="${uj21Data.tanggal}"`);
    }
    
    // 1. WARNAI KAVLING LANGSUNG
    console.log('🎨 Mulai mewarnai kavling dari data API...');
    colorizeKavling(data.data || []);
    
    // 2. HITUNG DARI PETA SETELAH DIWARNAI
    console.log('🧮 Menghitung dari peta setelah pewarnaan...');
    const countsFromMap = countKavlingFromMap();
    
    // 3. UPDATE PANEL DENGAN DATA REAL-TIME
    updateStatusPanelWithRealData(data, countsFromMap);
    
    // Restore button
    statusBtn.innerHTML = originalText;
    statusBtn.disabled = false;
    statusBtn.classList.add('active');
    
    // Tampilkan notifikasi
    showNotification(`✅ ${data.totalRecords || 0} kavling telah diwarnai!`, 'success');
    
    return data;
    
  } catch (error) {
    console.error('❌ Gagal mengambil data status:', error);
    
    // Restore button
    const statusBtn = document.getElementById('statusKavling');
    statusBtn.innerHTML = '<span>🎨</span> Status Kavling';
    statusBtn.disabled = false;
    
    // Error di panel
    const panelBody = document.querySelector('.status-panel-body');
    panelBody.innerHTML = `
      <div style="padding:20px;text-align:center;color:#c62828;">
        <div style="font-size:16px;margin-bottom:10px;">❌ Gagal mengambil data</div>
        <div style="font-size:14px;margin-bottom:15px;">${error.message}</div>
        <button onclick="fetchKavlingStatus()" style="padding:8px 16px;background:#2196F3;color:white;border:none;border-radius:4px;cursor:pointer;">
          🔄 Coba Lagi
        </button>
      </div>
    `;
    
    return null;
  }
}

function updateStatusPanelWithRealData(apiData, mapCounts) {
  const panelBody = document.querySelector('.status-panel-body');
  
  if (!panelBody) return;
  
  // Hitung real dari peta
  const realCounts = countKavlingFromMap();
  
  let html = `
    <div class="status-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #673ab7; border-bottom: 1px solid #ddd; color: white;">
      <h4 style="margin: 0; font-size: 16px;">🎨 Status Kavling (REAL-TIME)</h4>
      <div style="display: flex; gap: 5px;">
        <button class="close-status-btn" style="background: rgba(255, 255, 255, 0.2); color: white; border: none; border-radius: 50%; width: 30px; height: 30px; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>
      </div>
    </div>
    
    <div class="status-content" style="padding: 15px;">
      <div style="margin-bottom: 15px; text-align: center;">
        <button onclick="refreshKavlingData()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>🔄</span> Refresh Data & Warnai Ulang
        </button>
        <div style="font-size: 12px; color: #666; margin-top: 5px;">
          Ambil data terbaru dari server dan warnai semua kavling
        </div>
      </div>
      
      <!-- INFO SINKRONISASI -->
      <div style="background: #e8f5e9; padding: 12px; border-radius: 6px; margin-bottom: 15px; border: 1px solid #c8e6c9;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: bold; color: #1b5e20;">📊 Data Sinkron</div>
            <div style="font-size: 12px; color: #666;">API: ${apiData.totalRecords || 0} | Peta: ${realCounts.total}</div>
          </div>
          ${realCounts.total === (apiData.totalRecords || 0) ? 
            '<span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">✓ Sinkron</span>' : 
            '<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">⚠️ Periksa</span>'}
        </div>
      </div>
  `;
  
  // Kategori dengan warna
  const categories = [
    { id: 'kpr', title: 'KPR,TUNAI (SOLD)', color: '#ff4444', border: '#111111' },
    { id: 'stok', title: 'STOK', color: '#90EE90', border: '#111111' },
    { id: 'rekom', title: 'REKOM', color: '#ff44ff', border: '#111111' },
    { id: 'disewakan', title: 'DISEWAKAN', color: '#44ffff', border: '#111111' },
    { id: 'unknown', title: 'TIDAK DIKETAHUI', color: '#ffffff', border: '#111111' }
  ];
  
  // Tampilkan per kategori
  categories.forEach(cat => {
    const count = realCounts[cat.id] || 0;
    
    html += `
      <div class="status-item" style="display: flex; align-items: center; padding: 10px; margin-bottom: 8px; background: #fff; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); ${cat.id === 'unknown' ? 'border: 1px solid #ddd;' : ''}">
        <div class="status-color-sample" style="width: 20px; height: 20px; border-radius: 4px; margin-right: 12px; background-color: ${cat.color}; border: 2px solid ${cat.border};"></div>
        <div class="status-info" style="flex: 1;">
          <div class="status-title" style="font-size: 14px; color: #555;">${cat.title}</div>
          <div class="status-count" id="count${cat.id.toUpperCase()}" style="font-size: 18px; font-weight: bold; color: #333;">${count}</div>
        </div>
        <button class="download-btn" data-type="${cat.id}" onclick="downloadKavlingData('${cat.id}')" style="padding: 6px 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">📥 List</button>
      </div>
    `;
  });
  
  // Footer dengan total
  html += `
    <div class="status-total" style="text-align: center; padding: 15px; margin-top: 15px; background: #e8f5e9; border-radius: 8px; font-size: 18px;">
      <strong>Total Kavling Berwarna: <span id="totalAll" style="color: #2E7D32;">${realCounts.total}</span></strong>
    </div>
    
    <div class="status-debug-info" style="margin-top: 15px; padding: 12px; background: #f9f9f9; border-radius: 6px; font-size: 12px; color: #666;">
      <h5 style="margin: 0 0 8px 0; color: #333;">Info Sistem:</h5>
      • Pewarnaan otomatis dari data API<br>
      • Hitung real-time dari warna di peta<br>
      • Last Refresh: ${new Date().toLocaleTimeString()}<br>
      • API Records: ${apiData.totalRecords || 0}<br>
      • Peta Berwarna: ${realCounts.total}
    </div>
  </div>`;
  
  panelBody.innerHTML = html;
  
  // Event listener untuk close button
  const closeBtn = panelBody.querySelector('.close-status-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      resetStatusMode();
    });
  }
}

async function refreshKavlingData() {
  console.log('🔄 Memulai refresh data kavling...');
  
  // Tampilkan loading di tombol
  const refreshBtn = document.querySelector('[onclick="refreshKavlingData()"]');
  const originalHtml = refreshBtn.innerHTML;
  refreshBtn.innerHTML = '<span>⏳</span> Memuat...';
  refreshBtn.disabled = true;
  
  try {
    // 1. Clear cache
    searchCache.clear();
    certSearchCache.clear();
    console.log('🧹 Cache dibersihkan');
    
    // 2. Fetch data baru
    const url = `${API_URL}?action=status&_t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    console.log('✅ Data baru diterima:', data);
    
    // 3. Warnai ulang SEMUA kavling
    console.log('🎨 Mewarnai ulang semua kavling...');
    colorizeKavling(data.data || []);
    
    // 4. Hitung ulang
    const counts = countKavlingFromMap();
    
    // 5. Update panel
    updateStatusPanelWithRealData(data, counts);
    
    // 6. Notifikasi sukses
    showNotification(`✅ ${counts.total} kavling telah di-refresh dan diwarnai!`, 'success');
    
    console.log('🔄 Refresh selesai:', counts);
    
  } catch (error) {
    console.error('❌ Refresh gagal:', error);
    showNotification(`❌ Gagal refresh: ${error.message}`, 'error');
  } finally {
    // Restore button
    refreshBtn.innerHTML = originalHtml;
    refreshBtn.disabled = false;
  }
}

function showNotification(message, type = 'info') {
  // Hapus notif lama
  const oldNotif = document.getElementById('global-notification');
  if (oldNotif) oldNotif.remove();
  
  // Buat notif baru
  const notif = document.createElement('div');
  notif.id = 'global-notification';
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-weight: 500;
    animation: slideDown 0.3s ease-out;
  `;
  
  notif.innerHTML = message;
  document.body.appendChild(notif);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notif.parentNode) {
      notif.style.opacity = '0';
      notif.style.transition = 'opacity 0.3s';
      setTimeout(() => {
        if (notif.parentNode) notif.remove();
      }, 300);
    }
  }, 3000);
}

// Tambahkan CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translate(-50%, -20px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
`;
document.head.appendChild(style);

// ===============================
// BERI WARNA PADA KAVLING BERDASARKAN STATUS
// ===============================
function colorizeKavling(kavlingData) {
  const svgMap = document.querySelector('#map svg');
  if (!svgMap) {
    console.error('❌ SVG map tidak ditemukan');
    return;
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
  let processedIds = new Set();

  kavlingData.forEach(item => {
    if (!item.kode) return;

    const kode = item.kode.trim().toUpperCase();
    const kategori = item.kategori || 'unknown';

    let element = document.getElementById(kode);

    if (!element) {
      const elements = document.querySelectorAll(`[id*="${kode}"]`);
      if (elements.length > 0) element = elements[0];
    }

    if (element) {
      if (element.id) processedIds.add(element.id);

      const className = `kavling-status-${kategori}`;

      // Hapus semua kelas status sebelumnya
      element.classList.remove(
        'kavling-status-kpr',
        'kavling-status-stok', 
        'kavling-status-rekom',
        'kavling-status-disewakan',
        'kavling-status-unknown'
      );

      // Tambahkan kelas baru
      element.classList.add(className);

      // Jika element adalah group, tambahkan ke child elements juga
      if (element.tagName.toLowerCase() === 'g') {
        element.querySelectorAll('rect, path, polygon, circle').forEach(child => {
          child.classList.remove(
            'kavling-status-kpr',
            'kavling-status-stok', 
            'kavling-status-rekom',
            'kavling-status-disewakan',
            'kavling-status-unknown'
          );
          child.classList.add(className);
        });
      }

      coloredCount++;

      // LOG untuk kavling spesifik
      if (kode === 'UJ21_21') {
        console.log(`🔍 DEBUG Pewarnaan UJ21_21: ${className} (skema: "${item.skema}", tanggal: "${item.tanggal}")`);
      }

    } else {
      notFoundCount++;
      if (notFoundCount <= 5) {
        console.warn(`❓ Kavling tidak ditemukan: "${kode}"`);
      }
    }
  });

  // WARNAI KAVLING TANPA STATUS DENGAN PUTIH
  const allBlocksWithId = document.querySelectorAll('[id^="GA"], [id^="UJ"], [id^="KR"], [id^="M"], [id^="Blok"]');
  let unknownCount = 0;

  allBlocksWithId.forEach(el => {
    if (el.id && !processedIds.has(el.id) && 
        !el.classList.contains('kavling-status-kpr') && 
        !el.classList.contains('kavling-status-stok') && 
        !el.classList.contains('kavling-status-rekom') &&
        !el.classList.contains('kavling-status-disewakan')) {

      // Hapus inline styles
      el.style.fill = '';
      el.style.stroke = '';

      // Hapus kelas status sebelumnya
      el.classList.remove('kavling-status-unknown');

      // Tambahkan kelas unknown
      el.classList.add('kavling-status-unknown');

      // Jika element adalah group, tambahkan ke child elements
      if (el.tagName.toLowerCase() === 'g') {
        el.querySelectorAll('rect, path, polygon, circle').forEach(child => {
          child.style.fill = '';
          child.style.stroke = '';
          child.classList.remove('kavling-status-unknown');
          child.classList.add('kavling-status-unknown');
        });
      }

      unknownCount++;
    }
  });

  console.log(`✅ Selesai: ${coloredCount} kavling berwarna, ${unknownCount} putih, ${notFoundCount} tidak ditemukan`);

  // LOG hasil akhir
  const finalCategoryCount = {};
  allBlocksWithId.forEach(el => {
    if (el.classList.contains('kavling-status-kpr')) finalCategoryCount.kpr = (finalCategoryCount.kpr || 0) + 1;
    if (el.classList.contains('kavling-status-stok')) finalCategoryCount.stok = (finalCategoryCount.stok || 0) + 1;
    if (el.classList.contains('kavling-status-rekom')) finalCategoryCount.rekom = (finalCategoryCount.rekom || 0) + 1;
    if (el.classList.contains('kavling-status-disewakan')) finalCategoryCount.disewakan = (finalCategoryCount.disewakan || 0) + 1;
    if (el.classList.contains('kavling-status-unknown')) finalCategoryCount.unknown = (finalCategoryCount.unknown || 0) + 1;
  });

  console.log('🎯 Hasil akhir pewarnaan:', finalCategoryCount);
}

// ===============================
// HAPUS SEMUA WARNA STATUS
// ===============================
function clearStatusColors() {
  document.querySelectorAll('[id^="GA"], [id^="UJ"], [id^="KR"], [id^="M"], [id^="Blok"]')
    .forEach(el => {
      el.style.fill = '';
      el.style.stroke = '';

      el.classList.remove(
        'kavling-status-kpr',
        'kavling-status-stok', 
        'kavling-status-rekom',
        'kavling-status-disewakan',
        'kavling-status-unknown'
      );

      if (el.tagName.toLowerCase() === 'g') {
        el.querySelectorAll('rect, path, polygon').forEach(child => {
          child.style.fill = '';
          child.style.stroke = '';
          child.classList.remove(
            'kavling-status-kpr',
            'kavling-status-stok', 
            'kavling-status-rekom',
            'kavling-status-disewakan',
            'kavling-status-unknown'
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
    unknown: 0,
    total: 0
  };

  const allFrameElements = document.querySelectorAll('[id^="GA"], [id^="UJ"], [id^="KR"], [id^="M"], [id^="Blok"]');

  console.log(`📊 Total frame elements ditemukan: ${allFrameElements.length}`);

  const statusClasses = [
    'kavling-status-kpr', 
    'kavling-status-stok', 
    'kavling-status-rekom', 
    'kavling-status-disewakan',
    'kavling-status-unknown'
  ];

  allFrameElements.forEach(el => {
    if (el.id && el.id.trim() !== '') {
      let foundStatus = false;

      statusClasses.forEach(className => {
        if (el.classList.contains(className)) {
          const type = className.replace('kavling-status-', '');
          counts[type]++;
          foundStatus = true;
        }
      });

      if (!foundStatus) {
        counts.unknown++;
      }
    }
  });

  counts.total = counts.kpr + counts.stok + counts.rekom + counts.disewakan + counts.unknown;

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
  safeUpdate('countUNKNOWN', counts.unknown);
  safeUpdate('totalAll', counts.total);

  return counts;
}

// Nonaktifkan mode status
function resetStatusMode() {
  const panel = document.getElementById('statusPanel');
  if (panel) panel.style.display = 'none';

  const statusBtn = document.getElementById('statusKavling');
  if (statusBtn) statusBtn.classList.remove('active');

  isStatusMode = false;
  statusData = null;
  console.log('🔄 Mode status dinonaktifkan (warna tetap disimpan)');
}

// Ambil list blok berdasarkan kategori warna dari peta
function getKavlingListFromMap(type) {
  const kavlingList = [];
  const className = `kavling-status-${type}`;
  const allFrameElements = document.querySelectorAll('[id^="GA"], [id^="UJ"], [id^="KR"], [id^="M"], [id^="Blok"]');

  console.log(`🔍 Mencari kavling tipe ${type}, total frame: ${allFrameElements.length}`);

  allFrameElements.forEach(el => {
    if (el.id && el.id.trim() !== '') {
      if (type === 'unknown') {
        const hasStatus = el.classList.contains('kavling-status-kpr') ||
                         el.classList.contains('kavling-status-stok') ||
                         el.classList.contains('kavling-status-rekom') ||
                         el.classList.contains('kavling-status-disewakan') ||
                         el.classList.contains('kavling-status-unknown');

        if (!hasStatus) {
          kavlingList.push(el.id);
        }
      } else if (el.classList.contains(className)) {
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

// Download data per kategori
async function downloadKavlingData(type) {
  try {
    console.log(`📥 Memulai download data ${type}...`);

    const kavlingListFromMap = getKavlingListFromMap(type);

    console.log(`📊 Ditemukan ${kavlingListFromMap.length} kavling ${type} di peta:`, kavlingListFromMap);

    if (kavlingListFromMap.length === 0) {
      alert(`⚠️ Tidak ada kavling dengan status "${type}" ditemukan di peta.`);
      return;
    }

    showDownloadPopupFromMap(kavlingListFromMap, type);

  } catch (error) {
    console.error(`❌ Gagal download data ${type}:`, error);
    alert(`Gagal download data ${type}: ${error.message}`);
  }
}

// Popup untuk menampilkan list blok dari peta
function showDownloadPopupFromMap(kavlingList, type) {
  const oldPopup = document.querySelector('.kavling-popup');
  if (oldPopup) {
    document.body.removeChild(oldPopup);
  }

  const popup = document.createElement('div');
  popup.className = 'kavling-popup';

  let title = '';
  let description = '';

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
    <div style="margin-bottom:15px; padding:15px; background:#e8f5e9; border-radius:6px; text-align:center;">
      <div style="font-size:18px; font-weight:bold; color:#1b5e20;">${kavlingList.length} Kavling</div>
      <div style="font-size:14px; color:#666; margin-top:5px;">${description}</div>
      <div style="font-size:12px; color:#999; margin-top:5px;">Status: <strong>${title}</strong></div>
    </div>

    <div style="margin-bottom:15px; display: flex; gap: 10px; justify-content: center;">
      <button onclick="copyToClipboard()" style="padding:10px 20px; background:#2196F3; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:600;">
        📋 Copy Semua
      </button>
      <button onclick="downloadAsCSV('${type}')" style="padding:10px 20px; background:#4CAF50; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:600;">
        📥 Download CSV
      </button>
    </div>

    <div style="font-family:monospace; font-size:13px; line-height:1.8; background:#f5f5f5; padding:15px; border-radius:6px; max-height:400px; overflow-y:auto; border:1px solid #e0e0e0;">
  `;

  if (kavlingList.length > 0) {
    kavlingList.forEach((kode, index) => {
      content += `<div style="padding: 3px 0;">${index + 1}. ${kode}</div>`;
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

  window.currentDownloadList = kavlingList;

  const closePopup = () => {
    document.body.removeChild(popup);
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

function getStatusDisplayName(type) {
  const statusMap = {
    'kpr': 'KPR,TUNAI (SOLD)',
    'stok': 'Kavling Stok',
    'rekom': 'REKOM',
    'disewakan': 'Disewakan',
    'unknown': 'Status Belum ada data'
  };
  return statusMap[type] || type.toUpperCase();
}

function downloadAsCSV(type) {
  if (!window.currentDownloadList || window.currentDownloadList.length === 0) {
    alert('Tidak ada data untuk didownload');
    return;
  }

  const statusDisplayName = getStatusDisplayName(type);

  let csvContent = "No,Kode Kavling,Status,Keterangan\n";

  window.currentDownloadList.forEach((kode, index) => {
    csvContent += `${index + 1},"${kode}","${statusDisplayName}",""\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  const fileName = `kavling_${type}_${new Date().toISOString().slice(0,10)}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log(`✅ CSV untuk ${type} berhasil didownload (${window.currentDownloadList.length} data)`);
}

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

// ===============================
// POPUP MANAGEMENT
// ===============================
function showKavlingPopup(address, result) {
  const oldPopup = document.querySelector('.kavling-popup');
  if (oldPopup) {
    document.body.removeChild(oldPopup);
  }

  const popup = document.createElement('div');
  popup.className = 'kavling-popup';

  let statusClass = '';
  let statusText = '';
  let dataContent = '';

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
        dataContent = `<div class="kavling-data-content">${result.data.trim()}</div>`;
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
        ${dataContent}
      </div>
      ${result.status !== 'loading' ? `
      <div class="kavling-popup-footer">
        <button class="kavling-close-btn">Tutup</button>
      </div>
      ` : ''}
    </div>
  `;

  document.body.appendChild(popup);

  if (result.status !== 'loading') {
    const closeBtn = popup.querySelector('.close-kavling-popup');
    const closeBtn2 = popup.querySelector('.kavling-close-btn');

    const closePopup = () => {
      document.body.removeChild(popup);
    };

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    if (closeBtn2) closeBtn2.addEventListener('click', closePopup);

    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        closePopup();
      }
    });
  }

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

// ===============================
// FUNGSI PENCARIAN SERTIFIKAT
// ===============================
async function searchCertificateNew(certNumber, certType, displayName) {
  if (!certNumber) {
    alert(`Mohon masukkan ${displayName}`);
    return;
  }

  console.log(`🔍 Mencari ${displayName}:`, certNumber);

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

  try {
    const cacheKey = `${certType}:${certNumber.toUpperCase()}`;
    const cached = certSearchCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log('⚡ HIT CACHE SERTIFIKAT:', cacheKey);
      displayCertificateResults(cached.data, certNumber, certType, displayName);
      return;
    }

    const encodedCert = encodeURIComponent(certNumber);
    const url = `${CERT_API_URL}?certificate=${encodedCert}&type=${certType}&_t=${Date.now()}`;

    console.log('🌐 Mengakses API Sertifikat:', url);

    const res = await fetch(url);
    const data = await res.json();

    console.log('📦 Response API Sertifikat:', data);

    if (data.status === 'success') {
      certSearchCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });
    }

    displayCertificateResults(data, certNumber, certType, displayName);

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
        <div class="cert-total-found">
          ✅ Ditemukan: <strong>${data.totalFound}</strong> hasil untuk 
          <strong>${displayName}: "${certNumber}"</strong>
        </div>
    `;

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
// FUNGSI UTAMA: AMBIL DATA KAVLING DARI API
// ===============================
async function fetchDataForAddress(address) {
  if (!address || !address.trim()) {
    console.log('❌ Address kosong');
    return;
  }

  const cleanAddress = address.trim().toUpperCase();
  console.log('🔍 Mencari data kavling untuk:', cleanAddress);

  showKavlingPopup(cleanAddress, { 
    status: 'loading',
    message: 'Sedang mencari data...'
  });

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
    const encodedAddress = encodeURIComponent(cleanAddress);
    const url = `${API_URL}?address=${encodedAddress}`;

    console.log('🌐 Mengambil data kavling dari:', url);

    const fetchUrl = url + '&_t=' + Date.now();

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

    const data = await res.json();
    console.log('📦 Data kavling diterima:', data);

    if (data.status === 'success' && data.data) {
      console.log('💾 Menyimpan kavling ke cache:', cleanAddress);
      searchCache.set(cleanAddress, {
        data: data.data || '',
        timestamp: Date.now()
      });
    }

    switch (data.status) {
      case 'success':
        showKavlingPopup(cleanAddress, { 
          status: 'success',
          message: data.message || 'Data ditemukan',
          data: data.data || ''
        });
        break;

      case 'empty':
        showKavlingPopup(cleanAddress, { 
          status: 'empty',
          message: data.message || 'Data ditemukan tetapi kolom kosong',
          data: data.data || ''
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

// ===============================
// DOM READY
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  const map = document.getElementById('map');
  const searchInput = document.getElementById('search');
  const resultsBox = document.getElementById('search-results');
  const resetBtn = document.getElementById('resetZoom');

  searchInput.disabled = true;

  function setupSVG(container) {
    const svg = container.querySelector('svg');
    if (!svg) return;

    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

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

    const ids = container.querySelectorAll('[id]');
    kavlingIndex = [];
    const seen = new Set();

    ids.forEach(el => {
      const id = el.id.trim().toUpperCase();
      if (id && /^(GA|UJ|KR|M|BLOK)/.test(id) && !seen.has(id)) {
        seen.add(id);
        kavlingIndex.push(id);
      }
    });

    kavlingIndex.sort((a, b) => a.localeCompare(b, 'id'));
    isSvgLoaded = true;
  }

  if (svgCache) {
    map.innerHTML = svgCache;
    setupSVG(map);
    searchInput.disabled = false;
  } else {
    const loadTimeout = setTimeout(() => {
      searchInput.placeholder = "Memuat peta...";
      document.body.classList.add('loading');
    }, 500);

    fetch('sitemap.svg?v=' + Date.now(), { cache: 'no-store' })
      .then(r => r.text())
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
        map.innerHTML = '<div style="padding:40px;text-align:center;color:#666">Gagal memuat peta. Silakan refresh halaman.</div>';
      });
  }

  // ===============================
  // DARK MODE TOGGLE
  // ===============================
  document.getElementById('darkModeToggle')?.addEventListener('click', toggleDarkMode);

  // ===============================
  // TOMBOL STATUS KAVLING
  // ===============================
  document.getElementById('statusKavling')?.addEventListener('click', async () => {
    if (!isStatusMode) {
      await fetchKavlingStatus();
    } else {
      resetStatusMode();
    }
  });

  // ===============================
  // MODAL SERTIFIKAT
  // ===============================
  document.getElementById('searchByCertificate')?.addEventListener('click', () => {
    document.getElementById('certificateModal').style.display = 'flex';
  });

  document.querySelector('.close-modal')?.addEventListener('click', () => {
    document.getElementById('certificateModal').style.display = 'none';
  });

  document.getElementById('closeModal')?.addEventListener('click', () => {
    document.getElementById('certificateModal').style.display = 'none';
  });

  document.getElementById('certificateModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-modal') || e.target.id === 'closeModal') {
      document.getElementById('certificateModal').style.display = 'none';
    }
  });

  document.getElementById('clearAll')?.addEventListener('click', () => {
    document.querySelectorAll('.compact-input').forEach(input => input.value = '');
    document.getElementById('certificateResults').innerHTML = 
      '<p class="placeholder" style="font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 40px 20px; color: #757575; font-style: italic;">Hasil pencarian akan ditampilkan di sini...</p>';
  });

  // ===============================
  // PENCARIAN SERTIFIKAT
  // ===============================
  document.getElementById('searchInduk')?.addEventListener('click', async () => {
    const certNumber = document.getElementById('certInduk').value.trim();
    await searchCertificateNew(certNumber, 'induk', 'Sertifikat Induk');
  });

  document.getElementById('searchSHGB')?.addEventListener('click', async () => {
    const certNumber = document.getElementById('certSHGB').value.trim();
    await searchCertificateNew(certNumber, 'shgb', 'SHGB');
  });

  document.getElementById('searchSHM')?.addEventListener('click', async () => {
    const certNumber = document.getElementById('certSHM').value.trim();
    await searchCertificateNew(certNumber, 'shm', 'SHM');
  });

  document.getElementById('searchNamaSHM')?.addEventListener('click', async () => {
    const certNumber = document.getElementById('certNamaSHM').value.trim();
    await searchCertificateNew(certNumber, 'nama_shm', 'Nama SHM');
  });

  document.getElementById('searchExOwner')?.addEventListener('click', async () => {
    const certNumber = document.getElementById('certExOwner').value.trim();
    await searchCertificateNew(certNumber, 'ex_owner', 'Nama Pemilik Lama / EX');
  });

  // ===============================
  // ENTER KEY SUPPORT
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

  document.getElementById('certExOwner')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('searchExOwner').click();
    }
  });

  // ===============================
  // SEARCH KAVLING
  // ===============================
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    resultsBox.innerHTML = '';
    if (!q) return;

    const upper = q.toUpperCase();

    const blokItems = kavlingIndex.filter(id => id.startsWith(upper + '_'));
    if (blokItems.length && !q.includes('_')) {
      const liBlok = document.createElement('li');
      liBlok.textContent = `${upper} (${blokItems.length} kavling)`;
      liBlok.style.fontWeight = 'bold';
      liBlok.onclick = () => focusBlok(upper);
      resultsBox.appendChild(liBlok);
    }

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

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchInput.value.trim().toUpperCase();

      if (!query) return;

      resultsBox.innerHTML = '';

      if (query.includes('_')) {
        if (kavlingIndex.includes(query)) {
          focusKavling(query);
        } else {
          showKavlingPopup(query, { 
            status: 'notfound',
            message: `Kode "${query}" tidak ditemukan`
          });
        }
      } else {
        const blokItems = kavlingIndex.filter(id => id.startsWith(query + '_'));
        if (blokItems.length > 0) {
          focusBlok(query);
        } else {
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

  function focusKavling(id) {
    const svg = map.querySelector('svg');
    const el = document.getElementById(id);
    if (!el) return;

    clearHighlight();

    if (!isStatusMode) {
      clearStatusColors();
    }

    if (el.tagName.toLowerCase() === 'g') {
      el.querySelectorAll('rect, path, polygon').forEach(c => {
        const parent = c.closest('g');
        const target = (parent && parent.id && parent.id !== 'map') ? parent : c;

        if (!target.classList.contains('kavling-status-kpr') && 
            !target.classList.contains('kavling-status-stok') && 
            !target.classList.contains('kavling-status-rekom') && 
            !target.classList.contains('kavling-status-disewakan') &&
            !target.classList.contains('kavling-status-unknown')) {
          c.style.fill = '#ffd54f';
          c.style.stroke = '#ff6f00';
          c.style.strokeWidth = '2';
        }
      });
    } else {
      if (!el.classList.contains('kavling-status-kpr') && 
          !el.classList.contains('kavling-status-stok') && 
          !el.classList.contains('kavling-status-rekom') && 
          !el.classList.contains('kavling-status-disewakan') &&
          !el.classList.contains('kavling-status-unknown')) {
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

    fetchDataForAddress(id);
  }

  function focusBlok(prefix) {
    const svg = map.querySelector('svg');
    clearHighlight();

    if (!isStatusMode) {
      clearStatusColors();
    }

    const els = [...map.querySelectorAll(`[id^="${prefix}_"]`)];
    if (!els.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    els.forEach(el => {
      if (el.tagName.toLowerCase() === 'g') {
        el.querySelectorAll('rect, path, polygon').forEach(c => {
          const parent = c.closest('g');
          const target = (parent && parent.id && parent.id !== 'map') ? parent : c;

          if (!target.classList.contains('kavling-status-kpr') && 
              !target.classList.contains('kavling-status-stok') && 
              !target.classList.contains('kavling-status-rekom') && 
              !target.classList.contains('kavling-status-disewakan') &&
              !target.classList.contains('kavling-status-unknown')) {
            c.style.fill = '#ffd54f';
            c.style.stroke = '#ff6f00';
            c.style.strokeWidth = '2';
          }
        });
      } else {
        if (!el.classList.contains('kavling-status-kpr') && 
            !el.classList.contains('kavling-status-stok') && 
            !el.classList.contains('kavling-status-rekom') && 
            !el.classList.contains('kavling-status-disewakan') &&
            !el.classList.contains('kavling-status-unknown')) {
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

    fetchDataForAddress(prefix);
  }

  map.addEventListener('click', e => {
    if (isDragging) return;

    let t = e.target;

    while (t && t !== map) {
      if (t.id && /^(GA|UJ|KR|M|BLOK)/i.test(t.id)) {
        const id = t.id.toUpperCase();
        resultsBox.innerHTML = '';

        searchInput.value = id;

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

  map.addEventListener('mousedown', e => {
    isPanning = true;
    isDragging = false;
    panStart = { x: e.clientX, y: e.clientY };
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

  map.addEventListener('mouseup', () => isPanning = false);
  map.addEventListener('mouseleave', () => isPanning = false);

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

  resetBtn.onclick = () => {
    const svg = map.querySelector('svg');
    clearHighlight();
    clearStatusColors();

    if (svg && originalViewBox) {
      svg.setAttribute('viewBox', originalViewBox);
      viewBoxState = parseViewBox(originalViewBox);
    }
    lastFocusedEl = null;
    zoomPadding = null;
    searchInput.value = '';
    resultsBox.innerHTML = '';
    closeKavlingPopup();

    if (isStatusMode) {
      resetStatusMode();
    }
  };

  // Terapkan dark mode saat load
  applyDarkMode();
});
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
}); // PENUTUP UNTUK DOMContentLoaded
