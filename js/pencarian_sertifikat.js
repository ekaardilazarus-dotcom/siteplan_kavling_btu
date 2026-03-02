// ===============================
// KONEKSI DATABASE SERTIFIKAT (APPSCRIPT API)
// ===============================

const CERT_API_URL = 'https://script.google.com/macros/s/AKfycbxuAe7llIpc3SxGAhJ-d_HHYa4Ut9z-nHj8MVUGx4-_Qo7W5mwSLHEKStifg4MRD5Nofg/exec';
const CERT_CACHE_KEY = 'certSearchAllCache';
const CERT_CACHE_DURATION = 10 * 60 * 1000;

console.log('🔗 Certificate Database Connection Initialized');

// Global State
let globalCertData = []; 
let filteredResults = [];
let searchTimeout;
let activeFilters = {
  shgb: '',
  shm: '',
  nama_shm: '',
  induk: '',
  ex_owner: ''
};

// State untuk sorting
let currentSort = {
  column: null, // index kolom
  direction: 'asc' // 'asc' atau 'desc'
};

// Helper: Format Date DD/MM/YYYY
function formatDate(dateString) {
  if (!dateString || dateString === '-' || dateString === '') return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
}

function loadCachedCertData() {
  try {
    const raw = localStorage.getItem(CERT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.timestamp || !parsed.results) return null;
    if (Date.now() - parsed.timestamp > CERT_CACHE_DURATION) return null;
    return parsed;
  } catch (e) {
    console.warn('Gagal memuat cache sertifikat', e);
    return null;
  }
}

function saveCachedCertData(result) {
  try {
    if (!result || !Array.isArray(result.results)) return;
    if (result.results.length > 2000) {
      console.log('Lewati cache sertifikat, data terlalu besar:', result.results.length);
      return;
    }
    const payload = {
      timestamp: Date.now(),
      totalRecords: result.totalRecords,
      results: result.results
    };
    localStorage.setItem(CERT_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Gagal menyimpan cache sertifikat', e);
  }
}

// Fetch Semua Data Sertifikat saat Inisialisasi
async function initData() {
  const loading = document.getElementById('loadingState');
  const empty = document.getElementById('emptyState');
  const table = document.getElementById('dataTable');
  const info = document.getElementById('searchStatusInfo');
  
  loading.style.display = 'flex';
  empty.style.display = 'none';
  table.style.display = 'none';

  const cached = loadCachedCertData();
  if (cached && Array.isArray(cached.results) && cached.results.length > 0) {
    console.log('♻️ Memuat database sertifikat dari cache lokal');
    globalCertData = cached.results;
    filteredResults = [...globalCertData];
    renderTable();
    info.innerHTML = `Menampilkan seluruh data database (cache lokal): <strong>${cached.totalRecords || cached.results.length} records</strong>`;
    loading.style.display = 'none';
    table.style.display = 'table';
    return;
  }

  try {
    console.log('⏳ Memuat seluruh database sertifikat...');
    const response = await fetch(`${CERT_API_URL}?action=get_all`);
    const result = await response.json();

    if (result.status === 'success') {
      console.log(`✅ Berhasil memuat ${result.totalRecords} data`);
      globalCertData = result.results;
      filteredResults = [...globalCertData];
      renderTable();
      info.innerHTML = `Menampilkan seluruh data database: <strong>${result.totalRecords} records</strong>`;
      saveCachedCertData(result);
    } else {
      console.error('❌ Gagal memuat data:', result.message);
      info.innerHTML = `<span style="color: red;">Gagal memuat data: ${result.message}</span>`;
      empty.style.display = 'flex';
    }
    
  } catch (error) {
    console.error('❌ Error Fetching Data:', error);
    info.innerHTML = `<span style="color: red;">Kesalahan koneksi database.</span>`;
    empty.style.display = 'flex';
  } finally {
    loading.style.display = 'none';
  }
}

// Fungsi Pencarian (Local Search untuk kecepatan & kestabilan)
function performLocalSearch() {
  const info = document.getElementById('searchStatusInfo');
  
  // Ambil semua nilai filter yang tidak kosong
  const filters = Object.entries(activeFilters).filter(([_, val]) => val && val.trim().length > 0);

  if (filters.length === 0) {
    filteredResults = [...globalCertData];
    info.innerHTML = `Menampilkan seluruh data database: <strong>${globalCertData.length} records</strong>`;
    renderTable();
    return;
  }

  // Lakukan filtering lokal pada globalCertData
  filteredResults = globalCertData.filter(item => {
    const d = item.fullData || [];
    
    // Cek setiap filter aktif
    return filters.every(([type, value]) => {
      const searchKey = value.toLowerCase().trim();
      let cellValue = '';

      switch(type) {
        case 'shgb': cellValue = String(d[0] || '').toLowerCase(); break;     // A
        case 'shm': cellValue = String(d[3] || '').toLowerCase(); break;      // D
        case 'nama_shm': cellValue = String(d[4] || '').toLowerCase(); break; // E
        case 'induk': cellValue = String(d[5] || '').toLowerCase(); break;    // F
        case 'ex_owner': cellValue = String(d[13] || '').toLowerCase(); break; // N
      }

      // Matching fleksibel (menghapus spasi dan tanda baca untuk perbandingan)
      const cleanCellValue = cellValue.replace(/[-\s().]/g, '');
      const cleanSearchKey = searchKey.replace(/[-\s().]/g, '');

      return cellValue.includes(searchKey) || cleanCellValue.includes(cleanSearchKey);
    });
  });

  info.innerHTML = `Hasil filter: <strong>${filteredResults.length} ditemukan</strong>`;
  
  // Jika ada sort aktif, terapkan kembali sort setelah filter
  if (currentSort.column !== null) {
    applySortLogic();
  } else {
    renderTable();
  }
}

// Fungsi Sorting Tabel
function sortTable(columnIndex) {
  // Jika klik kolom yang sama, toggle arah
  if (currentSort.column === columnIndex) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.column = columnIndex;
    currentSort.direction = 'asc';
  }

  // Update UI Header (Class sort)
  updateSortHeaders();
  
  // Terapkan Logika Sort
  applySortLogic();
}

