fetch('sitemap.svg')
  .then(res => res.text())
  .then(svg => {
    document.getElementById('map').innerHTML = svg;
  })
  .catch(err => console.error('Gagal load SVG:', err));
