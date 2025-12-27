```javascript
// script.js
// Versi lengkap dengan perbaikan export PNG, penghapusan export SVG binding,
// dan penambahan info card (popup) minimal untuk menampilkan nama kavling/blok.

// Global state
let kavlingIndex = [];
let originalViewBox = null;
let viewBoxState = null;
let lastFocusedEl = null;
let zoomPadding = null;

let isPanning = false;
let isDragging = false;
let panStart = { x: 0, y: 0 };

// ===============================
// HELPERS
// ===============================
function parseViewBox(vb) {
  const [x, y, w, h] = vb.split(' ').map(Number);
  return { x, y, w, h };
}

function applyViewBox(svg) {
  svg.setAttribute('viewBox', `${viewBoxState.x} ${viewBoxState.y} ${viewBoxState.w} ${viewBoxState.h}`);
}

function clearHighlight() {
  document.querySelectorAll('#map rect, #map path, #map polygon, #map g')
    .forEach(el => el.style.cssText = '');
}

function isNumericString(s) {
  return /^\d+$/.test(String(s).trim());
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ===============================
// EXPORT: PNG (render current viewBox to canvas)
// Perbaikan: menjaga rasio viewBox, gunakan devicePixelRatio, set width/height pada clone
// ===============================
function exportCurrentViewAsPNG(svgEl, filename = 'map-view.png') {
  if (!svgEl || !viewBoxState) return;

  // clone dan set viewBox
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('viewBox', `${viewBoxState.x} ${viewBoxState.y} ${viewBoxState.w} ${viewBoxState.h}`);

  // Hitung rasio viewBox (unit SVG) untuk menjaga proporsi
  const vbW = viewBoxState.w;
  const vbH = viewBoxState.h;
  if (!vbW || !vbH) return;

  // Tentukan skala pixel per unit SVG. Gunakan devicePixelRatio untuk ketajaman.
  const dpr = window.devicePixelRatio || 1;
  // target minimal lebar pixel (sesuaikan jika perlu)
  const minPixelWidth = 1000;
  const scale = Math.max(dpr, minPixelWidth / vbW);

  const pixelWidth = Math.round(vbW * scale);
  const pixelHeight = Math.round(vbH * scale);

  // set explicit width/height pada clone agar renderer tahu ukuran
  clone.setAttribute('width', pixelWidth);
  clone.setAttribute('height', pixelHeight);

  // Serialize
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clone);
  if (!svgString.match(/^<\?xml/)) {
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
  }
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Gunakan data URL (encode)
  const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      const ctx = canvas.getContext('2d');

      // optional white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // draw image scaled to canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        if (blob) downloadBlob(blob, filename);
      }, 'image/png');
    } catch (err) {
      console.error('Gagal mengekspor PNG', err);
    }
  };
  img.onerror = (err) => {
    console.error('Gagal memuat SVG untuk konversi PNG', err);
  };

  img.src = svgDataUrl;
}

// ===============================
// DOM READY
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  const map = document.getElementById('map');
  const searchInput = document.getElementById('search');
  const resultsBox = document.getElementById('search-results');
  const resetBtn = document.getElementById('resetZoom');

  // tombol zoom lama (jika ada) akan diubah fungsinya menjadi export (kita sembunyikan export SVG)
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');

  // juga dukung tombol khusus export PNG jika sudah ada
  const exportPngBtn = document.getElementById('exportPng');

  // info card element (harus ditambahkan di HTML)
  const infoCard = document.getElementById('infoCard');

  searchInput.disabled = true;

  // ===============================
  // LOAD SVG
  // ===============================
  fetch('sitemap.svg')
    .then(r => r.text())
    .then(svgText => {
      map.innerHTML = svgText;
      const svg = map.querySelector('svg');

      // make responsive
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      // ensure viewBox exists
      originalViewBox = svg.getAttribute('viewBox');
      if (!originalViewBox) {
        const b = svg.getBBox();
        originalViewBox = `${b.x} ${b.y} ${b.width} ${b.height}`;
        svg.setAttribute('viewBox', originalViewBox);
      }

      viewBoxState = parseViewBox(originalViewBox);

      // indexing ID kavling — simpan ID asli (preserve case)
      const ids = map.querySelectorAll('g[id], rect[id], path[id], polygon[id]');
      kavlingIndex = [...new Set(
        Array.from(ids)
          .map(el => el.id.trim()) // simpan ID asli
          .filter(id => /^(GA|UJ|KR|M)/i.test(id)) // case-insensitive filter
      )].sort((a, b) => a.localeCompare(b));

      searchInput.disabled = false;

      // Setup export buttons behavior:
      // Sembunyikan atau non-aktifkan tombol zoomIn (sebelumnya dipakai untuk export SVG)
      if (zoomInBtn) {
        zoomInBtn.classList.add('hidden');
      }

      // Pastikan export PNG tetap diikat
      if (exportPngBtn) {
        exportPngBtn.onclick = () => exportCurrentViewAsPNG(svg, 'map-view.png');
      }

      // Jika ada zoomOutBtn (tombol lama), kita biarkan tersembunyi agar tidak menumpuk UI
      if (zoomOutBtn) {
        // Jika Anda ingin tombol zoom lama tetap ada, ubah fungsinya di sini.
        // Untuk sekarang, sembunyikan agar tidak menumpuk UI.
        zoomOutBtn.classList.add('hidden');
      }
    })
    .catch(err => {
      console.error('Gagal memuat sitemap.svg', err);
      searchInput.disabled = false;
    });

  // ===============================
  // SEARCH (BLOK + KAVLING)
  // ===============================
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    resultsBox.innerHTML = '';
    if (!q) return;

    const upper = q.toUpperCase();

    // BLOK OTOMATIS (uj10, ga34) — case-insensitive
    const blokItems = kavlingIndex.filter(id => id.toUpperCase().startsWith(upper + '_'));
    if (blokItems.length && !q.includes('_')) {
      const liBlok = document.createElement('li');
      liBlok.textContent = `${upper} (${blokItems.length} kavling)`;
      liBlok.style.fontWeight = 'bold';
      liBlok.onclick = () => focusBlok(upper, window.innerWidth * 0.6, window.innerHeight * 0.4);
      resultsBox.appendChild(liBlok);
    }

    // KAVLING DETAIL (case-insensitive)
    kavlingIndex
      .filter(id => id.toLowerCase().includes(q))
      .slice(0, 20)
      .forEach(name => {
        const li = document.createElement('li');
        li.textContent = name; // tampilkan ID asli
        li.onclick = () => focusKavling(name, window.innerWidth / 2, window.innerHeight / 2);
        resultsBox.appendChild(li);
      });

    if (!resultsBox.children.length) {
      resultsBox.innerHTML = '<li style="color:#777">Tidak ditemukan</li>';
    }
  });

  // ===============================
  // FOCUS KAVLING
  // menerima optional clientX, clientY untuk posisi infoCard
  // ===============================
  function focusKavling(id, clientX, clientY) {
    const svg = map.querySelector('svg');
    // pastikan id ada
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

    // tampilkan info card minimal (hanya nama kavling jika DB belum ada)
    showInfoCard({
      id: id,
      type: el.tagName.toLowerCase() === 'g' ? 'Blok / Grup' : 'Kavling',
      notes: 'Data detail belum tersedia. Hanya menampilkan nama kavling.'
    }, clientX, clientY);
  }

  // ===============================
  // FOCUS BLOK
  // menerima optional clientX, clientY untuk posisi infoCard
  // ===============================
  function focusBlok(prefix, clientX, clientY) {
    const svg = map.querySelector('svg');
    clearHighlight();

    // ambil semua elemen ber-id lalu filter case-insensitive
    const all = Array.from(map.querySelectorAll('[id]'));
    const els = all.filter(el => el.id.toUpperCase().startsWith(prefix.toUpperCase() + '_'));
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

    // tampilkan info card ringkasan blok
    showInfoCard({
      id: prefix,
      type: 'Blok',
      notes: 'Ringkasan blok. Detail kavling akan tersedia setelah integrasi database.'
    }, clientX, clientY);
  }

  // ===============================
  // CLICK MAP (SYNC) — robust, ignore numeric-only clicks
  // ===============================
  map.addEventListener('click', e => {
    if (isDragging) return;

    // jika target adalah teks angka di dalam kotak, abaikan
    const t = e.target;
    if (t && t.tagName && t.tagName.toLowerCase() === 'text') {
      const txt = t.textContent || '';
      if (isNumericString(txt)) return; // abaikan klik angka
    }

    // cari ancestor terdekat yang punya id
    const elWithId = (e.target && e.target.closest) ? e.target.closest('[id]') : null;
    if (!elWithId) return;

    // jika id hanya angka, abaikan
    if (isNumericString(elWithId.id)) return;

    const actualId = elWithId.id; // gunakan ID asli, jangan ubah case
    resultsBox.innerHTML = '';

    // pass client coords so infoCard can position near pointer
    if (actualId.includes('_')) focusKavling(actualId, e.clientX, e.clientY);
    else focusBlok(actualId, e.clientX, e.clientY);
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
    svg.setAttribute('viewBox', originalViewBox);
    viewBoxState = parseViewBox(originalViewBox);
    lastFocusedEl = null;
    zoomPadding = null;
    searchInput.value = '';
    resultsBox.innerHTML = '';
    hideInfoCard();
  };

  // ===============================
  // INFO CARD (minimal)
  // ===============================
  function renderInfoCardContent(data) {
    return `
      <div class="title">${data.id}</div>
      <div class="row"><div class="muted">Tipe</div><div>${data.type || '-'}</div></div>
      <div style="margin-top:8px;font-size:13px;color:#374151">${data.notes || 'Informasi detail akan tersedia dari database.'}</div>
      <div style="display:flex;justify-content:flex-end;margin-top:10px;gap:8px">
        <button id="infoCloseBtn" style="padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:#fff">Tutup</button>
      </div>
    `;
  }

  function showInfoCard(data, clientX = window.innerWidth / 2, clientY = window.innerHeight / 2) {
    if (!infoCard) return;
    infoCard.innerHTML = renderInfoCardContent(data);
    infoCard.classList.remove('hidden');
    infoCard.setAttribute('aria-hidden', 'false');

    const cardWidth = 320;
    const cardHeight = 180;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = (typeof clientX === 'number') ? clientX + 12 : window.innerWidth / 2 - cardWidth / 2;
    let top = (typeof clientY === 'number') ? clientY + 12 : window.innerHeight / 2 - cardHeight / 2;

    if (left + cardWidth + margin > vw) left = vw - cardWidth - margin;
    if (top + cardHeight + margin > vh) top = vh - cardHeight - margin;
    if (left < margin) left = margin;
    if (top < margin) top = margin;

    infoCard.style.left = left + 'px';
    infoCard.style.top = top + 'px';

    const closeBtn = document.getElementById('infoCloseBtn');
    if (closeBtn) closeBtn.onclick = hideInfoCard;
  }

  function hideInfoCard() {
    if (!infoCard) return;
    infoCard.classList.add('hidden');
    infoCard.setAttribute('aria-hidden', 'true');
  }

  // tutup saat klik di luar infoCard, kecuali klik di search-container
  document.addEventListener('click', (ev) => {
    if (!infoCard || infoCard.classList.contains('hidden')) return;
    if (ev.target.closest && (ev.target.closest('#infoCard') || ev.target.closest('#search-container'))) return;
    hideInfoCard();
  });
});
```
