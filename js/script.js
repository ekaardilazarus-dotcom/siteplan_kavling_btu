// ===============================
// FINAL CLEAN SCRIPT – SVG MAP
// Search blok & kavling, zoom, pan, click sync
// ===============================

const API_URL = 'https://script.google.com/macros/s/AKfycbxJlk6tZ5kFfFFlLwaSXXh6VBqev3KcX_DkhGq_fcW85bfHR-1iK_9ABmu9264_tLuo/exec';

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
// DOM READY
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  const map = document.getElementById('map');
  const searchInput = document.getElementById('search');
  const resultsBox = document.getElementById('search-results');
  const resetBtn = document.getElementById('resetZoom');
  const hasilDataBox = document.getElementById('hasilData');

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
  // MODAL SERTIFIKAT
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
  document.getElementById('clearAll')?.addEventListener('click', () => {
    document.querySelectorAll('.cert-input').forEach(input => input.value = '');
    document.getElementById('certificateResults').innerHTML = 
      '<p class="placeholder">Hasil akan ditampilkan di sini...</p>';
  });
  
  // Tombol kembali ke awal (dalam modal)
  document.getElementById('backToHome')?.addEventListener('click', () => {
    // Tutup modal
    document.getElementById('certificateModal').style.display = 'none';
    // Panggil fungsi reset
    document.getElementById('resetZoom').click();
  });

  // ===============================
  // SEARCH (BLOK + KAVLING)
  // ===============================
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    resultsBox.innerHTML = '';
    if (!q) return;

    const upper = q.toUpperCase();
// ===============================
// AUTO-SELECT DROPDOWN
// ===============================
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  resultsBox.innerHTML = '';
  if (!q) return;

  const upper = q.toUpperCase();

  // AUTO-SELECT: Jika query persis sama dengan salah satu item
  const exactMatch = kavlingIndex.find(id => id.toUpperCase() === upper);
  if (exactMatch) {
    setTimeout(() => {
      if (exactMatch.includes('_')) {
        focusKavling(exactMatch);
      } else {
        focusBlok(exactMatch);
      }
    }, 100);
    return;
  }

  // BLOK OTOMATIS (kode yang sudah ada)
  const blokItems = kavlingIndex.filter(id => id.startsWith(upper + '_'));
  if (blokItems.length && !q.includes('_')) {
    const liBlok = document.createElement('li');
    liBlok.textContent = `${upper} (${blokItems.length} kavling)`;
    liBlok.style.fontWeight = 'bold';
    liBlok.onclick = () => focusBlok(upper);
    resultsBox.appendChild(liBlok);
  }

  // KAVLING DETAIL (kode yang sudah ada)
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
    // BLOK OTOMATIS
    const blokItems = kavlingIndex.filter(id => id.startsWith(upper + '_'));
    if (blokItems.length && !q.includes('_')) {
      const liBlok = document.createElement('li');
      liBlok.textContent = `${upper} (${blokItems.length} kavling)`;
      liBlok.style.fontWeight = 'bold';
      liBlok.onclick = () => focusBlok(upper);
      resultsBox.appendChild(liBlok);
    }
