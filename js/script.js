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
  // HELPER: GET BOUNDING BOX UNTUK GROUP ELEMENTS
  // ===============================
  function getElementBBox(el) {
    if (el.tagName.toLowerCase() === 'g') {
      const children = el.querySelectorAll('rect, path, polygon');
      if (children.length === 0) return null;
      
      const firstBox = children[0].getBBox();
      let bbox = { ...firstBox };
      
      for (let i = 1; i < children.length; i++) {
        const childBox = children[i].getBBox();
        const x1 = Math.min(bbox.x, childBox.x);
        const y1 = Math.min(bbox.y, childBox.y);
        const x2 = Math.max(bbox.x + bbox.width, childBox.x + childBox.width);
        const y2 = Math.max(bbox.y + bbox.height, childBox.y + childBox.height);
        bbox = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
      }
      
      return bbox;
    } else if (el.getBBox) {
      return el.getBBox();
    }
    return null;
  }

  // ===============================
  // FUNGSI UTAMA: FOKUS KE ELEMEN DENGAN ZOOM
  // ===============================
  function focusOnElement(el, zoomScale = 1.5) {
    if (!el) return;
    
    const svgEl = document.querySelector('#map svg');
    const mapDiv = document.getElementById('map');
    if (!svgEl || !mapDiv) return;
    
    // Simpan elemen terakhir
    lastFocusedEl = el;
    
    // Dapatkan bounding box elemen
    const bbox = getElementBBox(el);
    if (!bbox) return;
    
    // Hitung pusat elemen dalam koordinat SVG
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    
    // Hitung dimensi viewport map
    const viewportWidth = mapDiv.clientWidth;
    const viewportHeight = mapDiv.clientHeight;
    
    // Hitung scroll position untuk memusatkan elemen
    // Rumus: (posisi_elemen * scale) - (lebar_viewport / 2)
    const targetScrollLeft = (centerX * zoomScale) - (viewportWidth / 2);
    const targetScrollTop = (centerY * zoomScale) - (viewportHeight / 2);
    
    // Terapkan zoom
    currentScale = zoomScale;
    svgEl.style.transformOrigin = "0 0";
    svgEl.style.transform = `scale(${currentScale})`;
    
    // Set scroll position
    mapDiv.scrollLeft = Math.max(0, targetScrollLeft);
    mapDiv.scrollTop = Math.max(0, targetScrollTop);
    
    // Highlight elemen
    highlightElement(el);
  }

  // ===============================
  // FUNGSI HIGHLIGHT ELEMEN
  // ===============================
  function highlightElement(el) {
    // Reset semua highlight sebelumnya
    document.querySelectorAll('#map rect, #map path, #map polygon')
      .forEach(element => {
        element.style.fill = '';
        element.style.stroke = '';
        element.style.strokeWidth = '';
      });
    
    // Highlight elemen yang dipilih
    if (el.tagName.toLowerCase() === 'g') {
      el.querySelectorAll('rect, path, polygon').forEach(child => {
        child.style.fill = '#ffd54f';
        child.style.stroke = '#ff6f00';
        child.style.strokeWidth = '2';
      });
    } else {
      el.style.fill = '#ffd54f';
      el.style.stroke = '#ff6f00';
      el.style.strokeWidth = '2';
    }
  }

  // ===============================
  // FUNGSI ZOOM DENGAN PERTAHANAN POSISI
  // ===============================
  function zoomAtPosition(scale, focusPointX = null, focusPointY = null) {
    const svgEl = document.querySelector('#map svg');
    const mapDiv = document.getElementById('map');
    if (!svgEl || !mapDiv) return;
    
    const oldScale = currentScale;
    
    // Jika tidak ada titik fokus, gunakan tengah viewport saat ini
    if (focusPointX === null || focusPointY === null) {
      focusPointX = mapDiv.scrollLeft + mapDiv.clientWidth / 2;
      focusPointY = mapDiv.scrollTop + mapDiv.clientHeight / 2;
    }
    
    // Hitung posisi relatif sebelum zoom
    const relativeX = focusPointX / oldScale;
    const relativeY = focusPointY / oldScale;
    
    // Terapkan zoom baru
    currentScale = Math.max(0.1, Math.min(5, scale));
    svgEl.style.transformOrigin = "0 0";
    svgEl.style.transform = `scale(${currentScale})`;
    
    // Hitung scroll baru untuk mempertahankan fokus pada titik yang sama
    const newScrollX = (relativeX * currentScale) - mapDiv.clientWidth / 2;
    const newScrollY = (relativeY * currentScale) - mapDiv.clientHeight / 2;
    
    // Terapkan scroll
    mapDiv.scrollLeft = Math.max(0, newScrollX);
    mapDiv.scrollTop = Math.max(0, newScrollY);
  }

  // ===============================
  // FOCUS KAVLING (FUNGSI UTAMA PENCARIAN)
  // ===============================
  function focusKavling(kode) {
    resultsBox.innerHTML = '';
    searchInput.value = kode;
    
    // Cari elemen target
    let target =
      document.querySelector(`#map g[id="${kode}"]`) ||
      document.querySelector(`#map rect[id="${kode}"], #map path[id="${kode}"], #map polygon[id="${kode}"]`);
    
    if (!target) {
      console.warn(`Kavling "${kode}" tidak ditemukan`);
      return;
    }
    
    // Fokus ke elemen dengan zoom
    focusOnElement(target, 1.5);
  }

  // ===============================
  // TOMBOL ZOOM MANUAL
  // ===============================
  zoomInBtn.addEventListener('click', () => {
    if (lastFocusedEl) {
      // Jika ada elemen terfokus, zoom dengan fokus pada elemen tersebut
      const bbox = getElementBBox(lastFocusedEl);
      if (bbox) {
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        zoomAtPosition(currentScale * 1.2, centerX * currentScale, centerY * currentScale);
      }
    } else {
      // Jika tidak ada elemen terfokus, zoom pada tengah viewport
      zoomAtPosition(currentScale * 1.2);
    }
  });

  zoomOutBtn.addEventListener('click', () => {
    if (lastFocusedEl) {
      // Jika ada elemen terfokus, zoom dengan fokus pada elemen tersebut
      const bbox = getElementBBox(lastFocusedEl);
      if (bbox) {
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        zoomAtPosition(currentScale / 1.2, centerX * currentScale, centerY * currentScale);
      }
    } else {
      // Jika tidak ada elemen terfokus, zoom pada tengah viewport
      zoomAtPosition(currentScale / 1.2);
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
      svgEl.style.transform = `scale(1)`;
      
      // Reset highlight
      document.querySelectorAll('#map rect, #map path, #map polygon')
        .forEach(el => {
          el.style.fill = '';
          el.style.stroke = '';
          el.style.strokeWidth = '';
        });
      
      // Reset scroll ke kiri atas
      mapDiv.scrollLeft = 0;
      mapDiv.scrollTop = 0;
      
      // Clear search
      searchInput.value = '';
      resultsBox.innerHTML = '';
    }
  });

  // ===============================
  // CLICK EVENT PADA MAP UNTUK SELECT MANUAL
  // ===============================
  map.addEventListener('click', (e) => {
    // Cari elemen SVG yang diklik
    let target = e.target;
    
    // Jika klik pada text, cari parent atau sibling yang berupa shape
    if (target.tagName.toLowerCase() === 'text') {
      // Coba cari shape terdekat
      const shapes = target.parentElement.querySelectorAll('rect, path, polygon, g');
      if (shapes.length > 0) {
        target = shapes[0];
      } else {
        return;
      }
    }
    
    // Pastikan target adalah shape atau group
    const validTags = ['rect', 'path', 'polygon', 'g'];
    if (!validTags.includes(target.tagName.toLowerCase())) {
      return;
    }
    
    // Cek jika elemen memiliki ID atau parent memiliki ID yang relevan
    let kavlingId = target.id;
    if (!kavlingId && target.parentElement && target.parentElement.tagName.toLowerCase() === 'g') {
      kavlingId = target.parentElement.id;
    }
    
    if (kavlingId && /^(KR|UJ|GA|M|Blok)/i.test(kavlingId)) {
      // Update search input
      searchInput.value = kavlingId;
      
      // Fokus ke elemen yang diklik
      const el = document.getElementById(kavlingId) || target;
      focusOnElement(el, 1.5);
    }
  });
});
