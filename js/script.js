let kavlingIndex = [];

document.addEventListener('DOMContentLoaded', () => {
  fetch('./sitemap.svg')
    .then(res => res.text())
    .then(svg => {
      const map = document.getElementById('map');
      map.innerHTML = svg;

      const svgEl = map.querySelector('svg');
      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');

      // ambil semua ID kavling valid
      kavlingIndex = Array.from(
        map.querySelectorAll(
          '[id^="KR" i], [id^="UJ" i], [id^="GA" i], [id^="M" i], [id^="Blok" i]'
        )
      ).map(el => el.id);

      console.log('Index kavling:', kavlingIndex);
    });
});

/* ===============================
   SEARCH LOGIC
   =============================== */
const searchInput = document.getElementById('search');
const resultsBox = document.getElementById('search-results');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  resultsBox.innerHTML = '';

  if (q.length < 2) return;

  const matches = kavlingIndex.filter(id =>
    id.toLowerCase().includes(q)
  );

  matches.forEach(id => {
    const li = document.createElement('li');
    li.textContent = id;
    li.onclick = () => focusKavling(id);
    resultsBox.appendChild(li);
  });
});

/* ===============================
   FOCUS KE BLOK
   =============================== */
function focusKavling(id) {
  resultsBox.innerHTML = '';
  searchInput.value = id;

  const el = document.getElementById(id);
  if (!el) return;

  // cari elemen visualnya
  const target =
    el.tagName === 'g'
      ? el
      : el.closest('g') || el;

  // highlight manual
  target.querySelectorAll('*').forEach(n => {
    n.style.fill = '#ffd54f';
    n.style.stroke = '#ff6f00';
    n.style.strokeWidth = '2';
  });

  // scroll ke posisi
  target.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });
}
