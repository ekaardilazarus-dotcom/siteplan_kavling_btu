let kavlingIndex = [];

document.addEventListener('DOMContentLoaded', () => {
  const map = document.getElementById('map');
  const searchInput = document.getElementById('search');
  const resultsBox = document.getElementById('search-results');

  // ===============================
  // LOAD SVG & INDEX TEXT KAVLING
  // ===============================
  fetch('./sitemap.svg')
    .then(res => res.text())
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
    })
    .catch(err => console.error('Gagal load SVG:', err));

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

function focusKavling(kode) {
  resultsBox.innerHTML = '';
  searchInput.value = kode;

  // cari text label
  const textEl = Array.from(
    document.querySelectorAll('#map text')
  ).find(t => t.textContent.trim() === kode);

  if (!textEl) {
    console.warn('Text tidak ditemukan:', kode);
    return;
  }

  // reset highlight lama
  document.querySelectorAll('#map rect, #map path, #map polygon')
    .forEach(el => el.style.cssText = '');

  let target = null;

  // PRIORITAS 1: g[id]
  target = document.querySelector(`#map g[id="${kode}"]`);

  // PRIORITAS 2: shape dengan id langsung
  if (!target) {
    target = document.querySelector(
      `#map path[id="${kode}"], 
       #map rect[id="${kode}"], 
       #map polygon[id="${kode}"]`
    );
  }

  // PRIORITAS 3: shape terdekat dari text (fallback)
  if (!target) {
    const bbox = textEl.getBBox();
    const shapes = document.querySelectorAll('#map rect, #map path, #map polygon');

    shapes.forEach(el => {
      const b = el.getBBox();
      const dx = Math.abs(b.x - bbox.x);
      const dy = Math.abs(b.y - bbox.y);
      if (dx < 20 && dy < 20) target = el;
    });
  }

  if (!target) {
    console.warn('Target visual tidak ditemukan:', kode);
    return;
  }

  // highlight
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

  // scroll ke lokasi
  target.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });
  resultsBox.innerHTML = '';

}

});
