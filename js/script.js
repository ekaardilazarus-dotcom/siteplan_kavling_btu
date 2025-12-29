// ===============================
// FINAL CLEAN SCRIPT – SVG MAP
// Search blok & kavling, zoom, pan, click sync
// ===============================

const API_URL = 'https://script.google.com/macros/s/AKfycbxJlk6tZ5kFfFFlLwaSXXh6VBqev3KcX_DkhGq_fcW85bfHR-1iK_9ABmu9264_tLuo/exec';
const CERT_API_URL = 'https://script.google.com/macros/s/AKfycbxGcR1WN6SYqzfaiPhL2KRfIa-xzF39RR3xSosmeRY2tayd56-ZRC7TOQdBMW-8syi_3w/exec';

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

// ===============================
// CACHE SYSTEM
// ===============================
const searchCache = new Map();
const certSearchCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 menit

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
    .forEach(el => el.style.cssText = '');
}

// ===============================
// POPUP MANAGEMENT
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

// ===============================
// FUNGSI PENCARIAN SERTIFIKAT (DATABASE BARU)
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
    }
    
    // Tampilkan hasil
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
  
  // Tampilkan loading di popup (status: 'loading')
  showKavlingPopup(cleanAddress, { 
    status: 'loading',
    message: 'Sedang mencari data...'
  });
  
  // CEK CACHE PERTAMA
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
  
  // ... (kode fetch API tetap sama)
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
    }
    
    // HANDLE BERDASARKAN STATUS DARI API
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

// ===============================
// DOM READY
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  const map = document.getElementById('map');
  const searchInput = document.getElementById('search');
  const resultsBox = document.getElementById('search-results');
  const resetBtn = document.getElementById('resetZoom');

  searchInput.disabled = true;

  // ===============================
  // LOAD SVG DENGAN CACHE (SAMA SEPERTI SEBELUMNYA)
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
  // MODAL SERTIFIKAT (DATABASE BARU)
  // ===============================
  
  // Buka modal
  document.getElementById('searchByCertificate')?.addEventListener('click', () => {
    document.getElementById('certificateModal').style.display = 'flex';
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
    if (e.target.id === 'certificateModal') {
      document.getElementById('certificateModal').style.display = 'none';
    }
  });
  
  // Tombol bersihkan
// Tombol bersihkan
document.getElementById('clearAll')?.addEventListener('click', () => {
  document.querySelectorAll('.compact-input').forEach(input => input.value = '');
  document.getElementById('certificateResults').innerHTML = 
    '<p class="placeholder" style="font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 40px 20px; color: #757575; font-style: italic;">Hasil pencarian akan ditampilkan di sini...</p>';
});
  
  // ===============================
  // PENCARIAN SERTIFIKAT (SEMUA TIPE)
  // ===============================
  
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

  // Nama SHM (BARU)
  document.getElementById('searchNamaSHM')?.addEventListener('click', async () => {
    const certNumber = document.getElementById('certNamaSHM').value.trim();
    await searchCertificateNew(certNumber, 'nama_shm', 'Nama SHM');
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

    clearHighlight();

    if (el.tagName.toLowerCase() === 'g') {
      el.querySelectorAll('rect, path, polygon').forEach(c => {
        c.style.fill = '#ffd54f';
        c.style.stroke = '#ff6f00';
        c.style.strokeWidth = '2';
      });
    } else {
      el.style.fill = '#ffd54f';
      el.style.stroke = '#ff6f00';
      el.style.strokeWidth = '2';
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

    const els = [...map.querySelectorAll(`[id^="${prefix}_"]`)];
    if (!els.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    els.forEach(el => {
      if (el.tagName.toLowerCase() === 'g') {
        el.querySelectorAll('rect, path, polygon').forEach(c => {
          c.style.fill = '#ffd54f';
          c.style.stroke = '#ff6f00';
          c.style.strokeWidth = '2';
        });
      } else {
        el.style.fill = '#ffd54f';
        el.style.stroke = '#ff6f00';
        el.style.strokeWidth = '2';
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
// Tambah di DOMContentLoaded:
document.getElementById('searchExOwner')?.addEventListener('click', async () => {
  const certNumber = document.getElementById('certExOwner').value.trim();
  await searchCertificateNew(certNumber, 'ex_owner', 'Nama Pemilik Lama / EX');
});

// Enter key support:
document.getElementById('certExOwner')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('searchExOwner').click();
  }
});
}); // <-- PENUTUP DOMContentLoaded
