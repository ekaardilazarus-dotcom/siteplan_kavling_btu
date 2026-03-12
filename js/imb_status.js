// ===============================
// KONEKSI DATABASE (APPSCRIPT API)
// ===============================

const API_URL = 'https://script.google.com/macros/s/AKfycbyg-AUBateyyWJpfVBBacMb32xnB0puC4dAdYhVni6MmwZKDbfcO_5lh0cird2Kecyk/exec';
const CERT_API_URL = 'https://script.google.com/macros/s/AKfycbxuAe7llIpc3SxGAhJ-d_HHYa4Ut9z-nHj8MVUGx4-_Qo7W5mwSLHEKStifg4MRD5Nofg/exec';

// 🔗 ALIAS untuk API Kavling (sama dengan API_URL)
const KAVLING_API_URL = API_URL; // SAMA, karena database kavling
const IMB_CACHE_KEY = 'imbStatusDataCache';
const IMB_CACHE_DURATION = 10 * 60 * 1000; // 10 menit

console.log('🔗 Database Connection Initialized');

// Global State
let globalData = {};
let currentCategory = '';
let currentSearchTerm = '';
let currentSearchUserPemohon = '';
let currentTableData = []; // Data yang sedang ditampilkan di tabel (setelah filter)
let currentSortOrder = 'asc'; // 'asc' or 'desc'
let currentSortColumn = 'alamat_lokasi_kavling'; // Default sort column

// Helper: Format Date DD/MM/YYYY
function formatDate(dateString) {
  if (!dateString || dateString === '-' || dateString === '') return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if invalid
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
}

function formatDateMDY(dateString) {
  if (!dateString || dateString === '-' || dateString === '') return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  } catch (e) {
    return dateString;
  }
}

// Helper: Format Luas (Number check)
function formatLuas(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  
  // Cek jika kosong, strip, atau #na/a
  if (str === '' || str === '-' || str.toLowerCase() === '#na/a') return '';
  
  // Cek apakah angka (support koma sebagai desimal)
  const numStr = str.replace(',', '.');
  if (isNaN(parseFloat(numStr))) return '';
  
  return str;
}

function loadCachedImbData() {
  try {
    const raw = localStorage.getItem(IMB_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.timestamp || !parsed.data) return null;
    if (Date.now() - parsed.timestamp > IMB_CACHE_DURATION) return null;
    return parsed.data;
  } catch (e) {
    console.warn('Gagal memuat cache IMB', e);
    return null;
  }
}

function saveCachedImbData(data) {
  try {
    const payload = {
      timestamp: Date.now(),
      data: data
    };
    localStorage.setItem(IMB_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Gagal menyimpan cache IMB', e);
  }
}

// Fetch Data dari API
async function fetchData() {
  const loading = document.getElementById('loadingState');
  const empty = document.getElementById('emptyState');
  const table = document.getElementById('dataTable');
  
  // Tampilkan loading awal
  loading.style.display = 'flex';
  empty.style.display = 'none';
  table.style.display = 'none';
  
  // Disable tombol filter saat loading
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => btn.style.pointerEvents = 'none');

  // Cek Cache
  const cached = loadCachedImbData();
  if (cached) {
    console.log('♻️ Memuat data IMB dari cache lokal');
    globalData = cached;
    finishLoading();
    return;
  }

  try {
    console.log('⏳ Mengambil data dari API...');
    const response = await fetch(`${API_URL}?action=imb_status&_t=${Date.now()}`);
    const result = await response.json();
    
    if (result.status === 'success') {
      console.log('✅ Data berhasil diambil');
      globalData = result; // Simpan seluruh data response
      saveCachedImbData(result);
      finishLoading();
    } else {
      console.error('❌ Gagal mengambil data:', result.message);
      alert('Gagal mengambil data: ' + result.message);
      loading.style.display = 'none';
      empty.style.display = 'flex';
    }
  } catch (error) {
    console.error('❌ Error Fetching Data:', error);
    alert('Terjadi kesalahan koneksi saat mengambil data.');
    loading.style.display = 'none';
    empty.style.display = 'flex';
  } finally {
    buttons.forEach(btn => btn.style.pointerEvents = 'auto');
  }
}

