// ===============================
// FINAL CLEAN SCRIPT – SVG MAP
// Search blok & kavling, zoom, pan, click sync
// Menambahkan: fetch data dari API dan render hasil di #hasilData (uji koneksi)
// ===============================

const API_URL = 'https://script.google.com/macros/s/AKfycbzfy6vbrVBdWnmdwxh5I68BGDz2GmP3UORC8xQlb49GAe-hsQ3QTGUBj9Ezz8de2dY2/exec';

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

// sanitize sederhana untuk mencegah injeksi HTML jika diperlukan
function sanitizeText(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

    // Setup viewbox dengan fallback
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
    // Load SVG dengan timeout untuk prevent hang
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
  // SEARCH (BLOK + KAVLING)
  // ===============================
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    resultsBox.innerHTML = '';
    if (!q) return;

    const upper = q.toUpperCase();

    // BLOK OTOMATIS (uj10, ga34)
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
  // TAMPILKAN DATA DARI DATABASE (UI + LOGIKA)
  // - renderHasilData: tampilkan header segera, status, dan baris data
  // - fetchDataForAddress: panggil API, tangani JSON/text, fallback pesan
  // ===============================
function renderHasilData(address, data) {
  if (!hasilDataBox) return;
  hasilDataBox.innerHTML = ''; // reset

  const header = document.createElement('div');
  header.style.fontWeight = '700';
  header.style.marginBottom = '6px';
  header.style.fontSize = '14px';
  header.textContent = `Kode: ${address}`;
  hasilDataBox.appendChild(header);

  // Status koneksi
  const statusDiv = document.createElement('div');
  statusDiv.style.fontSize = '12px';
  statusDiv.style.color = '#666';
  statusDiv.style.marginBottom = '8px';
  hasilDataBox.appendChild(statusDiv);

  // Container untuk data
  const dataDiv = document.createElement('div');
  dataDiv.style.fontSize = '13px';
  dataDiv.style.lineHeight = '1.4';
  hasilDataBox.appendChild(dataDiv);

  // Update berdasarkan state
  if (data.status === 'loading') {
    statusDiv.textContent = 'Memuat data dari database...';
    statusDiv.style.color = '#2196F3';
    dataDiv.innerHTML = '<div style="color:#666">Mohon tunggu...</div>';
  } 
  else if (data.status === 'error') {
    statusDiv.textContent = 'Kesalahan koneksi';
    statusDiv.style.color = '#F44336';
    dataDiv.innerHTML = `<div style="color:#F44336">${data.message || 'Gagal terhubung ke server'}</div>`;
  }
  else if (data.status === 'success') {
    if (!data.found) {
      statusDiv.textContent = 'Data tidak ditemukan';
      statusDiv.style.color = '#FF9800';
      dataDiv.innerHTML = '<div style="color:#FF9800">Kode ini tidak ada di database</div>';
    }
    else if (!data.ai) {
      statusDiv.textContent = 'Data ditemukan';
      statusDiv.style.color = '#4CAF50';
      dataDiv.innerHTML = '<div style="color:#666">Tidak ada data di kolom AI</div>';
    }
    else {
      statusDiv.textContent = 'Data ditemukan';
      statusDiv.style.color = '#4CAF50';
      
      // Format data dari kolom AI (asumsi data dipisah newline)
      const lines = data.ai.split(/\r?\n/).filter(Boolean);
      
      if (lines.length === 0) {
        dataDiv.innerHTML = '<div style="color:#666">Tidak ada data di kolom AI</div>';
      } else {
        lines.forEach(line => {
          const p = document.createElement('div');
          p.style.marginBottom = '6px';
          p.style.padding = '4px 0';
          p.style.borderBottom = '1px solid #eee';
          p.innerText = line;
          dataDiv.appendChild(p);
        });
      }
    }
  }
}

async function fetchDataForAddress(address) {
  if (!address) return;
  
  // Tampilkan loading state
  renderHasilData(address, { status: 'loading' });

  try {
    // Encode address untuk URL
    const encodedAddress = encodeURIComponent(address);
    const url = `${API_URL}?address=${encodedAddress}`;
    
    console.log('Fetching URL:', url); // Debug
    
    const res = await fetch(url, { 
      method: 'GET',
      mode: 'cors'
    });

    console.log('Response status:', res.status); // Debug
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    // Parse JSON
    const data = await res.json();
    console.log('Response data:', data); // Debug

    // Handle respons berdasarkan struktur baru
    if (data.error) {
      renderHasilData(address, { 
        status: 'error', 
        message: data.message || data.error 
      });
    } 
    else if (data.found === false) {
      renderHasilData(address, { 
        status: 'success', 
        found: false,
        ai: '',
        message: data.message 
      });
    }
    else if (data.found === true) {
      renderHasilData(address, { 
        status: 'success', 
        found: true,
        ai: data.ai || '',
        message: data.message 
      });
    }
    else {
      // Fallback untuk struktur lama
      renderHasilData(address, { 
        status: 'success', 
        found: !!data.ai,
        ai: data.ai || '',
        message: data.message || 'Data ditemukan' 
      });
    }

  } catch (err) {
    console.error('Gagal mengambil data:', err);
    renderHasilData(address, { 
      status: 'error', 
      message: 'Tidak terkoneksi ke database. Periksa koneksi internet atau URL API.' 
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

    // Panggil API untuk menampilkan data detail kavling (uji koneksi)
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

    // Panggil API untuk menampilkan ringkasan blok (uji koneksi)
    fetchDataForAddress(prefix);
  }

  // ===============================
  // CLICK MAP (SYNC FIXED)
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
