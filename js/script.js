let kavlingIndex = [];
let originalViewBox = null;
let currentScale = 1;
let lastFocusedEl = null;

document.addEventListener('DOMContentLoaded', () => {
  const map = document.getElementById('map');
  const searchInput = document.getElementById('search');
  const resultsBox = document.getElementById('search-results');
  const resetBtn = document.getElementById('resetZoom');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');

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
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        originalViewBox = svgEl.getAttribute('viewBox');
        if (!originalViewBox) {
          const bbox = svgEl.getBBox();
          originalViewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
          svgEl.setAttribute('viewBox', originalViewBox);
        }
      }

      // indexing kavling
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

  // tutup dropdown saat klik di luar
  document.addEventListener('click', (e) => {
    const within = e.target.closest('#search-container');
    const isResultItem = e.target.closest('#search-results li');
    if (!within && !isResultItem) {
      resultsBox.innerHTML = '';
    }
  });

  // ===============================
  // FUNGSI UTAMA: FOKUS KE KAVLING
  // ===============================
  function focusKavling(kode) {
    resultsBox.innerHTML = '';
    searchInput.value = kode;

    // Reset semua highlight sebelumnya
    document.querySelectorAll('#map rect, #map path, #map polygon')
      .forEach(el => {
        el.style.fill = '';
        el.style.stroke = '';
        el.style.strokeWidth = '';
      });

    // Cari elemen target
    let target =
      document.querySelector(`#map g[id="${kode}"]`) ||
      document.querySelector(`#map rect[id="${kode}"], #map path[id="${kode}"], #map polygon[id="${kode}"]`);

    if (!target) {
      console.warn(`Kavling "${kode}" tidak ditemukan`);
      return;
    }

    // Highlight elemen
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

    // Simpan elemen terakhir
    lastFocusedEl = target;

    // Langsung zoom ke elemen
    zoomToElement(target, 1.5);
  }

  // ===============================
  // FUNGSI ZOOM KE ELEMEN
  // ===============================
function zoomToElement(element) {
  const svgEl = document.querySelector('#map svg');
  if (!svgEl || !element) return;

  let bbox;

  if (element.tagName.toLowerCase() === 'g') {
    const children = element.querySelectorAll('rect, path, polygon');
    if (!children.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    children.forEach(c => {
      const b = c.getBBox();
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });

    bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  } else {
    bbox = element.getBBox();
  }

  const padding = Math.max(bbox.width, bbox.height) * 0.6;

  svgEl.setAttribute(
    'viewBox',
    `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`
  );
}

  // ===============================
  // FUNGSI ZOOM PADA POSISI TERTENTU
  // ===============================
  function zoomAtPoint(scale, pointX, pointY) {
    const svgEl = document.querySelector('#map svg');
    const mapDiv = document.getElementById('map');
    
    if (!svgEl || !mapDiv) return;

    // Simpan skala lama
    const oldScale = currentScale;
    
    // Set skala baru
    currentScale = Math.max(0.1, Math.min(5, scale));
    svgEl.style.transformOrigin = "0 0";
    svgEl.style.transform = `scale(${currentScale})`;
    
    // Hitung posisi relatif titik dalam koordinat SVG
    const svgX = pointX / oldScale;
    const svgY = pointY / oldScale;
    
    // Hitung posisi titik setelah scaling
    const newPointX = svgX * currentScale;
    const newPointY = svgY * currentScale;
    
    // Hitung scroll untuk mempertahankan titik di posisi yang sama
    const scrollLeft = newPointX - (pointX - mapDiv.scrollLeft);
    const scrollTop = newPointY - (pointY - mapDiv.scrollTop);
    
    // Terapkan scroll
    mapDiv.scrollLeft = Math.max(0, scrollLeft);
    mapDiv.scrollTop = Math.max(0, scrollTop);
  }

  // ===============================
  // TOMBOL ZOOM MANUAL
  // ===============================
  zoomInBtn.addEventListener('click', () => {
    const mapDiv = document.getElementById('map');
    
    if (lastFocusedEl) {
      // Jika ada elemen terfokus, zoom ke elemen tersebut
      zoomToElement(lastFocusedEl, currentScale * 1.2);
    } else {
      // Zoom pada tengah viewport
      const centerX = mapDiv.scrollLeft + mapDiv.clientWidth / 2;
      const centerY = mapDiv.scrollTop + mapDiv.clientHeight / 2;
      zoomAtPoint(currentScale * 1.2, centerX, centerY);
    }
  });

  zoomOutBtn.addEventListener('click', () => {
    const mapDiv = document.getElementById('map');
    
    if (lastFocusedEl) {
      // Jika ada elemen terfokus, zoom ke elemen tersebut
      zoomToElement(lastFocusedEl, currentScale / 1.2);
    } else {
      // Zoom pada tengah viewport
      const centerX = mapDiv.scrollLeft + mapDiv.clientWidth / 2;
      const centerY = mapDiv.scrollTop + mapDiv.clientHeight / 2;
      zoomAtPoint(currentScale / 1.2, centerX, centerY);
    }
  });

  // ===============================
  // RESET ZOOM
  // ===============================
  resetBtn.addEventListener('click', () => {
    const svgEl = document.querySelector('#map svg');
    const mapDiv = document.getElementById('map');
    
    if (svgEl && mapDiv) {
      // Reset state
      lastFocusedEl = null;
      currentScale = 1;
      
      // Reset transform
      svgEl.style.transformOrigin = "0 0";
      svgEl.style.transform = 'scale(1)';
      
      // Reset highlight
      document.querySelectorAll('#map rect, #map path, #map polygon')
        .forEach(el => {
          el.style.fill = '';
          el.style.stroke = '';
          el.style.strokeWidth = '';
        });
      
      // Reset scroll
      mapDiv.scrollLeft = 0;
      mapDiv.scrollTop = 0;
      
      // Clear search
      searchInput.value = '';
      resultsBox.innerHTML = '';
    }
  });

  // ===============================
  // CLICK EVENT UNTUK SELECT MANUAL
  // ===============================
  map.addEventListener('click', (e) => {
    // Cari elemen yang diklik (lewatai text, cari shape)
    let target = e.target;
    
    // Jika klik pada text, cari shape terdekat
    if (target.tagName.toLowerCase() === 'text') {
      // Cari shape dalam parent yang sama
      const parent = target.parentElement;
      const shapes = parent.querySelectorAll('rect, path, polygon, g');
      if (shapes.length > 0) {
        target = shapes[0];
      }
    }
    
    // Pastikan target adalah shape atau group
    const validTags = ['rect', 'path', 'polygon', 'g'];
    if (!validTags.includes(target.tagName.toLowerCase())) {
      return;
    }
    
    // Cari ID kavling
    let kavlingId = target.id;
    if (!kavlingId && target.parentElement && target.parentElement.tagName.toLowerCase() === 'g') {
      kavlingId = target.parentElement.id;
    }
    
    // Jika ID sesuai format kavling, fokuskan
    if (kavlingId && /^(KR|UJ|GA|M|Blok)/i.test(kavlingId)) {
      searchInput.value = kavlingId;
      
      // Cari elemen lengkapnya
      const element = document.getElementById(kavlingId) || target;
      focusKavling(kavlingId);
    }
  });
});
