let kavlingIndex = [];
let originalViewBox = null;
let currentScale = 1;
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
    .then(res => {
      if (!res.ok) throw new Error('SVG tidak ditemukan');
      return res.text();
    })
    .then(svg => {
      map.innerHTML = svg;

      const svgEl = map.querySelector('svg');
      if (svgEl) {
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');

        originalViewBox = svgEl.getAttribute('viewBox');
        if (!originalViewBox) {
          const bbox = svgEl.getBBox();
          originalViewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
          svgEl.setAttribute('viewBox', originalViewBox);
        }
      }

      // indexing kavling
      const texts = map.querySelectorAll('text');
      const ids = map.querySelectorAll('g[id], rect[id], path[id], polygon[id]');

      kavlingIndex = [...new Set([
        ...Array.from(texts).map(t => t.textContent.trim()).filter(t => /^(KR|UJ|GA|M|Blok)/i.test(t)),
        ...Array.from(ids).map(el => el.id.trim()).filter(id => /^(KR|UJ|GA|M|Blok)/i.test(id))
      ])];

      kavlingIndex.sort((a, b) => a.localeCompare(b, 'id'));
      searchInput.disabled = false;
      searchInput.placeholder = 'Cari kavling...';
    });

  // ===============================
  // SEARCH INPUT
  // ===============================
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    resultsBox.innerHTML = '';
    if (q.length < 1) return;

    const matches = kavlingIndex.filter(name => name.toLowerCase().includes(q));
    if (matches.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Tidak ditemukan';
      li.style.color = '#777';
      resultsBox.appendChild(li);
      return;
    }

    matches.forEach(name => {
      const li = document.createElement('li');
      li.textContent = name;
      li.onclick = () => focusKavling(name);
      resultsBox.appendChild(li);
    });
  });

  // tutup dropdown saat klik di luar
  document.addEventListener('click', (e) => {
    const within = e.target.closest('#search-container');
    const isResultItem = e.target.closest('#search-results li');
    if (!within && !isResultItem) {
      resultsBox.innerHTML = '';
    }
  });

  // ===============================
  // HELPER: CENTER BERDASARKAN POSISI VISUAL
  // ===============================
  function centerOnElement(el) {
    const mapDiv = document.getElementById('map');
    if (!el || !mapDiv) return;

    const elRect = el.getBoundingClientRect();
    const mapRect = mapDiv.getBoundingClientRect();

    // delta ke tengah viewport map
    const deltaX = (elRect.left + elRect.width / 2) - (mapRect.left + mapRect.width / 2);
    const deltaY = (elRect.top  + elRect.height / 2) - (mapRect.top  + mapRect.height / 2);

    // geser scroll berdasarkan delta visual
    mapDiv.scrollLeft += deltaX;
    mapDiv.scrollTop  += deltaY;
  }

  // ===============================
  // FUNGSI SET ZOOM + CENTER
  // ===============================
  function setZoom(scale, targetEl = null) {
    const svgEl = document.querySelector('#map svg');
    if (!svgEl) return;

    currentScale = scale;
    svgEl.style.transformOrigin = "0 0";
    svgEl.style.transform = `scale(${currentScale})`;

    // setelah transform diterapkan, re-center dengan frame berikutnya
    requestAnimationFrame(() => {
      if (targetEl) {
        centerOnElement(targetEl);
      } else {
        // center ke tengah map: pakai <svg> sendiri sebagai target
        centerOnElement(svgEl);
      }
    });
  }

  // ===============================
  // FOCUS KAVLING
  // ===============================
  function focusKavling(kode) {
    resultsBox.innerHTML = '';
    searchInput.value = kode;

    document.querySelectorAll('#map rect, #map path, #map polygon')
      .forEach(el => el.style.cssText = '');

    let target =
      document.querySelector(`#map g[id="${kode}"]`) ||
      document.querySelector(`#map rect[id="${kode}"], #map path[id="${kode}"], #map polygon[id="${kode}"]`);

    if (!target) return;

    lastFocusedEl = target;

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

    // langkah 1: center dulu pada posisi visual saat ini
    centerOnElement(target);

    // langkah 2: zoom otomatis 1.5x dan re-center pada blok setelah transform
    setZoom(1.5, target);
  }

  // ===============================
  // TOMBOL ZOOM MANUAL
  // ===============================
  zoomInBtn.addEventListener('click', () => {
    setZoom(currentScale * 1.2, lastFocusedEl || null);
  });

  zoomOutBtn.addEventListener('click', () => {
    setZoom(currentScale / 1.2, lastFocusedEl || null);
  });

  // ===============================
  // RESET ZOOM
  // ===============================
  resetBtn.addEventListener('click', () => {
    const svgEl = document.querySelector('#map svg');
    if (svgEl) {
      lastFocusedEl = null;
      setZoom(1, null); // center ke tengah map
      // opsional: kembali ke posisi atas-kiri
      // const mapDiv = document.getElementById('map');
      // mapDiv.scrollLeft = 0;
      // mapDiv.scrollTop = 0;
    }
  });
});