function finishLoading() {
  const loading = document.getElementById('loadingState');
  const table = document.getElementById('dataTable');
  const buttons = document.querySelectorAll('.filter-btn');

  // Update Badges
  updateBadges();
  
  // Default pilih kategori pertama jika belum ada yang dipilih
  if (!currentCategory) {
    // Pilih tombol 'Semua Data' secara default
    const allDataBtn = document.querySelector('.filter-btn[data-category="all"]');
    if (allDataBtn) {
      filterData('all', allDataBtn);
    } else {
      const firstBtn = document.querySelector('.filter-btn');
      if (firstBtn) {
        const category = firstBtn.getAttribute('data-category');
        filterData(category, firstBtn);
      }
    }
  } else {
    // Refresh kategori yang sedang aktif
    applyFilterAndRender();
  }
  
  loading.style.display = 'none';
  table.style.display = 'table';
  buttons.forEach(btn => btn.style.pointerEvents = 'auto');
}

// Helper: Filter data berdasarkan term pencarian
function getFilteredData(data, searchTerm, searchUserPemohon) {
  let filtered = data;
  
  // Filter berdasarkan search utama (Kavling/Sertif/dll)
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(item => {
      return (
        (item.alamat_lokasi_kavling && item.alamat_lokasi_kavling.toLowerCase().includes(term)) ||
        (item.no_sertifikat && item.no_sertifikat.toLowerCase().includes(term)) ||
        (item.blok_cluster && item.blok_cluster.toLowerCase().includes(term)) ||
        (item.nomor_imb && item.nomor_imb.toLowerCase().includes(term)) ||
        (item.user_pemohon && item.user_pemohon.toLowerCase().includes(term)) ||
        (item.pemegang_hak_sekarang && item.pemegang_hak_sekarang.toLowerCase().includes(term))
      );
    });
  }
  
  // Filter berdasarkan User Pemohon (hanya jika minimal 3 karakter)
  if (searchUserPemohon && searchUserPemohon.length >= 3) {
    const userTerm = searchUserPemohon.toLowerCase();
    filtered = filtered.filter(item => {
      return (item.user_pemohon && item.user_pemohon.toLowerCase().includes(userTerm));
    });
  }
  
  return filtered;
}

// Update Badges Count
function updateBadges() {
  const buttons = document.querySelectorAll('.filter-btn');
  let totalAllData = 0;

  buttons.forEach(btn => {
    const category = btn.getAttribute('data-category');
    let count = 0;

    if (category === 'all') {
      // Dihitung nanti setelah loop selesai
    } else if (globalData[category]) {
      const filtered = getFilteredData(globalData[category], currentSearchTerm, currentSearchUserPemohon);
      count = filtered.length;
      totalAllData += count; // Akumulasi total
    }

    if (category !== 'all') {
      const badge = btn.querySelector('.count-badge');
      if (badge) badge.textContent = count;
    }
  });

  // Update badge 'Semua Data' setelah semua kategori lain dihitung
  const allDataBadge = document.querySelector('.filter-btn[data-category="all"] .count-badge');
  if (allDataBadge) {
    allDataBadge.textContent = totalAllData;
  }
}

// Filter Function (Kategori)
window.filterData = function(category, btnElement) {
  // Update State Kategori
  currentCategory = category;
  
  // Update Active Button
  if (btnElement) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
  } else {
    // Jika tidak ada elemen tombol (misal dipanggil dari kode), cari tombolnya
    const targetBtn = document.querySelector(`.filter-btn[data-category="${category}"]`);
    if (targetBtn) {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      targetBtn.classList.add('active');
    }
  }
  
  // Reset search term saat ganti kategori (opsional, tapi user biasanya ingin reset)
  // document.getElementById('searchInput').value = '';
  // currentSearchTerm = '';
  
  applyFilterAndRender();
};

