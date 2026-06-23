// ===============================
// ADMIN FUNCTIONALITY
// ===============================

// Column indices for comparison (based on spreadsheet structure from code.gs)
const COMPARE_COLUMNS = {
  namaKavling: 0,      // Column A: ALAMAT LOKASI KAVLING
  nomorSertifikat: 12, // Column M: NO SERTIFIKAT
  pemohon: 7,         // Column H: UPDATE NAMA USER (USER PEMOHON)
  penjualan: 8,       // Column I: SKEMA PENJUALAN
  shm: 13,             // Column N: NOMOR SHM
  statusKavling: 5,   // Column F: TIPE KAVLING BERUPA
  sertifikatOnHand: 10,// Column K: SKEMA PEMBIAYAAN (check for ON_HAND)
  nomorImb: 31,        // Column AF: NOMOR IMB PBG SLF
  penerima: 19         // Column T: UPDATE PENERIMA SERTIFIKAT
};

// Initialize admin features
function initAdminFeatures() {
  const savedAccess = sessionStorage.getItem('access_level');
  if (savedAccess === 'admin' || (typeof accessLevel !== 'undefined' && accessLevel === 'admin')) {
    showAdminButton();
  }
}

// Also check and show button immediately if access level is already admin
if (typeof accessLevel !== 'undefined' && accessLevel === 'admin') {
  setTimeout(showAdminButton, 0);
}

// Show admin button in sidebar (above "download peta tampilan saat ini")
function showAdminButton() {
  console.log('Trying to show admin button...');
  
  // Get the lower div in sidebar (the one with download buttons)
  const sidebarContent = document.querySelector('.sidebar-left .sidebar-content');
  if (!sidebarContent) {
    console.error('Sidebar content not found!');
    return;
  }
  
  const downloadSection = sidebarContent.lastElementChild;
  if (!downloadSection) {
    console.error('Download section not found!');
    return;
  }
  
  // Check if button already exists
  if (document.getElementById('adminButton')) {
    console.log('Admin button already exists!');
    return;
  }
  
  const adminBtn = document.createElement('button');
  adminBtn.id = 'adminButton';
  adminBtn.innerHTML = '<span>⚙️</span> Admin Database Management';
  adminBtn.className = 'download-btn small-btn';
  adminBtn.style.cssText = 'background: #ff9800; color: white; margin-bottom: 5px;';
  adminBtn.addEventListener('click', openAdminModal);
  
  // Insert as first child of download section (above downloadMap)
  downloadSection.insertBefore(adminBtn, downloadSection.firstChild);
  console.log('Admin button added successfully!');
}

