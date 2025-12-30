// ===============================
// FINAL CLEAN SCRIPT – SVG MAP
// Search blok & kavling, zoom, pan, click sync + STATUS KAVLING
// ===============================

const API_URL = 'https://script.google.com/macros/s/AKfycbwbBmXFoTtWa0XxK-ogxueDUkjzAKzhE7sPQaDMQvTIy7_FhA-DGMBJyYzzTyUVXw/exec';
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
let isStatusMode = false; // Tambahan: flag untuk mode status
let statusData = null; // Tambahan: simpan data status

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
// FUNGSI BARU: STATUS KAVLING
// ===============================

// ===============================
// FUNGSI BARU: STATUS KAVLING (DIPERBAIKI)
// ===============================

async function fetchKavlingStatus() {
  try {
    console.log('🔍 Mengambil data status kavling...');
    
    // Tampilkan loading di panel
    const panelBody = document.querySelector('.status-panel-body');
    if (panelBody) {
      panelBody.innerHTML = `
        <div class="status-loading">
          <div class="status-loading-spinner"></div>
          <div style="color:#666;font-size:14px;margin-top:10px;">
            Memuat data status kavling...
            <br><span style="font-size:12px;color:#999;">Mohon tunggu...</span>
          </div>
        </div>
      `;
    }
    
    // Tampilkan popup loading
    showKavlingPopup('STATUS KAVLING', { 
      status: 'loading',
      message: 'Mengambil data status dari server...'
    });
    
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
    
    // Ambil data sebagai teks dulu untuk debugging
    const responseText = await response.text();
    console.log('📦 Raw Response:', responseText);
    
    // Parse JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError);
      console.error('Response text:', responseText);
      throw new Error('Format response tidak valid');
    }
    
    console.log('✅ Data status diterima:', data);
    
    // Tutup popup loading
    closeKavlingPopup();
    
    // Simpan data ke variabel global
    statusData = data;
    
    // Tampilkan panel statistik
    showStatusPanel(data);
    
    // Beri warna pada kavling di peta
    colorizeKavling(data.data || []);
    
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
        </div>
      `;
    }
    
    // Tampilkan error di popup
    showKavlingPopup('ERROR', { 
      status: 'error', 
      message: `Gagal mengambil data: ${error.message}<br><br>URL API: ${API_URL}?action=status` 
    });
    
    return null;
  }
}
//beri warna
function colorizeKavling(kavlingData) {
  const svgMap = document.querySelector('#map svg');
  if (!svgMap) {
    console.error('❌ SVG map tidak ditemukan');
    return;
  }
  
  console.log(`🎨 Mulai mewarnai ${kavlingData.length} kavling`);
  
  // Reset semua warna
  clearStatusColors();
  
  let coloredCount = 0;
  let notFoundCount = 0;
  
  // Loop setiap kavling dari data API
  kavlingData.forEach(item => {
    if (!item.kode) {
      console.warn('⚠️ Item tanpa kode:', item);
      return;
    }
    
    // Normalize kode (uppercase, trim)
    const kode = item.kode.trim().toUpperCase();
    
    // Cari element di SVG
    let element = document.getElementById(kode);
    
    // Jika tidak ditemukan dengan ID langsung, coba cari dengan selector lain
    if (!element) {
      // Coba cari dengan pola lain (misal: "GA" menjadi "GA_")
      const elements = document.querySelectorAll(`[id*="${kode}"]`);
      if (elements.length > 0) {
        element = elements[0];
        console.log(`🔍 Found alternative for ${kode}:`, element.id);
      }
    }
    
    if (element) {
      // Tambahkan kelas CSS berdasarkan kategori
      if (item.kategori && item.kategori !== 'lainnya') {
        const className = `kavling-status-${item.kategori}`;
        
        // Tambah kelas ke element
        element.classList.add(className);
        
        // Jika element adalah group, warnai child-nya juga
        if (element.tagName.toLowerCase() === 'g') {
          const children = element.querySelectorAll('rect, path, polygon, circle');
          children.forEach(child => {
            child.classList.add(className);
          });
        }
        
        coloredCount++;
        
        // Debug log setiap 10 kavling
        if (coloredCount % 10 === 0) {
          console.log(`✅ ${coloredCount} kavling diberi warna`);
        }
      }
    } else {
      notFoundCount++;
      // Debug untuk kavling yang tidak ditemukan (max 5)
      if (notFoundCount <= 5) {
        console.warn(`❓ Kavling tidak ditemukan di SVG: "${kode}"`);
      }
    }
  });
  
  console.log(`🎨 Selesai: ${coloredCount} kavling berwarna, ${notFoundCount} tidak ditemukan`);
  
  // Jika banyak yang tidak ditemukan, tampilkan warning
  if (notFoundCount > kavlingData.length * 0.5) {
    console.warn(`⚠️ PERINGATAN: ${notFoundCount} dari ${kavlingData.length} kavling tidak ditemukan di peta!`);
    console.warn('Mungkin ID di SVG berbeda dengan ID di database');
    
    // Tampilkan sample ID yang tidak ditemukan
    const notFoundSamples = [];
    kavlingData.slice(0, 5).forEach(item => {
      const element = document.getElementById(item.kode.trim().toUpperCase());
      if (!element) notFoundSamples.push(item.kode);
    });
    
    if (notFoundSamples.length > 0) {
      console.warn('Contoh ID yang tidak ditemukan:', notFoundSamples);
    }
  }
}

// 3. Hapus semua warna status
function clearStatusColors() {
  // Hapus kelas warna dari semua elemen kavling
  document.querySelectorAll('[id^="GA"], [id^="UJ"], [id^="KR"], [id^="M"], [id^="Blok"]')
    .forEach(el => {
      el.classList.remove(
        'kavling-status-kpr',
        'kavling-status-stok', 
        'kavling-status-rekom',
        'kavling-status-disewakan'
      );
      
      // Hapus juga dari child elements jika group
      if (el.tagName.toLowerCase() === 'g') {
        el.querySelectorAll('rect, path, polygon').forEach(child => {
          child.classList.remove(
            'kavling-status-kpr',
            'kavling-status-stok', 
            'kavling-status-rekom',
            'kavling-status-disewakan'
          );
        });
      }
    });
}

// 4. Tampilkan panel statistik
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

// 5. Nonaktifkan mode status
function resetStatusMode() {
  // Reset warna kavling
  clearStatusColors();
  
  // Sembunyikan panel
  const panel = document.getElementById('statusPanel');
  if (panel) panel.style.display = 'none';
  
  // Nonaktifkan tombol
  const statusBtn = document.getElementById('statusKavling');
  if (statusBtn) statusBtn.classList.remove('active');
  
  isStatusMode = false;
  statusData = null;
  console.log('🔄 Mode status dinonaktifkan');
}

// 6. Download data per kategori
async function downloadKavlingData(type) {
  try {
    console.log(`📥 Memulai download data ${type}...`);
    
    // Tampilkan loading di panel
    const resultsBox = document.getElementById('certificateResults');
    if (resultsBox) {
      resultsBox.innerHTML = `
        <div class="cert-loading">
          <div class="cert-loading-spinner"></div>
          <div style="color:#666;font-size:14px;margin-top:10px;">
            Memproses data ${type.toUpperCase()}...
          </div>
        </div>
      `;
    }
    
    const url = `${API_URL}?action=download&type=${type}&_t=${Date.now()}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    // Tampilkan data di popup
    showDownloadPopup(data, type);
    
  } catch (error) {
    console.error(`❌ Gagal download data ${type}:`, error);
    alert(`Gagal download data ${type}. Coba lagi nanti.`);
  }
}

