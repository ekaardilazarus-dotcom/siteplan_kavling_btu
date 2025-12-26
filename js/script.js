let kavlingIndex = [];

document.addEventListener('DOMContentLoaded', () => {
  const map = document.getElementById('map');
  const searchInput = document.getElementById('search');
  const resultsBox = document.getElementById('search-results');

  // Disable search sampai SVG siap
  searchInput.disabled = true;
  searchInput.placeholder = 'Memuat data kavling...';

  // ===============================
  // LOAD SVG & INDEX TEXT KAVLING
  // ===============================
  fetch('./sitemap.svg')
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
      }

      // Ambil semua TEXT dari SVG
      const texts = map.querySelectorAll('text');

      kavlingIndex = [...new Set(
        Array.from(texts)
          .map(t => t.textContent.trim())
          .filter(t => /^(KR|UJ|GA|M|Blok)/i.test(t))
      )];

      console.log('DATA KAVLING:', kavlingIndex);

      // Aktifkan search SETELAH data siap
      searchInput.disabled = false;
      searchInput.placeholder = 'Cari kavling...';
    })
    .catch(err => {
      console.error('Gagal load SVG:', err);
      searchInput.placeholder = 'Gagal memuat data';
    });

  // ===============================
  // SEARCH INPUT
  // ===============================
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    resultsBox.innerHTML = '';

    if (q.length < 2) return;

    kavlingIndex
      .filter(name => name.toLowerCase().includes(q))
      .forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        li.onclick = () => focusKavling(name);
        resultsBox.appendChild(li);
      });
  });

  // ===============================
  // FOCUS KAVLING
  // ===============================
  function focusKavling(kode) {
    resultsBox.innerHTML = '';
    searchInput.value = kode;

    const textEl = [...document.querySelectorAll('#map text')]
      .find(t => t.textContent.trim() === kode);

    if (!textEl) return;

    // reset highlight
    document.querySelectorAll('#map rect, #map path, #map polygon')
      .forEach(el => el.style.cssText = '');

    let target =
      document.querySelector(`#map g[id="${kode}"]`) ||
      document.querySelector(`#map rect[id="${kode}"], #map path[id="${kode}"], #map polygon[id="${kode}"]`);

    // fallback: cari shape terdekat
    if (!target) {
      const bbox = textEl.getBBox();
      document.querySelectorAll('#map rect, #map path, #map polygon')
        .forEach(el => {
          const b = el.getBBox();
          if (Math.abs(b.x - bbox.x) < 20 && Math.abs(b.y - bbox.y) < 20) {
            target = el;
          }
        });
    }

    if (!target) return;

    if (target.tagName === 'g') {
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

    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }
});