// ===============================
// ENTER KEY SUPPORT
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
        // Jika tidak ditemukan, tampilkan pesan
        hasilDataBox.innerHTML = `
          <div style="padding:10px; background:#ffebee; border-radius:4px; color:#c62828;">
            <strong>Kavling tidak ditemukan:</strong> ${query}
          </div>
        `;
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
          hasilDataBox.innerHTML = `
            <div style="padding:10px; background:#ffebee; border-radius:4px; color:#c62828;">
              <strong>Blok/Kavling tidak ditemukan:</strong> ${query}
            </div>
          `;
        }
      }
    }
  }
});
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
  // RENDER DATA HASIL
  // ===============================
  function renderHasilData(address, result) {
    if (!hasilDataBox) return;
    
    // Reset konten
    hasilDataBox.innerHTML = '';
    
    // Buat container utama
    const container = document.createElement('div');
    container.style.cssText = `
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #333;
    `;
    
    // Header dengan kode
    const header = document.createElement('div');
    header.style.cssText = `
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e0e0e0;
      color: #1a237e;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    const iconSpan = document.createElement('span');
    iconSpan.textContent = '📋';
    
    const textSpan = document.createElement('span');
    textSpan.textContent = `Kode: ${address}`;
    
    header.appendChild(iconSpan);
    header.appendChild(textSpan);
    container.appendChild(header);
    
    // Status container
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = `
      font-size: 13px;
      margin-bottom: 12px;
      padding: 8px 10px;
      border-radius: 6px;
      font-weight: 500;
    `;
    
    // Data container
    const dataDiv = document.createElement('div');
    dataDiv.style.cssText = `
      font-size: 13px;
      line-height: 1.6;
      max-height: 300px;
      overflow-y: auto;
      padding: 5px;
    `;
    
    // Set berdasarkan status
    switch (result.status) {
      case 'loading':
        statusDiv.textContent = '⏳ Memuat data dari database...';
        statusDiv.style.backgroundColor = '#e3f2fd';
        statusDiv.style.color = '#0d47a1';
        statusDiv.style.borderLeft = '4px solid #2196f3';
        dataDiv.innerHTML = '<div style="color:#666; padding:10px; text-align:center;">Mohon tunggu...</div>';
        break;
        
      case 'success':
        statusDiv.textContent = '✅ Data ditemukan';
        statusDiv.style.backgroundColor = '#e8f5e9';
        statusDiv.style.color = '#1b5e20';
        statusDiv.style.borderLeft = '4px solid #4caf50';
        
        if (result.data && result.data.trim() !== '') {
          // FORMAT SANGAT SIMPLE: Teks asli saja
          const textContainer = document.createElement('div');
          textContainer.style.cssText = `
            font-family: monospace;
            font-size: 12px;
            line-height: 1.4;
            white-space: pre-wrap;
            background: #f9f9f9;
            padding: 12px;
            border-radius: 3px;
            border: 1px solid #ddd;
            max-height: 280px;
            overflow-y: auto;
          `;
          
          // Tampilkan teks asli dari spreadsheet
          textContainer.textContent = result.data.trim();
          dataDiv.appendChild(textContainer);
          
        } else {
          dataDiv.innerHTML = '<div style="color:#666; padding:8px;">Data kosong</div>';
        }
        break;
        
      case 'empty':
        statusDiv.textContent = 'ℹ️ Data ditemukan';
        statusDiv.style.backgroundColor = '#fff3e0';
        statusDiv.style.color = '#e65100';
        statusDiv.style.borderLeft = '4px solid #ff9800';
        dataDiv.innerHTML = '<div style="color:#666; padding:10px; text-align:center;">Tidak ada data di kolom AI</div>';
        break;
        
      case 'notfound':
        statusDiv.textContent = '🔍 Data tidak ditemukan';
        statusDiv.style.backgroundColor = '#fff3e0';
        statusDiv.style.color = '#e65100';
        statusDiv.style.borderLeft = '4px solid #ff9800';
        dataDiv.innerHTML = `
          <div style="color:#e65100; padding:10px; text-align:center;">
            <div style="margin-bottom:5px;">⚠️ Kode <strong>${address}</strong> tidak terdaftar</div>
            <div style="font-size:12px; color:#757575;">Periksa kembali penulisan kode</div>
          </div>
        `;
        break;
        
      case 'error':
        statusDiv.textContent = '❌ Kesalahan';
        statusDiv.style.backgroundColor = '#ffebee';
        statusDiv.style.color = '#c62828';
        statusDiv.style.borderLeft = '4px solid #f44336';
        dataDiv.innerHTML = `
          <div style="color:#c62828; padding:10px;">
            <strong>Gagal mengambil data:</strong><br>
            <span style="font-size:12px;">${result.message || 'Terjadi kesalahan tidak diketahui'}</span>
          </div>
        `;
        break;
        
      default:
        statusDiv.textContent = '❓ Status tidak diketahui';
        statusDiv.style.backgroundColor = '#f5f5f5';
        statusDiv.style.color = '#616161';
    }
    
    container.appendChild(statusDiv);
    container.appendChild(dataDiv);
    hasilDataBox.appendChild(container);
  }

  // ===============================
  // FUNGSI UTAMA: AMBIL DATA DARI API (DENGAN CACHE)
  // ===============================
  async function fetchDataForAddress(address) {
    if (!address || !address.trim()) {
      console.log('❌ Address kosong');
      return;
    }
    
    const cleanAddress = address.trim().toUpperCase();
    console.log('🔍 Mencari data untuk:', cleanAddress);
    
    // CEK CACHE PERTAMA
    const cached = searchCache.get(cleanAddress);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log('⚡ HIT CACHE:', cleanAddress);
      renderHasilData(cleanAddress, {
        status: 'success',
        data: cached.data,
        message: 'Data ditemukan (Cached)'
      });
      return; // Jangan lanjut fetch API
    }
    
    // Tampilkan loading jika tidak ada di cache
    renderHasilData(cleanAddress, { status: 'loading' });

    try {
      // Encode address untuk URL
      const encodedAddress = encodeURIComponent(cleanAddress);
      const url = `${API_URL}?address=${encodedAddress}`;
      
      console.log('🌐 Mengambil data dari:', url);
      
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
      console.log('📦 Data diterima:', data);
      
      // SIMPAN KE CACHE jika success
      if (data.status === 'success' && data.data) {
        console.log('💾 Menyimpan ke cache:', cleanAddress);
        searchCache.set(cleanAddress, {
          data: data.data || '',
          timestamp: Date.now()
        });
      }
      
      // HANDLE BERDASARKAN STATUS DARI API BARU
      switch (data.status) {
        case 'success':
          renderHasilData(cleanAddress, { 
            status: 'success',
            message: data.message || 'Data ditemukan',
            data: data.data || ''
          });
          break;
          
        case 'empty':
          renderHasilData(cleanAddress, { 
            status: 'empty',
            message: data.message || 'Data ditemukan tetapi kolom kosong',
            data: data.data || ''
          });
          break;
          
        case 'not_found':
          renderHasilData(cleanAddress, { 
            status: 'notfound',
            message: data.message || 'Kode tidak ditemukan'
          });
          break;
          
        case 'error':
          renderHasilData(cleanAddress, { 
            status: 'error', 
            message: data.message || 'Error dari server'
          });
          break;
          
        default:
          // Fallback untuk format lama
          if (data.error) {
            renderHasilData(cleanAddress, { 
              status: 'error', 
              message: data.error
            });
          } else {
            renderHasilData(cleanAddress, { 
              status: 'error', 
              message: 'Format respons tidak dikenal'
            });
          }
      }

    } catch (err) {
      console.error('❌ Error fetch data:', err);
      
      // Deteksi jenis error - PERBAIKAN: UPDATE KE 40 DETIK
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
      
      renderHasilData(cleanAddress, { 
        status: 'error', 
        message: errorMessage 
      });
    }
  }

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
  // FUNGSI TESTING
  // ===============================
  window.testAPI = async function(kode) {
    const testAddress = kode || 'UJ35_29';
    console.log('🧪 Testing API dengan kode:', testAddress);
    
    const url = `${API_URL}?address=${encodeURIComponent(testAddress)}&_t=${Date.now()}`;
    
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
    if (hasilDataBox) hasilDataBox.innerHTML = '';
  };

}); 
