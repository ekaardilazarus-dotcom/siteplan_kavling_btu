let kavlingIndex = [];
let originalViewBox = null;
let lastFocusedEl = null;

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

      originalViewBox = svgEl.getAttribute('viewBox');
      if (!originalViewBox) {
        const bbox = svgEl.getBBox();
        originalViewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
        svgEl.setAttribute('viewBox', originalViewBox);
      }

      lastFocusedEl = null;

      // indexing kavling
      const texts = map.querySelectorAll('text');
      const ids = map.querySelectorAll('g[id], rect[id], path[id], polygon[id]');

      kavlingIndex = [...new Set([
        ...Array.from(texts).map(t => t.textContent.trim()).filter(t => /^(KR|UJ|GA|M|Blok)/i.test(t)),
        ...Array.from(ids).map(el => el.id.trim()).filter(id => /^(KR|UJ|GA|M|Blok)/i.test(id))
      ])].sort((a, b) => a.localeCompare(b, 'id'));

      searchInput.disabled = false;
      searchInput.placeholder = 'Cari kavling...';
    });

  // ===============================
  // SEARCH
  // ===============================
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    resultsBox.innerHTML = '';
    if (!q) return;

    const matches = kavlingIndex.filter(k => k.toLowerCase().includes(q));
    if (!matches.length) {
      resultsBox.innerHTML = '<li style="color:#777">Tidak ditemukan</li>';
      return;
    }

    matches.forEach(name => {
      const li = document.createElement('li');
      li.textContent = name;
      li.onclick = () => focusKavling(name);
      resultsBox.appendChild(li);
    });
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

    let target = document.getElementById(kode);
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
    zoomToElement(target);
  }

  // ===============================
  // ZOOM VIA VIEWBOX (FIX)
  // ===============================
  function zoomToElement(element, padding = 30) {
    const svgEl = map.querySelector('svg');
    if (!svgEl || !element) return;

    let bbox;
    if (element.tagName.toLowerCase() === 'g') {
      const children = element.querySelectorAll('rect, path, polygon');
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      children.forEach(c => {
        const b = c.getBBox();
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      });
      bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    } else {
      bbox = element.getBBox();
    }

    const x = bbox.x - padding;
    const y = bbox.y - padding;
    const w = bbox.width + padding * 2;
    const h = bbox.height + padding * 2;

    svgEl.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  }

  // ===============================
  // ZOOM IN / OUT
  // ===============================
  zoomInBtn.onclick = () => {
    if (!lastFocusedEl) return;
    zoomToElement(lastFocusedEl, 10);
  };

  zoomOutBtn.onclick = () => {
    const svgEl = map.querySelector('svg');
    svgEl.setAttribute('viewBox', originalViewBox);
    if (lastFocusedEl) zoomToElement(lastFocusedEl, 80);
  };

  // ===============================
  // RESET
  // ===============================
  resetBtn.onclick = () => {
    const svgEl = map.querySelector('svg');
    svgEl.setAttribute('viewBox', originalViewBox);
    lastFocusedEl = null;

    document.querySelectorAll('#map rect, #map path, #map polygon')
      .forEach(el => el.style.cssText = '');

    searchInput.value = '';
    resultsBox.innerHTML = '';
  };

  // ===============================
  // CLICK MAP
  // ===============================
  map.addEventListener('click', e => {
    let target = e.target;
    if (target.tagName.toLowerCase() === 'text') {
      target = target.parentElement;
    }
    if (!target || !target.id) return;
    if (/^(KR|UJ|GA|M|Blok)/i.test(target.id)) {
      focusKavling(target.id);
    }
  });
});