// 7. Popup untuk menampilkan data download
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
  // TOMBOL STATUS KAVLING (FITUR BARU)
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
  
  // Event listener untuk tombol download di panel status
  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const type = this.getAttribute('data-type');
      downloadKavlingData(type);
    });
  });

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
    if (e.target.classList.contains('close-modal') || e.target.id === 'closeModal') {
      document.getElementById('certificateModal').style.display = 'none';
    }
  });
  
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
    
    // Hapus juga warna status jika ada
    clearStatusColors();

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
    
    // Hapus juga warna status jika ada
    clearStatusColors();

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
    clearStatusColors(); // Juga reset warna status
    
    if (svg && originalViewBox) {
      svg.setAttribute('viewBox', originalViewBox);
      viewBoxState = parseViewBox(originalViewBox);
    }
    lastFocusedEl = null;
    zoomPadding = null;
    searchInput.value = '';
    resultsBox.innerHTML = '';
    closeKavlingPopup();
    
    // Juga reset mode status jika aktif
    if (isStatusMode) {
      resetStatusMode();
    }
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

// Event listener untuk klik di luar popup
document.addEventListener('click', function(e) {
  const popup = document.querySelector('.kavling-popup');
  const modal = document.getElementById('certificateModal');
  
  // Untuk kavling popup
  if (popup && popup.style.display === 'flex') {
    const content = popup.querySelector('.kavling-popup-content');
    const isCloseBtn = e.target.classList.contains('close-kavling-popup') || 
                       e.target.classList.contains('kavling-close-btn');
    
    // HANYA tutup jika klik tombol close
    if (isCloseBtn) {
      popup.remove();
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
}); // Penutup untuk DOMContentLoaded