function applySortLogic() {
  const idx = currentSort.column;
  const dir = currentSort.direction;

  filteredResults.sort((a, b) => {
    const valA = String((a.fullData && a.fullData[idx]) || '').toLowerCase();
    const valB = String((b.fullData && b.fullData[idx]) || '').toLowerCase();

    // Cek jika ini angka (untuk pengurutan nomor yang benar)
    const numA = parseFloat(valA);
    const numB = parseFloat(valB);

    if (!isNaN(numA) && !isNaN(numB)) {
      return dir === 'asc' ? numA - numB : numB - numA;
    }

    // Default string comparison
    if (valA < valB) return dir === 'asc' ? -1 : 1;
    if (valA > valB) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  renderTable();
}

function updateSortHeaders() {
  const headers = document.querySelectorAll('th.sortable');
  headers.forEach((th) => {
    th.classList.remove('asc', 'desc'); // Sesuai class di imb_status.css
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.innerHTML = '⇅';

    const onclickAttr = th.getAttribute('onclick');
    if (onclickAttr && onclickAttr.includes(`sortTable(${currentSort.column})`)) {
      th.classList.add(currentSort.direction); // 'asc' atau 'desc'
      if (icon) icon.innerHTML = currentSort.direction === 'asc' ? '🔼' : '🔽';
    }
  });
}

// Render Table
function renderTable() {
  const tbody = document.getElementById('tableBody');
  const table = document.getElementById('dataTable');
  const empty = document.getElementById('emptyState');
  const downloadBtn = document.getElementById('downloadBtnFull');

  tbody.innerHTML = '';

  if (filteredResults.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'flex';
    downloadBtn.disabled = true;
    return;
  }

  table.style.display = 'table';
  empty.style.display = 'none';
  downloadBtn.disabled = false;

  const fragment = document.createDocumentFragment();

  filteredResults.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.className = 'result-row';
    tr.dataset.idx = String(index);
    const d = item.fullData || [];
    
    // Column 0: No
    const tdNo = document.createElement('td');
    tdNo.style.textAlign = 'center';
    tdNo.innerHTML = `<div class="no-content">${index + 1}</div>`;
    tr.appendChild(tdNo);

    // Columns 1-26 (Sertifikat Data)
    for (let i = 0; i < 26; i++) {
      const td = document.createElement('td');
      let val = d[i] || '';
      
      // Formatting khusus untuk tanggal (7: Tahun Akhir Hak ditambahkan)
      if (i === 7 || i === 10 || i === 18 || i === 19 || i === 21 || i === 23 || i === 25) {
        val = formatDate(val);
      }
      
      td.innerHTML = `<div class="cell-content">${val}</div>`;
      tr.appendChild(td);
    }
    
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

function showAIPopup(aiText, nomor) {
  // Hapus popup lama jika ada
  const oldPopup = document.querySelector('.kavling-popup');
  if (oldPopup) {
    document.body.removeChild(oldPopup);
  }

  // Buat popup baru
  const popup = document.createElement('div');
  popup.className = 'kavling-popup';

  const norm = String(aiText || 'Tidak ada data di kolom AI.')
    .replace(/\r?\n{2,}/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  popup.innerHTML = `
    <div class="kavling-popup-content">
      <div class="kavling-popup-header">
        <h3>DATA AI – ${nomor || ''}</h3>
        <button class="close-kavling-popup">&times;</button>
      </div>
      <div class="kavling-popup-body">
        <div class="kavling-status-success">
          ✅ Data AI ditemukan
        </div>
        <div class="kavling-data-content">${norm}</div>
      </div>
      <div class="kavling-popup-footer">
        <button class="kavling-close-btn">Tutup</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  const closePopup = () => {
    if (popup && popup.parentNode) {
      document.body.removeChild(popup);
    }
  };

  const closeBtn = popup.querySelector('.close-kavling-popup');
  const closeBtn2 = popup.querySelector('.kavling-close-btn');

  if (closeBtn) closeBtn.addEventListener('click', closePopup);
  if (closeBtn2) closeBtn2.addEventListener('click', closePopup);

  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      closePopup();
    }
  });

  // Tampilkan popup
  setTimeout(() => {
    popup.style.display = 'flex';
  }, 10);

  // Support ESC key
  const onEsc = (e) => {
    if (e.key === 'Escape') {
      closePopup();
      document.removeEventListener('keydown', onEsc);
    }
  };
  document.addEventListener('keydown', onEsc);
}

function setupRowClickForAI() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.addEventListener('click', (e) => {
    const tr = e.target.closest && e.target.closest('tr.result-row');
    if (!tr) return;
    const idx = parseInt(tr.dataset.idx || '-1', 10);
    if (isNaN(idx) || idx < 0 || idx >= filteredResults.length) return;
    const item = filteredResults[idx] || {};
    const d = item.fullData || [];
    const ai = d[34] || '';
    const nomor = String(item.nomor || d[0] || '').trim();
    showAIPopup(ai, nomor);
  });
}

// Event Listeners
function setupEventListeners() {
  const inputs = {
    shgb: 'certSHGB',
    shm: 'certSHM',
    nama_shm: 'certNamaSHM',
    induk: 'certInduk',
    ex_owner: 'certExOwner'
  };

  Object.entries(inputs).forEach(([type, id]) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', (e) => {
        activeFilters[type] = e.target.value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          performLocalSearch();
        }, 300); // Delay lebih cepat (300ms) untuk local search
      });
      
      // Support tombol cari (mini-search-btn) jika diklik
      const btnId = 'btnSearch' + id.replace('cert', '');
      document.getElementById(btnId)?.addEventListener('click', () => {
        activeFilters[type] = el.value;
        performLocalSearch();
      });
    }
  });

  // Download Excel
  document.getElementById('downloadBtnFull')?.addEventListener('click', downloadExcel);
}

// Download Excel
function downloadExcel() {
  if (filteredResults.length === 0) return;

  const headers = [
    "No", "N0 SERTIFIKAT", "ALAMAT LOKASI KAVLING", "KELOMPOK SERTIFIKAT", "NOMOR SHM", 
    "NAMA SHM", "INDUK TANAH SERTIFIKAT", "TAHUN TERBIT SERTIFIKAT", "TAHUN AKHIR HAK", 
    "NIB", "SURAT UKUR", "TANGGAL SURAT UKUR", "LUAS SERTIFIKAT", "PEMEGANG HAK", 
    "PEMILIK LAMA", "KELURAHAN", "PETOK LETER C SK SHGB", "PEMBIAYAAN", 
    "TIPE KAVLING BERUPA", "TANGGAL MUTASI", "UPDATE TANGGAL MUTASI", 
    "PENERIMA SERIFIKAT", "UPDATE PENERIMA SERTIFIKAT", "DITERIMA OLEH", 
    "UPDATE DITERIMA OLEH", "PROSES SERTIFIKAT", "UPDATE PROSES SERTIFIKAT"
  ];

  const data = filteredResults.map((item, index) => {
    const d = item.fullData || [];
    return [
      index + 1,
      d[0] || '',
      d[1] || '',
      d[2] || '',
      d[3] || '',
      d[4] || '',
      d[5] || '',
      d[6] || '',
      formatDate(d[7]),
      d[8] || '',
      d[9] || '',
      formatDate(d[10]),
      d[11] || '',
      d[12] || '',
      d[13] || '',
      d[14] || '',
      d[15] || '',
      d[16] || '',
      d[17] || '',
      formatDate(d[18]),
      formatDate(d[19]),
      d[20] || '',
      formatDate(d[21]),
      d[22] || '',
      formatDate(d[23]),
      d[24] || '',
      formatDate(d[25])
    ];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil Pencarian Sertifikat");
  
  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Pencarian_Sertifikat_${timestamp}.xlsx`);
}

function initTableGrabScroll() {
  const container = document.querySelector('.table-container');
  if (!container) return;

  let isDown = false;
  let startX = 0;
  let startY = 0;
  let scrollLeft;
  let scrollTop;
  let lastX = 0;
  let lastY = 0;
  let frameActive = false;

  container.addEventListener('mousedown', (e) => {
    isDown = true;
    container.classList.add('grabbing');
    startX = e.pageX - container.offsetLeft;
    startY = e.pageY - container.offsetTop;
    scrollLeft = container.scrollLeft;
    scrollTop = container.scrollTop;
  });

  container.addEventListener('mouseleave', () => {
    isDown = false;
    container.classList.remove('grabbing');
  });

  container.addEventListener('mouseup', () => {
    isDown = false;
    container.classList.remove('grabbing');
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    lastX = e.pageX - container.offsetLeft;
    lastY = e.pageY - container.offsetTop;

    if (frameActive) return;
    frameActive = true;

    requestAnimationFrame(() => {
      const walkX = lastX - startX;
      const walkY = lastY - startY;
      container.scrollLeft = scrollLeft - walkX;
      container.scrollTop = scrollTop - walkY;
      frameActive = false;
    });
  });
}

// Init on Load
window.onload = () => {
  setupEventListeners();
  initData(); 
  initTableGrabScroll();
  setupRowClickForAI();
};
