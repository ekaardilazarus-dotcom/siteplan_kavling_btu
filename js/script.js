let kavlingIndex = [];
let originalViewBox = null;
let lastFocusedEl = null;
let zoomPadding = null;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let viewBoxState = null;

document.addEventListener('DOMContentLoaded', () => {
  const map = document.getElementById('map');
  const searchInput = document.getElementById('search');
  const resultsBox = document.getElementById('search-results');
  const resetBtn = document.getElementById('resetZoom');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');

  searchInput.disabled = true;
  searchInput.placeholder = 'Memuat data kavling...';

  // ===============================
  // LOAD SVG
  // ===============================
  fetch('sitemap.svg')
    .then(res => res.text())
    .then(svg => {
      map.innerHTML = svg;
      const svgEl = map.querySelector('svg');

      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');
      svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      originalViewBox = svgEl.getAttribute('viewBox');
      if (!originalViewBox) {
        const b = svgEl.getBBox();
        originalViewBox = `${b.x} ${b.y} ${b.width} ${b.height}`;
        svgEl.setAttribute('viewBox', originalViewBox);
      }

      viewBoxState = parseViewBox(originalViewBox);

      // indexing kavling
      const texts = map.querySelectorAll('text');
      const ids = map.querySelectorAll('g[id], rect[id], path[id], polygon[id]');

     kavlingIndex = [...new Set(
  Array.from(ids)
    .map(el => el.id.trim())
    .filter(id => /^(KR|UJ|GA|M)/i.test(id))
)].sort((a, b) => a.localeCompare(b, 'id'));


      searchInput.disabled = false;
      searchInput.placeholder = 'Cari kavling...';
    });

  // ===============================
  // SEARCH
  // ===============================
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  resultsBox.innerHTML = '';
  if (!q) return;

  const upper = q.toUpperCase();

  // ===============================
  // MODE BLOK OTOMATIS (uj10, ga34)
  // ===============================
  const blokItems = kavlingIndex.filter(id =>
    id.startsWith(upper + '_')
  );

  if (blokItems.length && !q.includes('_')) {
    const liBlok = document.createElement('li');
    liBlok.textContent = `${upper} (${blokItems.length} kavling)`;
    liBlok.style.fontWeight = 'bold';
    liBlok.onclick = () => focusBlok(upper);
    resultsBox.appendChild(liBlok);
  }

  // ===============================
  // MODE KAVLING DETAIL (uj10_3)
  // ===============================
  const kavlingMatches = kavlingIndex.filter(id =>
    id.toLowerCase().includes(q)
  );

  kavlingMatches.slice(0, 20).forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    li.onclick = () => focusKavling(name);
    resultsBox.appendChild(li);
  });

  if (!resultsBox.children.length) {
    resultsBox.innerHTML = '<li style="color:#777">Tidak ditemukan</li>';
  }
});

  document.addEventListener('click', e => {
    if (!e.target.closest('#search-container')) resultsBox.innerHTML = '';
  });

  // ===============================
  // FOCUS KAVLING
  // ===============================
  function focusKavling(kode) {
    resultsBox.innerHTML = '';
    searchInput.value = kode;

    document.querySelectorAll('#map rect, #map path, #map polygon')
      .forEach(el => el.style.cssText = '');

    const target = document.getElementById(kode);
    if (!target) return;

    if (target.tagName.toLowerCase() === 'g') {
      target.querySelectorAll('rect, path, polygon').forEach(el => {
        el.style.fill = '#ffd54f';
        el.style.stroke = '#ff6f00';
        el.style.strokeWidth = '2';
      });
    } else {
      target.style.fill = '#ffd54f';
      target.style.stroke = '#ff6f00';
      target.style.strokeWidth = '2';
    }

    lastFocusedEl = target;
    const box = target.getBBox();
    zoomPadding = Math.max(box.width, box.height) * 0.7;
    zoomToElement(target, zoomPadding);
  }

  // ===============================
  //fokus blok

