// ===============================
// Search blok & kavling, zoom, pan, click sync
// case-insensitive search, simpan ID asli,
// klik robust (closest), abaikan klik angka dalam kotak,
// fitur export (SVG / PNG) yang terpilih
// ===============================

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
// EXPORT: SVG (serialisasi viewBox saat ini)
// ===============================
function exportCurrentViewAsSVG(svgEl, filename = 'map-view.svg') {
  // clone svg to avoid mutating original
  const clone = svgEl.cloneNode(true);

  // set current viewBox on clone
  clone.setAttribute('viewBox', `${viewBoxState.x} ${viewBoxState.y} ${viewBoxState.w} ${viewBoxState.h}`);

  // inline computed styles for visible fills/strokes so exported SVG looks same
  // iterate elements that may have inline styles applied by script
  clone.querySelectorAll('[style]').forEach(el => {
    // keep existing inline style
  });

  // serialize
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clone);

  // add XML prolog and namespace if missing
  if (!svgString.match(/^<\?xml/)) {
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
  }
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

// ===============================
// EXPORT: PNG (render current viewBox to canvas)
// ===============================
function exportCurrentViewAsPNG(svgEl, filename = 'map-view.png') {
  // clone and set viewBox like SVG export
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('viewBox', `${viewBoxState.x} ${viewBoxState.y} ${viewBoxState.w} ${viewBoxState.h}`);

  // ensure width/height for rasterization: use current svg client size or viewBox ratio
  const rect = svgEl.getBoundingClientRect();
  const width = Math.max(800, Math.round(rect.width)); // minimal width for quality
  const height = Math.max(600, Math.round(rect.height));

  // serialize clone
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clone);
  if (!svgString.match(/^<\?xml/)) {
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
  }
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  // handle CORS-safe rendering
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // white background (optional)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // draw image scaled to canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        if (blob) downloadBlob(blob, filename);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      console.error('Gagal mengekspor PNG', err);
      URL.revokeObjectURL(url);
    }
  };
  img.onerror = (err) => {
    console.error('Gagal memuat SVG untuk konversi PNG', err);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ===============================
// DOM READY
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  const map = document.getElementById('map');
  const searchInput = document.getElementById('search');
  const resultsBox = document.getElementById('search-results');
  const resetBtn = document.getElementById('resetZoom');

  // tombol zoom lama (jika ada) akan diubah fungsinya menjadi export
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');

  // juga dukung tombol khusus export jika sudah ada
  const exportSvgBtn = document.getElementById('exportSvg');
  const exportPngBtn = document.getElementById('exportPng');

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
      // Jika ada tombol zoomIn/zoomOut, ubah label & aksi menjadi export
      const svgElement = svg; // capture

      if (zoomInBtn) {
        zoomInBtn.textContent = 'Export SVG';
        zoomInBtn.title = 'Export tampilan saat ini sebagai file SVG';
        zoomInBtn.onclick = () => exportCurrentViewAsSVG(svgElement, 'map-view.svg');
      } else if (exportSvgBtn) {
        exportSvgBtn.onclick = () => exportCurrentViewAsSVG(svgElement, 'map-view.svg');
      }

      if (zoomOutBtn) {
        zoomOutBtn.textContent = 'Export PNG';
        zoomOutBtn.title = 'Export tampilan saat ini sebagai file PNG';
        zoomOutBtn.onclick = () => exportCurrentViewAsPNG(svgElement, 'map-view.png');
      } else if (exportPngBtn) {
        exportPngBtn.onclick = () => exportCurrentViewAsPNG(svgElement, 'map-view.png');
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
      liBlok.onclick = () => focusBlok(upper);
      resultsBox.appendChild(liBlok);
    }

    // KAVLING DETAIL (case-insensitive)
    kavlingIndex
      .filter(id => id.toLowerCase().includes(q))
      .slice(0, 20)
      .forEach(name => {
        const li = document.createElement('li');
        li.textContent = name; // tampilkan ID asli
        li.onclick = () => focusKavling(name);
        resultsBox.appendChild(li);
      });

    if (!resultsBox.children.length) {
      resultsBox.innerHTML = '<li style="color:#777">Tidak ditemukan</li>';
    }
  });

  // ===============================
  // FOCUS KAVLING
  // ===============================
  function focusKavling(id) {
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
  }

  // ===============================
  // FOCUS BLOK
  // ===============================
  function focusBlok(prefix) {
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

    if (actualId.includes('_')) focusKavling(actualId);
    else focusBlok(actualId);
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
  };
});
