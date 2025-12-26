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
  function getGroupBBox(groupEl) {
    if (groupEl.tagName.toLowerCase() !== 'g') return null;
    
    const children = groupEl.querySelectorAll('rect, path, polygon');
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
  }

  // ===============================
  // FUNGSI ZOOM KE ELEMEN
  // ===============================
  function zoomToElement(el, scale = 1.5) {
    const svgEl = document.querySelector('#map svg');
    const mapDiv = document.getElementById('map');
    
    if (!svgEl || !mapDiv || !el) return;

    // Dapatkan bounding box elemen target
    let bbox;
    if (el.tagName.toLowerCase() === 'g') {
      bbox = getGroupBBox(el);
      if (!bbox) return;
    } else if (el.getBBox) {
      bbox = el.getBBox();
    } else {
      return; // Element tidak memiliki getBBox
    }
    
    // Hitung pusat elemen dalam koordinat SVG
    const targetCenterX = bbox.x + bbox.width / 2;
    const targetCenterY = bbox.y + bbox.height / 2;
    
    // Simpan elemen dan set zoom
    lastFocusedEl = el;
    currentScale = scale;
    svgEl.style.transformOrigin = "0 0";
    svgEl.style.transform = `scale(${currentScale})`;
    
    // Hitung posisi scroll untuk memusatkan elemen
    requestAnimationFrame(() => {
      // Hitung posisi setelah scaling
      const scaledCenterX = targetCenterX * scale;
      const scaledCenterY = targetCenterY * scale;
      
      // Hitung posisi scroll
      const scrollX = scaledCenterX - mapDiv.clientWidth / 2;
      const scrollY = scaledCenterY - mapDiv.clientHeight / 2;
      
      // Terapkan scroll dengan batasan agar tidak negatif
      mapDiv.scrollLeft = Math.max(0, scrollX);
      mapDiv.scrollTop = Math.max(0, scrollY);
    });
  }

  // ===============================
  // FUNGSI SET ZOOM (UNTUK TOMBOL MANUAL)
  // ===============================
  function setZoom(scale, targetEl = null) {
    const svgEl = document.querySelector('#map svg');
    const mapDiv = document.getElementById('map');
    if (!svgEl || !mapDiv) return;

    // Jika ada target, hitung posisi sebelum zoom
    let targetCenter = null;
    if (targetEl) {
      let bbox;
      if (targetEl.tagName.toLowerCase() === 'g') {
        bbox = getGroupBBox(targetEl);
      } else if (targetEl.getBBox) {
        bbox = targetEl.getBBox();
      }
      
      if (bbox) {
        targetCenter = {
          x: bbox.x + bbox.width / 2,
          y: bbox.y + bbox.height / 2
        };
      }
    }

    const oldScale = currentScale;
    currentScale = Math.max(0.1, Math.min(5, scale)); // Batasi zoom antara 0.1x dan 5x
    svgEl.style.transformOrigin = "0 0";
    svgEl.style.transform = `scale(${currentScale})`;

    // Jika ada target, pertahankan posisi tengah
    if (targetCenter && oldScale > 0) {
      requestAnimationFrame(() => {
        // Hitung perbedaan skala
        const scaleRatio = currentScale / oldScale;
        
        // Sesuaikan scroll position untuk mempertahankan fokus
        const currentCenterX = mapDiv.scrollLeft + mapDiv.clientWidth / 2;
        const currentCenterY = mapDiv.scrollTop + mapDiv.clientHeight / 2;
        
        const newScrollX = currentCenterX * scaleRatio - mapDiv.clientWidth / 2;
        const newScrollY = currentCenterY * scaleRatio - mapDiv.clientHeight / 2;
        
        mapDiv.scrollLeft = Math.max(0, newScrollX);
        mapDiv.scrollTop = Math.max(0, newScrollY);
      });
    }
  }

  // ===============================
  // FOCUS KAVLING
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

    if (!target) return;

    // Highlight elemen target
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

    // Zoom ke elemen target
    zoomToElement(target, 1.5);
  }

  // ===============================
  // TOMBOL ZOOM MANUAL
  // ===============================
  zoomInBtn.addEventListener('click', () => {
    setZoom(currentScale * 1.2, lastFocusedEl || null);
  });

  zoomOutBtn.addEventListener('click', () => {
    setZoom(currentScale / 1.2, lastFocusedEl || null);
  });

  // ===============================
  // RESET ZOOM
  // ===============================
  resetBtn.addEventListener('click', () => {
    const svgEl = document.querySelector('#map svg');
    const mapDiv = document.getElementById('map');
    
    if (svgEl && mapDiv) {
      lastFocusedEl = null;
      currentScale = 1;
      svgEl.style.transformOrigin = "0 0";
      svgEl.style.transform = `scale(1)`;
      
      // Reset semua highlight
      document.querySelectorAll('#map rect, #map path, #map polygon')
        .forEach(el => {
          el.style.fill = '';
          el.style.stroke = '';
          el.style.strokeWidth = '';
        });
      
      // Opsional: reset ke posisi awal
      mapDiv.scrollLeft = 0;
      mapDiv.scrollTop = 0;
      
      // Clear search
      searchInput.value = '';
      resultsBox.innerHTML = '';
    }
  });
});
