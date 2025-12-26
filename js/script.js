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

      kavlingIndex = Array.from(texts)
        .map(t => t.textContent.trim())
        .filter(t => /^(KR|UJ|GA|M|Blok)/i.test(t));

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

  // ===============================
  // FOCUS & HIGHLIGHT KAVLING
  // ===============================
  function focusKavling(kode) {
    resultsBox.innerHTML = '';
    searchInput.value = kode;

    // cari TEXT yang sesuai
    const textEl = Array.from(
      document.querySelectorAll('#map text')
    ).find(t => t.textContent.trim() === kode);

    if (!textEl) return;

    // cari elemen visual terdekat
    const target =
      textEl.closest('g') ||
      textEl.previousElementSibling ||
      textEl.parentElement;

    if (!target) return;

    // reset warna sebelumnya
    document.querySelectorAll('#map rect, #map path, #map polygon')
      .forEach(el => el.style.cssText = '');

    // highlight kavling
    target.querySelectorAll('rect, path, polygon')
      .forEach(el => {
        el.style.fill = '#ffd54f';
        el.style.stroke = '#ff6f00';
        el.style.strokeWidth = '2';
      });

    // scroll ke lokasi
    target.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });
  }
});