function focusBlok(prefix) {
  resultsBox.innerHTML = '';
 searchInput.value = prefix;

  // reset highlight
  document.querySelectorAll('#map rect, #map path, #map polygon')
    .forEach(el => el.style.cssText = '');

  const elements = [...document.querySelectorAll(
  `[id^="${prefix}_"]`
  )];

  if (!elements.length) return;

  // highlight semua kavling dalam blok
  elements.forEach(el => {
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
  });

  // hitung bounding box gabungan
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  elements.forEach(el => {
    const b = el.getBBox();
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  });

  const padding = Math.max(maxX - minX, maxY - minY) * 0.4;

  viewBoxState = {
    x: minX - padding,
    y: minY - padding,
    w: (maxX - minX) + padding * 2,
    h: (maxY - minY) + padding * 2
  };

  lastFocusedEl = null; // blok ≠ satu kavling
  zoomPadding = null;

  applyViewBox();
}
//===========================
  
  // ZOOM KE ELEMENT (VIEWBOX)
  // ===============================
  function zoomToElement(el, padding) {
    const svg = map.querySelector('svg');
    let box = el.getBBox();

    viewBoxState = {
      x: box.x - padding,
      y: box.y - padding,
      w: box.width + padding * 2,
      h: box.height + padding * 2
    };

    applyViewBox();
  }

  function applyViewBox() {
    const svg = map.querySelector('svg');
    svg.setAttribute('viewBox', `${viewBoxState.x} ${viewBoxState.y} ${viewBoxState.w} ${viewBoxState.h}`);
  }

  function parseViewBox(vb) {
    const [x, y, w, h] = vb.split(' ').map(Number);
    return { x, y, w, h };
  }

  // ===============================
  // ZOOM BUTTON
  // ===============================
  zoomInBtn.onclick = () => {
    if (!lastFocusedEl) return;
    zoomPadding *= 0.7;
    zoomToElement(lastFocusedEl, zoomPadding);
  };

  zoomOutBtn.onclick = () => {
    if (!lastFocusedEl) return;
    zoomPadding *= 1.1;
    zoomToElement(lastFocusedEl, zoomPadding);
  };

  // ===============================
  // RESET
  // ===============================
  resetBtn.onclick = () => {
    const svg = map.querySelector('svg');
    svg.setAttribute('viewBox', originalViewBox);
    viewBoxState = parseViewBox(originalViewBox);
    lastFocusedEl = null;
    zoomPadding = null;

    document.querySelectorAll('#map rect, #map path, #map polygon')
      .forEach(el => el.style.cssText = '');

    searchInput.value = '';
    resultsBox.innerHTML = '';
  };
// ===============================
// CLICK DI PETA (SYNC SEARCH + FOCUS)
// ===============================
map.addEventListener('click', e => {
  let target = e.target;

  // jika klik text, naik ke parent
  if (target.tagName.toLowerCase() === 'text') {
    target = target.parentElement;
  }

  if (!target || !target.id) return;

  const id = target.id.trim().toUpperCase();

  // reset dropdown
  resultsBox.innerHTML = '';

  // ===============================
  // KLIK KAVLING (GA34_5)
  // ===============================
  if (id.includes('_')) {
    searchInput.value = id;
    focusKavling(id);
    return;
  }

  // ===============================
  // KLIK BLOK (GA34 / UJ10)
  // ===============================
  searchInput.value = id;
  focusBlok(id);
});

  // ===============================
  // ZOOM SCROLL (MOUSE WHEEL)
  // ===============================
  map.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.9 : 1.1;

    viewBoxState.w *= factor;
    viewBoxState.h *= factor;
    viewBoxState.x += (viewBoxState.w * (1 - factor)) / 2;
    viewBoxState.y += (viewBoxState.h * (1 - factor)) / 2;

    applyViewBox();
  }, { passive: false });

  // ===============================
  // PAN (CLICK + DRAG)
  // ===============================
  map.addEventListener('mousedown', e => {
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
  });

  map.addEventListener('mousemove', e => {
    if (!isPanning) return;

    const dx = (e.clientX - panStart.x) * (viewBoxState.w / map.clientWidth);
    const dy = (e.clientY - panStart.y) * (viewBoxState.h / map.clientHeight);

    viewBoxState.x -= dx;
    viewBoxState.y -= dy;

    panStart = { x: e.clientX, y: e.clientY };
    applyViewBox();
  });

  map.addEventListener('mouseup', () => isPanning = false);
  map.addEventListener('mouseleave', () => isPanning = false);
});
