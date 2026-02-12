// ===============================
// KONEKSI DATABASE (APPSCRIPT API)
// ===============================

const API_URL = 'https://script.google.com/macros/s/AKfycbxnzA8pzipqCFj8y8Yuor9GHqBLj18yk1-cFOsn8Tc2pDBGwjTh1fdyJchjbD7KQGhe/exec';
const CERT_API_URL = 'https://script.google.com/macros/s/AKfycbyEPaUBAg2n3732mTnukOnoxA6eN6eTEjso929InZZEbIqjycGzb8zuSJdLmyfaFEJf3w/exec';

// 🔗 ALIAS untuk API Kavling (sama dengan API_URL)
const KAVLING_API_URL = API_URL; // SAMA, karena database kavling

console.log('🔗 Database Connection Initialized');

// Global State
let globalData = {};
let currentCategory = '';
let currentSearchTerm = '';
let currentTableData = []; // Data yang sedang ditampilkan di tabel (setelah filter)
let currentSortOrder = 'asc'; // 'asc' or 'desc'

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

  try {
    console.log('⏳ Mengambil data dari API...');
    const response = await fetch(`${API_URL}?action=imb_status&_t=${Date.now()}`);
    const result = await response.json();
    
    if (result.status === 'success') {
      console.log('✅ Data berhasil diambil');
      globalData = result; // Simpan seluruh data response
      
      // Update Badges
      updateBadges();
      
      // Default pilih kategori pertama jika belum ada yang dipilih
      if (!currentCategory) {
        // Cari tombol pertama yang aktif atau default ke 'stok_imb'
        const firstBtn = document.querySelector('.filter-btn');
        if (firstBtn) {
          const category = firstBtn.getAttribute('data-category');
          filterData(category, firstBtn);
        }
      } else {
        // Refresh tampilan dengan data baru
        applyFilterAndRender();
      }
      
    } else {
      console.error('❌ Gagal mengambil data:', result.message);
      alert('Gagal mengambil data: ' + result.message);
    }
    
  } catch (error) {
    console.error('❌ Error Fetching Data:', error);
    alert('Terjadi kesalahan koneksi saat mengambil data.');
  } finally {
    loading.style.display = 'none';
    buttons.forEach(btn => btn.style.pointerEvents = 'auto');
  }
}

