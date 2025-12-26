document.addEventListener('DOMContentLoaded', () => {
  fetch('./sitemap.svg')
    .then(res => res.text())
    .then(svg => {
      document.getElementById('map').innerHTML = svg;
      console.log('SVG INLINE BERHASIL');
    })
    .catch(err => console.error('Gagal load SVG:', err));
});
document.addEventListener('click', (e) => {
  const kavling = e.target.closest('g[id]');
  if (!kavling) return;

  console.log('Kavling diklik:', kavling.id);
});