// Apply Filter (Kategori + Search) dan Render
function applyFilterAndRender() {
  const loading = document.getElementById('loadingState');
  const table = document.getElementById('dataTable');
  const empty = document.getElementById('emptyState');
  const tbody = document.getElementById('tableBody');
  
  // Ambil data dari kategori saat ini
  let data = [];
  if (currentCategory === 'all') {
    // Gabungkan semua data dari globalData (kecuali yang bukan kategori)
    for (const key in globalData) {
      if (Array.isArray(globalData[key])) {
        data = data.concat(globalData[key]);
      }
    }
  } else {
    data = globalData[currentCategory] || [];
  }
  
  // Filter berdasarkan Search Term dan User Pemohon
  data = getFilteredData(data, currentSearchTerm, currentSearchUserPemohon);

  // Sorting Logic
  data.sort((a, b) => {
    let valA = a[currentSortColumn] || '';
    let valB = b[currentSortColumn] || '';
    
    // Gunakan localeCompare dengan numeric: true untuk pengurutan alami
    const compareResult = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
    
    return currentSortOrder === 'asc' ? compareResult : -compareResult;
  });
  
  // Simpan data hasil filter untuk keperluan download
  currentTableData = data;
  
  // Render Table
  tbody.innerHTML = '';
  
  if (data.length === 0) {
    table.style.display = 'table'; // Tetap tampilkan header tabel
    empty.style.display = 'none';
    loading.style.display = 'none';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="30" class="no-data-cell">
         <div class="icon-lg">🔍</div>
         <h3>Tidak ada data ditemukan</h3>
         <p>${currentSearchTerm ? 'Coba kata kunci lain' : 'Kategori ini masih kosong'}</p>
      </td>
    `;
    tbody.appendChild(tr);
    updateDownloadButtons(false);
    return;
  }
  
  table.style.display = 'table';
  empty.style.display = 'none';
  loading.style.display = 'none';
  updateDownloadButtons(true);

  // Render Rows
  // Gunakan Fragment untuk performa lebih baik
  const fragment = document.createDocumentFragment();
  
  data.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.dataset.index = index; // Simpan index untuk referensi klik
    tr.innerHTML = `
      <td style="text-align: center;">${index + 1}</td>
      <td class="col-wrap-26">${item.no_sertifikat || ''}</td>
      <td class="col-wrap-26">${item.alamat_lokasi_kavling || ''}</td>
      <td class="col-wrap-26" style="background-color: #f0f8ff;">${item.user_pemohon || ''}</td>
      <td class="col-wrap-30">${item.nomor_imb || ''}</td>
      <td class="col-wrap-30">${item.penerima_imb || ''}</td>
      <td style="background-color: #fff0f5;">${item.update_penerima_imb || ''}</td>
      <td class="col-wrap-30">${formatDate(item.update_tgl_mutasi)}</td>
      <td class="col-wrap-30">${item.register_imb || ''}</td>
      <td>${item.referensi_sertifikat || ''}</td>
      <td>${formatDate(item.tahun_terbit_sertifikat)}</td>
      <td>${formatDate(item.tahun_akhir_sertifikat)}</td>
      <td></td> <!-- Kode Elektronik (Dikosongkan) -->
      <td>${item.surat_ukur || ''}</td>
      <td>${formatDate(item.tanggal_surat_ukur)}</td>
      <td>${item.luas_sertifikat || ''}</td>
      <td>${formatLuas(item.luas_bangunan)}</td>
      <td>${item.pemegang_hak_sekarang || ''}</td>
      <td>${item.pemegang_hak_lama || ''}</td>
      <td>${item.kelurahan || ''}</td>
      <td style="background-color: #e8f5e9;">${item.skema_pembiayaan || ''}</td>
      <td>${formatDate(item.serah_terima_kunci)}</td>
      <td>${item.tipe_kavling || ''}</td>
      <td>${item.blok_cluster || ''}</td>
      <td>${item.skema_penjualan || ''}</td>
      <td>${item.idpel_kwh || ''}</td>
      <td>${formatDate(item.tanggal_pasang_pdam)}</td>
      <td>${item.id_pdam || ''}</td>
      <td></td> <!-- Nomor PBB (Dikosongkan) -->
      <td></td> <!-- Nomor Debitur User (Dikosongkan) -->
      <td>${item.bpujl || ''}</td>
      <td>${item.petok_letter_c || ''}</td>
    `;
    
    // Tambahkan event listener klik: hanya 3 kolom pertama yang bisa buka detail
    tr.addEventListener('click', (e) => {
      const cell = e.target.closest('td');
      if (!cell) return;
      const cellIndex = cell.cellIndex; // 0-based
      if (cellIndex <= 2) {
        openEditModal(item);
      }
    });
    
    fragment.appendChild(tr);
  });
  
  tbody.appendChild(fragment);
}

// ===============================
// MODAL EDIT LOGIC
// ===============================

const editFields = [
  { label: 'Nomor Sertifikat', key: 'no_sertifikat', col: 13 },
  { label: 'Alamat Lokasi Kavling', key: 'alamat_lokasi_kavling', col: 1 },
  { label: 'Nomor IMB/PBG/SLF', key: 'nomor_imb', col: 32 },
  { label: 'Penerima IMB/PBG/SLF', key: 'penerima_imb', col: 33 },
  { label: 'Update Penerima IMB/PGB/SLF', key: 'update_penerima_imb', col: 34 },
  { label: 'Update tgl Mutasi IMB', key: 'update_tgl_mutasi', col: 30, type: 'date' },
  { label: 'Register IMB/PBG/SLF', key: 'register_imb', col: 31 },
  { label: 'Referensi Sertifikat', key: 'referensi_sertifikat', col: 5 },
  { label: 'Tahun Terbit Sertifikat', key: 'tahun_terbit_sertifikat', col: 36, type: 'date' },
  { label: 'Tahun Akhir Sertifikat', key: 'tahun_akhir_sertifikat', col: 37, type: 'date' },
  { label: 'Surat Ukur', key: 'surat_ukur', col: 38 },
  { label: 'Tanggal Surat Ukur', key: 'tanggal_surat_ukur', col: 39, type: 'date' },
  { label: 'Luas Sertifikat', key: 'luas_sertifikat', col: 17 },
  { label: 'Luas Bangunan', key: 'luas_bangunan', col: 43 },
  { label: 'Pemegang Hak Sekarang', key: 'pemegang_hak_sekarang', col: 44 },
  { label: 'Pemegang Hak Lama', key: 'pemegang_hak_lama', col: 40 },
  { label: 'Kelurahan', key: 'kelurahan', col: 41 },
  { label: 'Skema Pembiayaan', key: 'skema_pembiayaan', col: 11 },
  { label: 'Tipe Kavling', key: 'tipe_kavling', col: 6 },
  { label: 'Blok Cluster', key: 'blok_cluster', col: 2 },
  { label: 'User Pemohon', key: 'user_pemohon', col: 8 },
  { label: 'Skema Penjualan', key: 'skema_penjualan', col: 9 },
  { label: 'IDPEL KWH', key: 'idpel_kwh', col: 26 },
  { label: 'Tanggal Pasang PDAM', key: 'tanggal_pasang_pdam', col: 27, type: 'date' },
  { label: 'ID PDAM', key: 'id_pdam', col: 28 },
  { label: 'BPUJL', key: 'bpujl', col: 23 }
];

function openEditModal(item) {
  const modal = document.getElementById('editModal');
  const detailGrid = document.getElementById('detailGrid');
  
  detailGrid.innerHTML = '';
  
  editFields.forEach(field => {
    const div = document.createElement('div');
    div.className = 'form-group';
    
    let value = item[field.key] || '';
    // Jika tipe date, format ke DD/MM/YYYY untuk tampilan detail
    if (field.type === 'date' && value) {
      value = formatDate(value);
    }
    
    div.innerHTML = `
      <label>${field.label}</label>
      <div class="detail-value">${value || '-'}</div>
    `;
    detailGrid.appendChild(div);
  });
  
  modal.style.display = 'block';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

function openCsvModal() {
  const modal = document.getElementById('csvModal');
  if (modal) modal.style.display = 'block';
}

function closeCsvModal() {
  const modal = document.getElementById('csvModal');
  if (modal) modal.style.display = 'none';
}

// Inisialisasi Event Modal
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.querySelector('.close-btn');
  const cancelBtn = document.querySelector('.cancel-btn');
  const csvCloseBtn = document.querySelector('.csv-close');
  const btnDownloadExcelModal = document.getElementById('btnDownloadExcel');
  const csvSertifikatBtn = document.getElementById('btnCsvSertifikat');
  const csvPropertyBtn = document.getElementById('btnCsvProperty');
  
  if (closeBtn) closeBtn.onclick = closeEditModal;
  if (cancelBtn) cancelBtn.onclick = closeEditModal;
  if (csvCloseBtn) csvCloseBtn.onclick = closeCsvModal;
  
  if (btnDownloadExcelModal) btnDownloadExcelModal.onclick = () => {
    downloadExcel();
    closeCsvModal();
  };
  
  if (csvSertifikatBtn) csvSertifikatBtn.onclick = () => {
    downloadCSV('sertifikat');
    closeCsvModal();
  };
  if (csvPropertyBtn) csvPropertyBtn.onclick = () => {
    downloadCSV('property');
    closeCsvModal();
  };
  
  // Close modal when clicking outside
  window.onclick = (event) => {
    const modal = document.getElementById('editModal');
    const csvModal = document.getElementById('csvModal');
    if (event.target === modal) closeEditModal();
    if (event.target === csvModal) closeCsvModal();
  };
});

function updateDownloadButtons(enable) {
  const mainDownloadBtn = document.getElementById('mainDownloadBtn');
  if (mainDownloadBtn) mainDownloadBtn.disabled = !enable;
}

function initTableGrabScroll() {
  const container = document.querySelector('.table-container');
  if (!container) return;

  let isDown = false;
  let startX;
  let startY;
  let scrollLeft;
  let scrollTop;

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
    const x = e.pageX - container.offsetLeft;
    const y = e.pageY - container.offsetTop;
    const walkX = x - startX;
    const walkY = y - startY;
    container.scrollLeft = scrollLeft - walkX;
    container.scrollTop = scrollTop - walkY;
  });
}

// Download Excel Function
window.downloadExcel = function() {
  if (!currentTableData || currentTableData.length === 0) return;

  const allHeaders = [
    { label: 'No Sertifikat', key: 'no_sertifikat' },
    { label: 'Alamat Lokasi Kavling', key: 'alamat_lokasi_kavling' },
    { label: 'Nomor IMB/PBG/SLF', key: 'nomor_imb' },
    { label: 'Penerima IMB/PBG/SLF', key: 'penerima_imb' },
    { label: 'Update Penerima IMB/PGB/SLF', key: 'update_penerima_imb' },
    { label: 'Update tanggal Mutasi IMB/PBG/SLF', key: 'update_tgl_mutasi' },
    { label: 'Register IMB/PBG/SLF', key: 'register_imb' },
    { label: 'Referensi Sertifikat', key: 'referensi_sertifikat' },
    { label: 'Tahun Terbit Sertifikat', key: 'tahun_terbit_sertifikat' },
    { label: 'Tahun Akhir Sertifikat', key: 'tahun_akhir_sertifikat' },
    { label: 'Kode Elektronik', key: 'kode_elektronik' },
    { label: 'Surat Ukur', key: 'surat_ukur' },
    { label: 'Tanggal Surat Ukur', key: 'tanggal_surat_ukur' },
    { label: 'Luas Sertifikat', key: 'luas_sertifikat' },
    { label: 'Luas Bangunan', key: 'luas_bangunan' },
    { label: 'Pemegang Hak Sekarang', key: 'pemegang_hak_sekarang' },
    { label: 'Pemegang Hak Lama', key: 'pemegang_hak_lama' },
    { label: 'Kelurahan', key: 'kelurahan' },
    { label: 'Petok Letter C', key: 'petok_letter_c' },
    { label: 'Skema Pembiayaan', key: 'skema_pembiayaan' },
    { label: 'Serah Terima Kunci', key: 'serah_terima_kunci' },
    { label: 'Tipe Kavling', key: 'tipe_kavling' },
    { label: 'Blok Cluster', key: 'blok_cluster' },
    { label: 'User Pemohon', key: 'user_pemohon' },
    { label: 'Skema Penjualan', key: 'skema_penjualan' },
    { label: 'IDPEL KWH', key: 'idpel_kwh' },
    { label: 'Tanggal Pasang PDAM', key: 'tanggal_pasang_pdam' },
    { label: 'ID PDAM', key: 'id_pdam' },
    { label: 'Nomor PBB', key: 'nomor_pbb' },
    { label: 'Nomor Debitur User', key: 'nomor_debitur_user' },
    { label: 'BPUJL', key: 'bpujl' }
  ];

  // Prepare data for XLSX
  const excelData = currentTableData.map((row, index) => {
    const rowObj = { 'No': index + 1 };
    allHeaders.forEach(h => {
      let val = row[h.key] || '';
      
      // Force empty for specific columns
      if (['kode_elektronik', 'nomor_pbb', 'nomor_debitur_user'].includes(h.key)) {
        val = '';
      }
      // Format Luas Bangunan
      else if (h.key === 'luas_bangunan') {
        val = formatLuas(val);
      }
      // Format dates
      else if (['update_tgl_mutasi', 'tanggal_surat_ukur', 'tanggal_pasang_pdam', 'tahun_terbit_sertifikat', 'tahun_akhir_sertifikat', 'serah_terima_kunci'].includes(h.key)) {
        val = formatDate(val);
      }
      
      rowObj[h.label] = val;
    });
    return rowObj;
  });

  // Create Worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data Kavling");

  // Get unique filename
  let categoryLabel = document.querySelector(`.filter-btn[data-category="${currentCategory}"]`)?.textContent.split('\n')[0].trim() || 'Data';
  
  // Format search part
  const searchPart = currentSearchTerm ? `_${currentSearchTerm}` : '';
  
  // Format category part: replace spaces and special chars like /
  const categoryPart = categoryLabel.replace(/[\/\s]+/g, '_');
  
  const timestamp = new Date().toISOString().slice(0, 10);
  
  // Final filename pattern: Data_[Search]_[Category]_[Date].xlsx
  let filename = `Data${searchPart}_${categoryPart}_${timestamp}.xlsx`;
  
  // Sanitize filename final check (remove invalid characters like \ : * ? " < > |)
  filename = filename.replace(/[\/\\:*?"<>|]/g, '_');

  // Download
  XLSX.writeFile(workbook, filename);
};

// Download CSV Function (Keep for EMS or general)
window.downloadCSV = function(mode) {
  if (!currentTableData || currentTableData.length === 0) return;

  const allHeaders = [
    { label: 'No Sertifikat', key: 'no_sertifikat' },
    { label: 'Alamat Lokasi Kavling', key: 'alamat_lokasi_kavling' },
    { label: 'Referensi Sertifikat', key: 'referensi_sertifikat' },
    { label: 'Tahun Terbit Sertifikat', key: 'tahun_terbit_sertifikat' },
    { label: 'Tahun Akhir Sertifikat', key: 'tahun_akhir_sertifikat' },
    { label: 'Kode Elektronik', key: 'kode_elektronik' },
    { label: 'Surat Ukur', key: 'surat_ukur' },
    { label: 'Tanggal Surat Ukur', key: 'tanggal_surat_ukur' },
    { label: 'Luas Sertifikat', key: 'luas_sertifikat' },
    { label: 'Luas Bangunan', key: 'luas_bangunan' },
    { label: 'Pemegang Hak Sekarang', key: 'pemegang_hak_sekarang' },
    { label: 'Pemegang Hak Lama', key: 'pemegang_hak_lama' },
    { label: 'Kelurahan', key: 'kelurahan' },
    { label: 'Petok Letter C', key: 'petok_letter_c' },
    { label: 'Skema Pembiayaan', key: 'skema_pembiayaan' },
    { label: 'Tipe Kavling', key: 'tipe_kavling' },
    { label: 'Nomor IMB/PBG/SLF', key: 'nomor_imb' },
    { label: 'Penerima IMB/PBG/SLF', key: 'penerima_imb' },
    { label: 'Update Penerima IMB/PGB/SLF', key: 'update_penerima_imb' },
    { label: 'Update tanggal Mutasi IMB/PBG/SLF', key: 'update_tgl_mutasi' },
    { label: 'Register IMB/PBG/SLF', key: 'register_imb' },
    { label: 'Blok Cluster', key: 'blok_cluster' },
    { label: 'User Pemohon', key: 'user_pemohon' },
    { label: 'Skema Penjualan', key: 'skema_penjualan' },
    { label: 'IDPEL KWH', key: 'idpel_kwh' },
    { label: 'Tanggal Pasang PDAM', key: 'tanggal_pasang_pdam' },
    { label: 'ID PDAM', key: 'id_pdam' },
    { label: 'Nomor PBB', key: 'nomor_pbb' },
    { label: 'Nomor Debitur User', key: 'nomor_debitur_user' },
    { label: 'BPUJL', key: 'bpujl' }
  ];

  let headers = allHeaders;

  if (mode === 'sertifikat' || mode === 'ems') {
    const emsHeaders = [
      { label: 'No Sertifikat', key: 'no_sertifikat' },
      { label: 'Alamat Lokasi Kavling', key: 'alamat_lokasi_kavling' },
      { label: 'Referensi Sertifikat', key: 'referensi_sertifikat' },
      { label: 'Tahun Terbit Sertifikat', key: 'tahun_terbit_sertifikat' },
      { label: 'Tahun Akhir Sertifikat', key: 'tahun_akhir_sertifikat' },
      { label: 'Kode Elektronik', key: 'kode_elektronik' },
      { label: 'Surat Ukur', key: 'surat_ukur' },
      { label: 'Tanggal Surat Ukur', key: 'tanggal_surat_ukur' },
      { label: 'Luas Sertifikat', key: 'luas_sertifikat' },
      { label: 'Luas Bangunan', key: 'luas_bangunan' },
      { label: 'Pemegang Hak Sekarang', key: 'pemegang_hak_sekarang' },
      { label: 'Pemegang Hak Lama', key: 'pemegang_hak_lama' },
      { label: 'Kelurahan', key: 'kelurahan' },
      { label: 'Petok Letter C', key: 'petok_letter_c' },
      { label: 'Skema Pembiayaan', key: 'skema_pembiayaan' },
      { label: 'Tipe Kavling', key: 'tipe_kavling' },
      { label: 'Nomor IMB/PBG/SLF', key: 'nomor_imb' }
    ];
    headers = emsHeaders;
  } else if (mode === 'property') {
    const propertyHeaders = [
      { label: 'Alamat Lokasi Kavling', key: 'alamat_lokasi_kavling' },
      { label: 'No Sertifikat', key: 'no_sertifikat' },
      { label: 'Blok Cluster', key: 'blok_cluster' },
      { label: 'Referensi Sertifikat', key: 'referensi_sertifikat' },
      { label: 'Tipe Kavling', key: 'tipe_kavling' },
      { label: 'User Pemohon', key: 'user_pemohon' },
      { label: 'Skema Penjualan', key: 'skema_penjualan' },
      { label: 'Nomor Debitur User', key: 'nomor_debitur_user' },
      { label: 'Serah Terima Kunci', key: 'serah_terima_kunci' },
      { label: 'Luas Bangunan', key: 'luas_bangunan' },
      { label: 'Pemegang Hak Sekarang', key: 'pemegang_hak_sekarang' },
      { label: 'Pemegang Hak Lama', key: 'pemegang_hak_lama' },
      { label: 'BPUJL', key: 'bpujl' },
      { label: 'IDPEL KWH', key: 'idpel_kwh' },
      { label: 'Tanggal Pasang PDAM', key: 'tanggal_pasang_pdam' },
      { label: 'IDPL PDAM', key: 'id_pdam' },
      { label: 'Penerima IMB/PBG/SLF', key: 'penerima_imb' },
      { label: 'Skema Pembiayaan', key: 'skema_pembiayaan' },
      { label: 'Nomor Register IMB/PBG/SLF', key: 'register_imb' },
      { label: 'Nomor PBB', key: 'nomor_pbb' }
    ];
    headers = propertyHeaders;
  }

  // Create CSV Header
  let csvContent = headers.map(h => `"${h.label}"`).join(",") + "\n";

  // Create CSV Body
  currentTableData.forEach(row => {
    const rowData = headers.map(h => {
      let val = row[h.key] || '';
      
      // Force empty for specific columns (sesuai request)
      if (['kode_elektronik', 'nomor_pbb', 'nomor_debitur_user'].includes(h.key)) {
        val = '';
      }
      // Format Luas Bangunan
      else if (h.key === 'luas_bangunan') {
        val = formatLuas(val);
      }
      // Format dates if key matches
      else if (['update_tgl_mutasi', 'tanggal_surat_ukur', 'tanggal_pasang_pdam', 'tahun_terbit_sertifikat', 'tahun_akhir_sertifikat', 'serah_terima_kunci'].includes(h.key)) {
        val = formatDate(val);
      }
      
      // Escape quotes and wrap in quotes to handle commas and newlines
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvContent += rowData.join(",") + "\n";
  });

  // Create Download Link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  
  let filename;
  const datePart = new Date().toISOString().slice(0,10);
  if (mode === 'sertifikat' || mode === 'ems') {
    filename = `data_sertifikat_ems_${datePart}.csv`;
  } else if (mode === 'property') {
    filename = `data_property_ems_${datePart}.csv`;
  } else {
    filename = `data_kavling_lengkap_${datePart}.csv`;
  }
    
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Initialize
window.onload = function() {
  // Add Event Listeners for Filter Buttons
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', function() {
      const category = this.getAttribute('data-category');
      if(category) {
        filterData(category, this);
      }
    });
  });
  
  // Refresh Database Button
  const refreshBtn = document.getElementById('refreshBtn');
  if(refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      fetchData();
    });
  }
  
  // Main Download button listener
  const mainDownloadBtn = document.getElementById('mainDownloadBtn');
  if(mainDownloadBtn) {
    mainDownloadBtn.addEventListener('click', () => openCsvModal());
  }
  
  // Search Input Listener
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      currentSearchTerm = e.target.value;
      updateBadges(); // Perbarui semua jumlah di tombol sidebar
      applyFilterAndRender();
    });
  }

  // Search User Pemohon Listener
  const searchUserPemohon = document.getElementById('searchUserPemohon');
  if (searchUserPemohon) {
    searchUserPemohon.addEventListener('input', function(e) {
      currentSearchUserPemohon = e.target.value;
      // Hanya jalankan filter jika input kosong (reset) atau >= 3 karakter
      if (currentSearchUserPemohon === '' || currentSearchUserPemohon.length >= 3) {
        updateBadges();
        applyFilterAndRender();
      }
    });
  }

  // Sorting Listener
  const sortHeader = document.getElementById('sortAlamat');
  if (sortHeader) {
    sortHeader.addEventListener('click', function() {
      if (currentSortColumn === 'alamat_lokasi_kavling') {
        currentSortOrder = (currentSortOrder === 'asc') ? 'desc' : 'asc';
      } else {
        currentSortColumn = 'alamat_lokasi_kavling';
        currentSortOrder = 'asc';
      }
      
      updateSortUI();
      applyFilterAndRender();
    });
  }

  const sortUserPemohon = document.getElementById('sortUserPemohon');
  if (sortUserPemohon) {
    sortUserPemohon.addEventListener('click', function() {
      if (currentSortColumn === 'user_pemohon') {
        currentSortOrder = (currentSortOrder === 'asc') ? 'desc' : 'asc';
      } else {
        currentSortColumn = 'user_pemohon';
        currentSortOrder = 'asc';
      }
      
      updateSortUI();
      applyFilterAndRender();
    });
  }

  const sortSkema = document.getElementById('sortSkema');
  if (sortSkema) {
    sortSkema.addEventListener('click', function() {
      if (currentSortColumn === 'skema_penjualan') {
        currentSortOrder = (currentSortOrder === 'asc') ? 'desc' : 'asc';
      } else {
        currentSortColumn = 'skema_penjualan';
        currentSortOrder = 'asc';
      }
      
      updateSortUI();
      applyFilterAndRender();
    });
  }

  function updateSortUI() {
    document.querySelectorAll('.sortable').forEach(header => {
      header.classList.remove('asc', 'desc');
      const icon = header.querySelector('.sort-icon');
      if (icon) icon.textContent = '↕️';
    });

    const activeHeader = 
      currentSortColumn === 'alamat_lokasi_kavling' ? sortHeader : 
      currentSortColumn === 'user_pemohon' ? sortUserPemohon :
      sortSkema;
    if (activeHeader) {
      activeHeader.classList.add(currentSortOrder);
      const icon = activeHeader.querySelector('.sort-icon');
      if (icon) icon.textContent = currentSortOrder === 'asc' ? '🔼' : '🔽';
    }
  }
  
  // Set initial UI
  updateSortUI();

  // Load Data
  fetchData();

  initTableGrabScroll();
};