// Open admin modal
function openAdminModal() {
  // Check if modal already exists
  let modal = document.getElementById('adminModal');
  if (modal) {
    modal.style.display = 'flex';
    return;
  }
  
  // Create modal
  modal = document.createElement('div');
  modal.id = 'adminModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:20000;';
  
  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:12px;max-width:900px;width:90%;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="margin:0;color:#333;">⚙️ Database Management</h2>
        <button id="closeAdminModal" style="background:none;border:none;font-size:28px;cursor:pointer;color:#666;">&times;</button>
      </div>
      
      <div style="margin-bottom:20px;">
        <h3 style="color:#666;margin-bottom:10px;">1. Download Current Database</h3>
        <button id="downloadCurrentDB" style="background:#2196F3;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:bold;">
          📥 Download Database Saat Ini
        </button>
      </div>
      
      <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
      
      <div style="margin-bottom:20px;">
        <h3 style="color:#666;margin-bottom:10px;">2. Compare Database</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label style="display:block;margin-bottom:5px;font-weight:bold;">Pilih File Database Lokal:</label>
            <input type="file" id="localDBFile" accept=".xlsx,.xls,.csv" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;box-sizing:border-box;">
          </div>
          <button id="compareDBBtn" style="background:#4CAF50;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:bold;width:max-content;">
            🔄 Bandingkan Database
          </button>
        </div>
      </div>
      
      <div id="comparisonResult" style="display:none;">
        <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
        <h3 style="color:#666;margin-bottom:10px;">3. Hasil Perbandingan</h3>
        <button id="downloadComparisonResult" style="background:#ff9800;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:bold;margin-bottom:10px;">
          📊 Download Hasil Perbandingan (Excel)
        </button>
        <div id="comparisonTableContainer" style="overflow-x:auto;"></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  document.getElementById('closeAdminModal').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  document.getElementById('downloadCurrentDB').addEventListener('click', downloadCurrentDatabase);
  
  document.getElementById('compareDBBtn').addEventListener('click', compareDatabases);
  
  document.getElementById('downloadComparisonResult').addEventListener('click', downloadComparisonResult);
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// Download current database from API
async function downloadCurrentDatabase() {
  try {
    // Get data from both APIs (kavling and certificate)
    const [kavlingData, certData] = await Promise.all([
      fetch(`${API_URL}?action=status&_t=${Date.now()}`).then(r => r.json()),
      fetch(`${CERT_API_URL}?action=get_all&_t=${Date.now()}`).then(r => r.json())
    ]);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Add kavling status sheet
    if (kavlingData && kavlingData.data) {
      const kavlingSheetData = kavlingData.data.map(item => item.rawData || []);
      const ws1 = XLSX.utils.aoa_to_sheet(kavlingSheetData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Kavling Status');
    }
    
    // Add certificate sheet
    if (certData && certData.data) {
      const ws2 = XLSX.utils.aoa_to_sheet(certData.data);
      XLSX.utils.book_append_sheet(wb, ws2, 'Sertifikat');
    }
    
    // Download file
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `database_kavling_${timestamp}.xlsx`);
    
  } catch (error) {
    console.error('Error downloading database:', error);
    alert('Gagal mengunduh database: ' + error.message);
  }
}

// Compare databases
async function compareDatabases() {
  const fileInput = document.getElementById('localDBFile');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Silakan pilih file database terlebih dahulu!');
    return;
  }
  
  try {
    // Read local file
    const localData = await readExcelFile(file);
    
    // Fetch online data
    const onlineData = await fetchOnlineDatabase();
    
    // Compare data
    const changes = compareData(localData, onlineData);
    
    // Display result
    displayComparisonResult(changes);
    
  } catch (error) {
    console.error('Error comparing databases:', error);
    alert('Gagal membandingkan database: ' + error.message);
  }
}

// Read Excel file
function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

// Fetch online database (main kavling data)
async function fetchOnlineDatabase() {
  const response = await fetch(`${API_URL}?action=status&_t=${Date.now()}`);
  const data = await response.json();
  if (data && data.data) {
    return data.data.map(item => item.rawData || []);
  }
  return [];
}

// Compare two datasets
function compareData(localData, onlineData) {
  const changes = [];
  
  // Create a map of local data by nama kavling
  const localMap = new Map();
  localData.forEach((row, index) => {
    if (row[0]) { // Assuming nama kavling is in column 0
      localMap.set(String(row[0]).trim().toUpperCase(), { row, index });
    }
  });
  
  // Create a map of online data by nama kavling
  const onlineMap = new Map();
  onlineData.forEach((row, index) => {
    if (row[0]) {
      onlineMap.set(String(row[0]).trim().toUpperCase(), { row, index });
    }
  });
  
  // Check for rows in online but not in local (new rows)
  onlineMap.forEach((value, key) => {
    if (!localMap.has(key)) {
      changes.push({
        type: 'BARU',
        namaKavling: key,
        changes: 'Data baru ditambahkan'
      });
    }
  });
  
  // Check for rows in local but not in online (deleted rows)
  localMap.forEach((value, key) => {
    if (!onlineMap.has(key)) {
      changes.push({
        type: 'DIHAPUS',
        namaKavling: key,
        changes: 'Data dihapus'
      });
    }
  });
  
  // Check for changed rows
  localMap.forEach((localValue, key) => {
    if (onlineMap.has(key)) {
      const localRow = localValue.row;
      const onlineRow = onlineMap.get(key).row;
      const rowChanges = [];
      
      // Check each column we care about
      Object.entries(COMPARE_COLUMNS).forEach(([colName, colIndex]) => {
        const localVal = String(localRow[colIndex] || '').trim();
        const onlineVal = String(onlineRow[colIndex] || '').trim();
        
        if (localVal !== onlineVal) {
          rowChanges.push(`${colName}: "${localVal}" → "${onlineVal}"`);
        }
      });
      
      if (rowChanges.length > 0) {
        changes.push({
          type: 'DIUBAH',
          namaKavling: key,
          changes: rowChanges.join('; ')
        });
      }
    }
  });
  
  return changes;
}

