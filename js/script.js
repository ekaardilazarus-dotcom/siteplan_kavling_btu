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
  const el = e.target;

  if (el.id && el.id.startsWith('KR')) {
    console.log('Kavling diklik:', el.id);
  }
});

