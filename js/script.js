/* ===============================
   CONFIG
================================ */
const API_URL =
  'https://script.google.com/macros/s/AKfycbzfy6vbrVBdWnmdwxh5I68BGDz2GmP3UORC8xQlb49GAe-hsQ3QTGUBj9Ezz8de2dY2/exec';

const map = document.getElementById('map');
const searchInput = document.getElementById('search');
const resultsBox = document.getElementById('search-results');

let svg;
let viewBox = { x: 0, y: 0, w: 0, h: 0 };

/* ===============================
   STATE
================================ */
let isPanning = false;
let moved = false;
let panStart = { x: 0, y: 0 };
let selectedKavling = null;

/* ===============================
   LOAD SVG
================================ */
fetch('sitemap.svg')
  .then(r => r.text())
  .then(text => {
    map.innerHTML = text;
    svg = map.querySelector('svg');

    const vb = svg.viewBox.baseVal;
    viewBox = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
  });

function applyViewBox() {
  svg.setAttribute(
    'viewBox',
    `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`
  );
}

/* ===============================
   PAN (ANTI CLICK MATI)
================================ */
map.addEventListener('mousedown', e => {
  isPanning = true;
  moved = false;
  panStart = { x: e.clientX, y: e.clientY };
});

map.addEventListener('mousemove', e => {
  if (!isPanning) return;

  const dxRaw = e.clientX - panStart.x;
  const dyRaw = e.clientY - panStart.y;

  if (Math.abs(dxRaw) > 3 || Math.abs(dyRaw) > 3) moved = true;
  if (!moved) return;

  const dx = dxRaw * (viewBox.w / map.clientWidth);
  const dy = dyRaw * (viewBox.h / map.clientHeight);

  viewBox.x -= dx;
  viewBox.y -= dy;

  panStart = { x: e.clientX, y: e.clientY };
  applyViewBox();
});

window.addEventListener('mouseup', () => {
  isPanning = false;
});

/* ===============================
   CLICK MAP (SELALU ZOOM)
================================ */
map.addEventListener('click', e => {
  if (moved) return; // pembeda drag vs klik

  let t = e.target;
  while (t && t !== map && !t.id) {
    t = t.parentElement;
  }
  if (!t || !t.id) return;

  const id = t.id.toUpperCase();
  selectedKavling = id;
  searchInput.value = id;

  zoomToElement(t);
  showPopup();
});

/* ===============================
   ZOOM TO ELEMENT
================================ */
function zoomToElement(el) {
  const box = el.getBBox();
  const padding = 20;

  viewBox = {
    x: box.x - padding,
    y: box.y - padding,
    w: box.width + padding * 2,
    h: box.height + padding * 2
  };

  applyViewBox();
}

/* ===============================
   POPUP CONTROL
================================ */
function showPopup() {
  document.getElementById('certPopup').classList.remove('hidden');
  document.getElementById('hasilData').textContent = '';
}

function closePopup() {
  document.getElementById('certPopup').classList.add('hidden');
}

/* ===============================
   DATABASE (SPREADSHEET)
================================ */
document.getElementById('cekData').onclick = () => {
  const kodeAkses = document.getElementById('kodeAkses').value.trim();
  const hasilData = document.getElementById('hasilData');

  if (kodeAkses !== '12') {
    hasilData.textContent = 'Kode akses salah';
    return;
  }

  if (!selectedKavling) {
    hasilData.textContent = 'Kavling belum dipilih';
    return;
  }

  fetch(`${API_URL}?kode=${selectedKavling}`)
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        hasilData.textContent = data.error;
        return;
      }
      hasilData.textContent = data.rekap || 'Tidak ada data';
    })
    .catch(() => {
      hasilData.textContent = 'Gagal mengambil data';
    });
};