// Display comparison result
function displayComparisonResult(changes) {
  const resultDiv = document.getElementById('comparisonResult');
  const tableContainer = document.getElementById('comparisonTableContainer');
  
  resultDiv.style.display = 'block';
  
  if (changes.length === 0) {
    tableContainer.innerHTML = '<p style="color:#4CAF50;font-weight:bold;text-align:center;padding:20px;">Tidak ada perubahan ditemukan!</p>';
    window.comparisonChanges = [];
    return;
  }
  
  // Store changes for download
  window.comparisonChanges = changes;
  
  // Create table
  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:14px;';
  
  // Header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr style="background:#673ab7;color:white;">
      <th style="padding:12px;text-align:left;border:1px solid #ddd;">Tipe Perubahan</th>
      <th style="padding:12px;text-align:left;border:1px solid #ddd;">Nama Kavling</th>
      <th style="padding:12px;text-align:left;border:1px solid #ddd;">Detail Perubahan</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Body
  const tbody = document.createElement('tbody');
  changes.forEach(change => {
    const row = document.createElement('tr');
    let bgColor = '#fff';
    if (change.type === 'BARU') bgColor = '#e8f5e9';
    else if (change.type === 'DIHAPUS') bgColor = '#ffebee';
    else if (change.type === 'DIUBAH') bgColor = '#fff3e0';
    
    row.style.background = bgColor;
    row.innerHTML = `
      <td style="padding:10px;border:1px solid #ddd;font-weight:bold;">${change.type}</td>
      <td style="padding:10px;border:1px solid #ddd;">${change.namaKavling}</td>
      <td style="padding:10px;border:1px solid #ddd;">${change.changes}</td>
    `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  
  tableContainer.innerHTML = '';
  tableContainer.appendChild(table);
}

// Download comparison result
function downloadComparisonResult() {
  const changes = window.comparisonChanges || [];
  
  if (changes.length === 0) {
    alert('Tidak ada data perubahan untuk diunduh!');
    return;
  }
  
  // Prepare data for Excel
  const excelData = [
    ['Tipe Perubahan', 'Nama Kavling', 'Detail Perubahan'],
    ...changes.map(change => [change.type, change.namaKavling, change.changes])
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hasil Perbandingan');
  
  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `hasil_perbandingan_database_${timestamp}.xlsx`);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initAdminFeatures);

// Check for admin access every 100ms for the first 5 seconds to handle timing issues
let adminCheckCount = 0;
const adminCheckInterval = setInterval(() => {
  adminCheckCount++;
  const savedAccess = sessionStorage.getItem('access_level');
  if (savedAccess === 'admin' || (typeof accessLevel !== 'undefined' && accessLevel === 'admin')) {
    showAdminButton();
    clearInterval(adminCheckInterval);
  }
  if (adminCheckCount >= 50) { // Stop after 5 seconds (50 * 100ms)
    clearInterval(adminCheckInterval);
  }
}, 100);
