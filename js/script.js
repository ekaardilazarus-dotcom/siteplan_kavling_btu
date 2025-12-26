let kavlingIndex = [];

document.addEventListener('DOMContentLoaded', () => {
  const map = document.getElementById('map');
  const searchInput = document.getElementById('search');
  const resultsBox = document.getElementById('search-results');

  // Disable search sampai SVG siap
  searchInput.disabled = true;
  searchInput.placeholder = 'Memuat data kavling...';

  // ===============================
  // LOAD SVG & INDEX KAVLING
  // ===============================
  fetch('sitemap.svg') // pastikan nama file sesuai di repo GitHub
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

      // Ambil semua TEXT dan ID dari SVG
      const texts = map.querySelectorAll('text');
      const ids = map.querySelectorAll('g[id], rect[id], path[id], polygon[id]');

      kavlingIndex = [...new Set([
        ...Array.from(texts)
          .map(t => t.textContent.trim())
          .filter(t => /^(KR|UJ|GA|M|Blok)/i.test(t)),
        ...Array.from(ids)
          .map(el => el.id.trim())
          .filter(id => /^(KR|UJ|GA|M|Blok)/i.test(id))
      ])];

      // Sort biar rapi
      kavlingIndex.sort((a, b) => a.localeCompare(b, 'id'));

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

    if (q.length < 1) return;

    const matches = kavlingIndex.filter(name => name.toLowerCase().includes(q));

    if (matches.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Tidak ditemukan';
      li.style.color = '#777';
      li.style.cursor = 'default';
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

  // Tutup dropdown saat klik di luar
  document.addEventListener('click', (e) => {
    const within = e.target.closest('#search-container');
    if (!within) resultsBox.innerHTML = '';
  });

  // ===============================
  // FOCUS KAVLING
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

    // fallback: cari shape terdekat dari text
    if (!target) {
      const textEl = [...document.querySelectorAll('#map text')]
        .find(t => t.textContent.trim() === kode);
      if (textEl) {
        const bbox = textEl.getBBox();
        document.querySelectorAll('#map rect, #map path, #map polygon')
          .forEach(el => {
            const b = el.getBBox();
            if (Math.abs(b.x - bbox.x) < 20 && Math.abs(b.y - bbox.y) < 20) {
              target = el;
            }
          });
      }
    }

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

    // Scroll halus ke posisi shape
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

function focusKavling(kode) {
  resultsBox.innerHTML = '';
  searchInput.value = kode;

  // reset highlight
  document.querySelectorAll('#map rect, #map path, #map polygon')
    .forEach(el => el.style.cssText = '');

  let target =
    document.querySelector(`#map g[id="${kode}"]`) ||
    document.querySelector(`#map rect[id="${kode}"], #map path[id="${kode}"], #map polygon[id="${kode}"]`);

  // fallback: cari shape terdekat dari text
  if (!target) {
    const textEl = [...document.querySelectorAll('#map text')]
      .find(t => t.textContent.trim() === kode);
    if (textEl) {
      const bbox = textEl.getBBox();
      document.querySelectorAll('#map rect, #map path, #map polygon')
        .forEach(el => {
          const b = el.getBBox();
          if (Math.abs(b.x - bbox.x) < 20 && Math.abs(b.y - bbox.y) < 20) {
            target = el;
          }
        });
    }
  }

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

  // ===============================
  // ZOOM KE AREA (pakai viewBox)
  // ===============================
  const svgEl = document.querySelector('#map svg');
if (svgEl) {
  const bbox = target.getBBox();
  const padding = 15; // lebih kecil → zoom lebih ketat
  const x = bbox.x - padding;
  const y = bbox.y - padding;
  const w = bbox.width + padding * 2;
  const h = bbox.height + padding * 2;

  svgEl.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
}

}  
});