// Helper: Filter data berdasarkan term pencarian
function getFilteredData(data, searchTerm) {
  if (!searchTerm) return data;
  const term = searchTerm.toLowerCase();
  return data.filter(item => {
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

// Update Badges Count
function updateBadges() {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    const category = btn.getAttribute('data-category');
    if (category && globalData[category]) {
      const filtered = getFilteredData(globalData[category], currentSearchTerm);
      const count = filtered.length;
      const badge = btn.querySelector('.count-badge');
      if (badge) badge.textContent = count;
    }
  });
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
  let data = globalData[currentCategory] || [];
  
  // Filter berdasarkan Search Term
  data = getFilteredData(data, currentSearchTerm);

  // Sorting: Alamat Lokasi Kavling (Natural Sort)
  data.sort((a, b) => {
    const valA = a.alamat_lokasi_kavling || '';
    const valB = b.alamat_lokasi_kavling || '';
    
    // Gunakan localeCompare dengan numeric: true untuk pengurutan alami (misal: M1, M2, M10)
    const compareResult = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    
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
    tr.innerHTML = `
      <td style="text-align: center;">${index + 1}</td>
      <td>${item.no_sertifikat || ''}</td>
      <td>${item.alamat_lokasi_kavling || ''}</td>
      <td>${item.nomor_imb || ''}</td>
      <td>${item.penerima_imb || ''}</td>
      <td>${item.update_penerima_imb || ''}</td>
      <td>${formatDate(item.update_tgl_mutasi)}</td>
      <td>${item.register_imb || ''}</td>
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
      <td>${item.petok_letter_c || ''}</td>
      <td>${item.skema_pembiayaan || ''}</td>
      <td>${item.tipe_kavling || ''}</td>
      <td>${item.blok_cluster || ''}</td>
      <td>${item.user_pemohon || ''}</td>
      <td>${item.skema_penjualan || ''}</td>
      <td>${item.idpel_kwh || ''}</td>
      <td>${formatDate(item.tanggal_pasang_pdam)}</td>
      <td>${item.id_pdam || ''}</td>
      <td></td> <!-- Nomor PBB (Dikosongkan) -->
      <td></td> <!-- Nomor Debitur User (Dikosongkan) -->
      <td>${item.bpujl || ''}</td>
    `;
    fragment.appendChild(tr);
  });
  
  tbody.appendChild(fragment);
}

function updateDownloadButtons(enable) {
  const downloadBtnFull = document.getElementById('downloadBtnFull');
  const downloadBtnEMS = document.getElementById('downloadBtnEMS');
  
  if (downloadBtnFull) downloadBtnFull.disabled = !enable;
  if (downloadBtnEMS) downloadBtnEMS.disabled = !enable;
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
      else if (['update_tgl_mutasi', 'tanggal_surat_ukur', 'tanggal_pasang_pdam', 'tahun_terbit_sertifikat', 'tahun_akhir_sertifikat'].includes(h.key)) {
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
  const categoryLabel = document.querySelector(`.filter-btn[data-category="${currentCategory}"]`)?.textContent.split('\n')[0].trim() || 'Data';
  const searchSuffix = currentSearchTerm ? `_search_${currentSearchTerm}` : '';
  const timestamp = new Date().toISOString().slice(0, 10);
  let filename = `Data_${categoryLabel}${searchSuffix}_${timestamp}.xlsx`;
  
  // Sanitize filename (remove invalid characters like / \ : * ? " < > |)
  filename = filename.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_');

  // Download
  XLSX.writeFile(workbook, filename);
};

// Download CSV Function (Keep for EMS or general)
window.downloadCSV = function(mode) {
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

  let headers = allHeaders;

  // Filter headers if mode is 'ems'
  if (mode === 'ems') {
    const excludedKeys = [
      'update_tgl_mutasi',
      'register_imb',
      'nomor_imb',
      'penerima_imb',
      'update_penerima_imb'
    ];
    headers = allHeaders.filter(h => !excludedKeys.includes(h.key));
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
      else if (['update_tgl_mutasi', 'tanggal_surat_ukur', 'tanggal_pasang_pdam', 'tahun_terbit_sertifikat', 'tahun_akhir_sertifikat'].includes(h.key)) {
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
  
  const filename = mode === 'ems' 
    ? `data_kavling_ems_${new Date().toISOString().slice(0,10)}.csv`
    : `data_kavling_lengkap_${new Date().toISOString().slice(0,10)}.csv`;
    
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
  
  // Download button listener
  const downloadBtnFull = document.getElementById('downloadBtnFull');
  if(downloadBtnFull) {
    downloadBtnFull.addEventListener('click', () => downloadExcel());
  }

  const downloadBtnEMS = document.getElementById('downloadBtnEMS');
  if(downloadBtnEMS) {
    downloadBtnEMS.addEventListener('click', () => downloadCSV('ems'));
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

  // Sorting Listener
  const sortHeader = document.getElementById('sortAlamat');
  if (sortHeader) {
    sortHeader.addEventListener('click', function() {
      // Toggle order
      currentSortOrder = (currentSortOrder === 'asc') ? 'desc' : 'asc';
      
      // Update UI
      this.classList.toggle('asc', currentSortOrder === 'asc');
      this.classList.toggle('desc', currentSortOrder === 'desc');
      const icon = this.querySelector('.sort-icon');
      if (icon) icon.textContent = currentSortOrder === 'asc' ? '🔼' : '🔽';
      
      applyFilterAndRender();
    });
    
    // Set initial class
    sortHeader.classList.add('asc');
    const icon = sortHeader.querySelector('.sort-icon');
    if (icon) icon.textContent = '🔼';
  }

  // Load Data
  fetchData();
};
