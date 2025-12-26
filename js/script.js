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

      // 🔑 AMBIL DATA DARI TEXT SVG
      const texts = map.querySelectorAll('text');

      kavlingIndex = Array.from(texts)
        .map(t => t.textContent.trim())
        .filter(t =>
          /^(KR|UJ|GA|M|Blok)/i.test(t)
        );

      console.log('Index kavling dari TEXT:', kavlingIndex);
    });
});
