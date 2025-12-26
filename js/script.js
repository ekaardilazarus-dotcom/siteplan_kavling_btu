let kavlingIndex = [];
let originalViewBox = null;

document.addEventListener('DOMContentLoaded', () => {
  const map = document.getElementById('map');
  const searchInput = document.getElementById('search');
  const resultsBox = document.getElementById('search-results');
  const resetBtn = document.getElementById('resetZoom');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');

// fungsi zoom helper
function adjustZoom(factor) {
  // zoom ke area kavling
const svgEl = document.querySelector('#map svg');
if (svgEl) {
  const bbox = target.getBBox();
  const padding = 0;   // zoom rapat
  const minSize = 1;   // tidak dipaksa besar
  const x = bbox.x - padding;
  const y = bbox.y - padding;
  const w = Math.max(bbox.width + padding * 2, minSize);
  const h = Math.max(bbox.height + padding * 2, minSize);

  svgEl.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
}
}

// event listener tombol
zoomInBtn.addEventListener('click', () => adjustZoom(0.8)); // zoom in 20%
zoomOutBtn.addEventListener('click', () => adjustZoom(1.25)); // zoom out 25%
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

        // simpan viewBox asli
        originalViewBox = svgEl.getAttribute('viewBox');
        if (!originalViewBox) {
          const bbox = svgEl.getBBox();
          originalViewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
          svgEl.setAttribute('viewBox', originalViewBox);
        }
      }

      // indexing kavling: ambil teks + id
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

  // ===============================
  // Tutup dropdown saat klik di luar
  // ===============================
  document.addEventListener('click', (e) => {
    const within = e.target.closest('#search-container');
    const isResultItem = e.target.closest('#search-results li');
    if (!within && !isResultItem) {
      resultsBox.innerHTML = '';
    }
  });

  // ===============================
  // FOCUS KAVLING + ZOOM
  // ===============================
  function focusKavling(kode) {
    resultsBox.innerHTML = '';
    searchInput.value = kode;

    // reset highlight
    document.querySelectorAll('#map rect, #map path, #map polygon')
      .forEach(el => el.style.cssText = '');

    let target =
      document.querySelector(`#map g[id="${kode}"]`) ||
      document.querySelector(`#map rect[id="${kode}"], #map path[id="${kode}"], #map polygon[id="${kode}"]`);

    if (!target) return;

    // highlight
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

    // zoom ke area
    const svgEl = document.querySelector('#map svg');
    if (svgEl) {
      const bbox = target.getBBox();
      const padding = 2; // zoom ketat tapi masih ada area sekitar
      const minSize = 10; // minimal area supaya tidak terlalu nge-zoom
      const x = bbox.x - padding;
      const y = bbox.y - padding;
      const w = Math.max(bbox.width + padding * 2, minSize);
      const h = Math.max(bbox.height + padding * 2, minSize);

      svgEl.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    }
  }

  // ===============================
  // RESET ZOOM
  // ===============================
  resetBtn.addEventListener('click', () => {
    const svgEl = document.querySelector('#map svg');
    if (svgEl && originalViewBox) {
      svgEl.setAttribute('viewBox', originalViewBox);
    }
  });
});
