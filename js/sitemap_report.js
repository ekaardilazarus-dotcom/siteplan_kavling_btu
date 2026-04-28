/**
 * Sitemap BTU KNC Report JS
 * Handles SVG loading, map download, and popup interaction.
 */

// URLs API
const API_URL = 'https://script.google.com/macros/s/AKfycbwH8txRUzzpGc_2Y8rjvkNuxqaL_omv29xsiW0nGaNDPLNbE3auB3zx9ZndopWzBLwv/exec';
const CERT_API_URL = 'https://script.google.com/macros/s/AKfycbxuAe7llIpc3SxGAhJ-d_HHYa4Ut9z-nHj8MVUGx4-_Qo7W5mwSLHEKStifg4MRD5Nofg/exec';

// Cache & State
let searchCache = new Map();
let certSearchCache = new Map();
let kavlingStatusIndex = new Map();
let certificateDB = new Map();
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 jam

// Color Filter State
let allKavlingIds = [];
let appliedColorings = []; // { id: timestamp, kavlings: [], color: '', colorName: '' }
let statusToggles = {
    onhand: false,
    stok: false
};

// Audio
const clickSound = new Audio('klik.mp3');

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load SVG first (Priority)
    await loadSvg();
    
    // 2. Initialize interactive features immediately after SVG is in DOM
    initPanZoom();
    initClickPopup();
    initColorFilter();
    initDownload();

    // 3. Preload data from database in background
    // This won't block the UI
    preloadKavlingStatusData();
    loadFullCertificateDatabase();
});

/**
 * Load SVG from file
 */
async function loadSvg() {
    console.log('🔄 Memulai memuat SVG...');
    const container = document.getElementById('map-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    
    // Safety timeout to hide overlay even if something hangs
    const safetyTimeout = setTimeout(() => {
        if (loadingOverlay && loadingOverlay.style.display !== 'none') {
            console.warn('⚠️ Safety timeout reached, hiding overlay anyway.');
            loadingOverlay.style.display = 'none';
        }
    }, 15000); // 15 detik

    try {
        console.log('📡 Fetching sitemap.svg...');
        if (loadingText) loadingText.textContent = 'Mengambil data peta (ini mungkin butuh waktu)...';
        
        const response = await fetch('sitemap.svg');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const svgText = await response.text();
        console.log('✅ SVG text fetched, length:', svgText.length);
        
        if (loadingText) loadingText.textContent = 'Menyusun peta...';
        console.log('🏗️ Injecting SVG into DOM...');
        
        // Use requestAnimationFrame to ensure the browser has a chance to breathe
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        container.innerHTML = svgText;
        
        const svg = container.querySelector('svg');
        if (svg) {
            svg.setAttribute('id', 'sitemap-svg');
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.display = 'block';
            
            if (!svg.getAttribute('viewBox')) {
                const width = svg.getAttribute('width') || 11703;
                const height = svg.getAttribute('height') || 16003;
                svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }
            console.log('✅ SVG injected and configured');
        } else {
            throw new Error('SVG element not found in the fetched content');
        }

        // HIDE OVERLAY IMMEDIATELY
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
            console.log('👋 Loading overlay hidden');
        }
        clearTimeout(safetyTimeout);
        
        // Extract all kavling IDs in background
        setTimeout(() => {
            try {
                console.log('🔄 Mengekstrak ID kavling di background...');
                const groups = container.querySelectorAll('g[id^="GA"], g[id^="UJ"], g[id^="KR"], g[id^="M"], g[id^="Blok"], g[id^="BLOK"]');
                allKavlingIds = Array.from(groups)
                    .map(g => g.id.trim().toUpperCase())
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort();
                console.log(`✅ ${allKavlingIds.length} ID kavling ditemukan`);
            } catch (e) {
                console.error('⚠️ Error extracting IDs in background:', e);
            }
        }, 500);
        
    } catch (error) {
        console.error('❌ Error loading SVG:', error);
        if (loadingText) {
            loadingText.textContent = 'Gagal memuat peta: ' + error.message;
        }
        // Force hide overlay after error message is seen
        setTimeout(() => {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }, 5000);
    } finally {
        console.log('🏁 loadSvg finished');
    }
}

/**
 * Basic Pan and Zoom for SVG
 */
function initPanZoom() {
    const svg = document.getElementById('sitemap-svg');
    if (!svg) return;

    let isPanning = false;
    let startPoint = { x: 0, y: 0 };
    let viewBox = svg.viewBox.baseVal;

    svg.addEventListener('mousedown', (e) => {
        // Only pan if clicking background or non-clickable element
        if (e.target.closest('g[id^="GA"], g[id^="UJ"], g[id^="KR"], g[id^="M"], g[id^="Blok"], g[id^="BLOK"]')) {
            return;
        }
        isPanning = true;
        startPoint = { x: e.clientX, y: e.clientY };
        svg.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;

        const dx = (e.clientX - startPoint.x) * (viewBox.width / svg.clientWidth);
        const dy = (e.clientY - startPoint.y) * (viewBox.height / svg.clientHeight);

        viewBox.x -= dx;
        viewBox.y -= dy;

        startPoint = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        svg.style.cursor = 'grab';
    });

    svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomScale = 1.1;
        const delta = e.deltaY > 0 ? zoomScale : 1 / zoomScale;

        const mouseX = e.offsetX;
        const mouseY = e.offsetY;

        // Convert mouse position to SVG coordinates
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = mouseX;
        svgPoint.y = mouseY;
        const coords = svgPoint.matrixTransform(svg.getScreenCTM().inverse());

        const newWidth = viewBox.width * delta;
        const newHeight = viewBox.height * delta;

        viewBox.x = coords.x - (coords.x - viewBox.x) * delta;
        viewBox.y = coords.y - (coords.y - viewBox.y) * delta;
        viewBox.width = newWidth;
        viewBox.height = newHeight;
    });
}

/**
 * Initialize Click to show Popup
 */
function initClickPopup() {
    const svg = document.getElementById('sitemap-svg');
    if (!svg) return;

    svg.addEventListener('click', (e) => {
        const targetGroup = e.target.closest('g[id^="GA"], g[id^="UJ"], g[id^="KR"], g[id^="M"], g[id^="Blok"], g[id^="BLOK"]');
        
        if (targetGroup) {
            const kode = targetGroup.id.trim().toUpperCase();
            console.log('🖱️ Klik kavling:', kode);
            
            // Highlight
            document.querySelectorAll('.highlight-kavling').forEach(el => el.classList.remove('highlight-kavling'));
            targetGroup.classList.add('highlight-kavling');

            // Sound
            if (clickSound) {
                clickSound.currentTime = 0;
                clickSound.play().catch(() => {});
            }

            fetchDataForAddress(kode);
        } else {
            // Click outside kavling
            document.querySelectorAll('.highlight-kavling').forEach(el => el.classList.remove('highlight-kavling'));
        }
    });
}

/**
 * Fetch data for address (from cache or API)
 */
async function fetchDataForAddress(address) {
    if (!address || !address.trim()) return;

    const cleanAddress = address.trim().toUpperCase();
    
    // 1. Cek Cache Status
    const statusEntry = kavlingStatusIndex.get(cleanAddress);
    if (statusEntry && statusEntry.ai) {
        showKavlingPopup(cleanAddress, {
            status: 'success',
            data: statusEntry.ai,
            message: 'Data ditemukan (Cache Status)'
        });
        return;
    }

    // 2. Cek DB Lokal
    const dbKey = normalizeCertId(cleanAddress);
    const dbResult = certificateDB.get(dbKey);
    if (dbResult) {
        showKavlingPopup(cleanAddress, {
            status: dbResult.data ? 'success' : 'empty',
            data: dbResult.data || '',
            message: 'Data ditemukan (Local DB)'
        });
        return;
    }

    // 3. Tampilkan Loading
    showKavlingPopup(cleanAddress, { status: 'loading' });

    // 4. Fetch API
    try {
        const url = `${API_URL}?address=${encodeURIComponent(cleanAddress)}&_t=${Date.now()}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === 'success' && data.data) {
            searchCache.set(cleanAddress, { data: data.data, timestamp: Date.now() });
        }

        showKavlingPopup(cleanAddress, {
            status: data.status === 'not_found' ? 'notfound' : data.status,
            data: data.data || '',
            message: data.message || ''
        });
    } catch (err) {
        console.error('❌ Fetch error:', err);
        showKavlingPopup(cleanAddress, { status: 'error', message: err.message });
    }
}

/**
 * Show Popup
 */
function showKavlingPopup(address, result) {
    // Remove old
    const oldPopup = document.querySelector('.kavling-popup');
    if (oldPopup) oldPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'kavling-popup';

    let statusClass = '';
    let statusText = '';
    let dataContent = '';
    let statusInfoContent = '';

    const statusEntry = kavlingStatusIndex.get(address);
    if (statusEntry) {
        const kategori = (statusEntry.kategori || 'unknown').toUpperCase();
        statusInfoContent = `
            <div style="margin-bottom:10px; padding:10px; border-radius:8px; background:#f5f5f5; font-size:13px; color:#333;">
                <div>Status: <strong>${kategori}</strong></div>
            </div>
        `;
    }

    switch (result.status) {
        case 'loading':
            statusText = '⏳ Mencari data...';
            dataContent = '<div style="text-align:center;padding:20px;">Mohon tunggu...</div>';
            break;
        case 'success':
            statusClass = 'kavling-status-success';
            statusText = '✅ Data ditemukan';
            dataContent = `<div class="kavling-data-content">${result.data}</div>`;
            break;
        case 'empty':
            statusText = 'ℹ️ Kolom data kosong';
            dataContent = '<div style="text-align:center;padding:20px;">Data ditemukan tetapi kolom AI kosong</div>';
            break;
        case 'notfound':
            statusText = '🔍 Tidak ditemukan';
            dataContent = '<div style="text-align:center;padding:20px;">Kode tidak terdaftar di database</div>';
            break;
        case 'error':
            statusText = '❌ Kesalahan';
            dataContent = `<div style="text-align:center;padding:20px;">${result.message}</div>`;
            break;
    }

    popup.innerHTML = `
        <div class="kavling-popup-content">
            <div class="kavling-popup-header">
                <h3>Kavling: ${address}</h3>
                <button onclick="this.closest('.kavling-popup').remove()">&times;</button>
            </div>
            <div class="kavling-popup-body">
                <div class="${statusClass}" style="margin-bottom:10px; font-weight:bold;">${statusText}</div>
                ${statusInfoContent}
                ${dataContent}
            </div>
            <div style="padding:15px; text-align:right; border-top:1px solid #eee;">
                <button onclick="this.closest('.kavling-popup').remove()" style="padding:8px 20px; cursor:pointer;">Tutup</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);
    popup.style.display = 'flex';
}

/**
 * Data Preloading Functions
 */
async function preloadKavlingStatusData() {
    console.log('📦 Memulai preload status kavling...');
    try {
        // Cek LocalStorage dulu untuk efisiensi
        const CACHE_KEY = 'kavlingStatusData_Report';
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 1000 * 60 * 60) { // Cache 1 jam
                parsed.data.forEach(item => {
                    kavlingStatusIndex.set(item.kode.toUpperCase(), item);
                });
                console.log('⚡ Menggunakan cache status kavling (Local)');
                return;
            }
        }

        // Jika tidak ada cache atau expired, ambil dari API
        const url = `${API_URL}?action=status&_t=${Date.now()}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.data) {
            data.data.forEach(item => {
                if (item.kode) {
                    kavlingStatusIndex.set(item.kode.toUpperCase(), item);
                }
            });

            // Simpan ke cache
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: data.data
            }));
            
            console.log('✅ Status data preloaded from API');
            
            // Re-apply colors if any toggles are already on
            if (statusToggles.onhand || statusToggles.stok) {
                updateSVGColors();
            }
        }
    } catch (e) {
        console.warn('⚠️ Gagal preload status:', e);
    }
}

async function loadFullCertificateDatabase() {
    try {
        const res = await fetch(CERT_API_URL + '?action=get_all');
        const data = await res.json();
        if (data.status === 'success') {
            data.data.forEach(item => {
                const key = normalizeCertId(item.kode);
                certificateDB.set(key, item);
            });
            console.log('✅ Cert database preloaded');
        }
    } catch (e) {
        console.warn('⚠️ Gagal preload cert db');
    }
}

function normalizeCertId(raw) {
    if (!raw) return '';
    return raw.toString().trim().toUpperCase().replace(/[-_]/g, '');
}

/**
 * Initialize Color Filter Logic
 */
function initColorFilter() {
    const kavlingInput = document.getElementById('kavlingInput');
    const addColorBtn = document.getElementById('addColorBtn');
    const colorSelect = document.getElementById('colorSelect');
    const toggleOnHand = document.getElementById('toggleOnHand');
    const toggleStok = document.getElementById('toggleStok');

    if (!kavlingInput || !addColorBtn) return;

    // Status Toggles Logic
    if (toggleOnHand) {
        toggleOnHand.addEventListener('change', (e) => {
            statusToggles.onhand = e.target.checked;
            updateSVGColors();
        });
    }

    if (toggleStok) {
        toggleStok.addEventListener('change', (e) => {
            statusToggles.stok = e.target.checked;
            updateSVGColors();
        });
    }

    // Autocomplete for kavling input
    setupAutocomplete(kavlingInput);

    // Add Color Button Click
    addColorBtn.addEventListener('click', () => {
        const inputVal = kavlingInput.value.trim();
        if (!inputVal) {
            alert('Silakan masukkan kode kavling!');
            return;
        }

        const color = colorSelect.value;
        const colorName = colorSelect.options[colorSelect.selectedIndex].text;
        const kavlings = inputVal.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== '');

        // Add to state
        appliedColorings.push({
            id: Date.now(),
            kavlings: kavlings,
            color: color,
            colorName: colorName
        });

        // Reset input
        kavlingInput.value = '';
        
        // Update UI & SVG
        renderAppliedColorsList();
        updateSVGColors();
    });
}

/**
 * Setup Autocomplete Logic
 */
function setupAutocomplete(input) {
    const listContainer = document.getElementById('autocompleteList');
    let currentFocus;

    input.addEventListener('input', function(e) {
        const val = this.value;
        closeAllLists();
        if (!val) return false;
        
        // Get last part if comma separated
        const parts = val.split(',');
        const lastPart = parts[parts.length - 1].trim().toUpperCase();
        if (!lastPart) return false;

        currentFocus = -1;
        
        const matches = allKavlingIds.filter(id => id.startsWith(lastPart)).slice(0, 10);
        
        matches.forEach(match => {
            const b = document.createElement('div');
            b.innerHTML = "<strong>" + match.substr(0, lastPart.length) + "</strong>";
            b.innerHTML += match.substr(lastPart.length);
            b.innerHTML += "<input type='hidden' value='" + match + "'>";
            
            b.addEventListener('click', function(e) {
                parts[parts.length - 1] = this.getElementsByTagName('input')[0].value;
                input.value = parts.join(', ') + (parts.length > 0 ? ', ' : '');
                input.focus();
                closeAllLists();
            });
            listContainer.appendChild(b);
        });
    });

    input.addEventListener('keydown', function(e) {
        let x = document.getElementById(this.id + 'autocomplete-list');
        if (x) x = x.getElementsByTagName('div');
        if (e.keyCode == 40) { // down
            currentFocus++;
            addActive(x);
        } else if (e.keyCode == 38) { // up
            currentFocus--;
            addActive(x);
        } else if (e.keyCode == 13) { // enter
            e.preventDefault();
            if (currentFocus > -1) {
                if (x) x[currentFocus].click();
            }
        }
    });

    function addActive(x) {
        if (!x) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add('autocomplete-active');
    }

    function removeActive(x) {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove('autocomplete-active');
        }
    }

    function closeAllLists(elmnt) {
        const x = document.getElementsByClassName('autocomplete-items');
        for (let i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != input) {
                x[i].innerHTML = '';
            }
        }
    }

    document.addEventListener('click', function (e) {
        closeAllLists(e.target);
    });
}

/**
 * Render List of Applied Colors
 */
function renderAppliedColorsList() {
    const list = document.getElementById('appliedColorsList');
    if (!list) return;

    list.innerHTML = '';
    appliedColorings.forEach(item => {
        const li = document.createElement('li');
        li.className = 'applied-item';
        li.innerHTML = `
            <span class="color-dot" style="background-color: ${item.color}"></span>
            <span class="kavling-names" title="${item.kavlings.join(', ')}">${item.kavlings.join(', ')}</span>
            <span class="remove-item" onclick="removeColoring(${item.id})">&times;</span>
        `;
        list.appendChild(li);
    });
}

/**
 * Global function to remove coloring
 */
window.removeColoring = function(id) {
    appliedColorings = appliedColorings.filter(item => item.id !== id);
    renderAppliedColorsList();
    updateSVGColors();
};

/**
 * Update SVG colors based on appliedColorings
 */
function updateSVGColors() {
    const svg = document.getElementById('sitemap-svg');
    if (!svg) return;

    // 1. Reset all colors first
    allKavlingIds.forEach(id => {
        const group = svg.getElementById(id);
        if (group) {
            group.style.fill = '';
            group.querySelectorAll('path, rect, polygon, circle, ellipse').forEach(el => {
                el.style.fill = '';
                el.style.fillOpacity = '';
            });
        }
    });

    // 2. Apply Status Toggles (Hatch Patterns)
    if (statusToggles.onhand || statusToggles.stok) {
        console.log('🎨 Applying status hatches...', statusToggles);
        let countOnHand = 0;
        let countStok = 0;

        const foundCategories = new Set();
        const missingIds = [];
        kavlingStatusIndex.forEach((item, kode) => {
            const group = svg.getElementById(kode);
            const kategori = (item.kategori || '').toUpperCase().trim();
            const skema = (item.skema_pembiayaan || '').toUpperCase().trim();
            foundCategories.add(kategori);

            // Check for various forms of "ON HAND" to be safe
            const isOnHands = (
                kategori === 'ON_HAND' || kategori === 'ON HAND' || kategori === 'ONHAND' || kategori === 'ON-HAND' ||
                skema === 'ON_HAND' || skema === 'ON HAND' || skema === 'ONHAND' || skema === 'ON-HAND'
            );
            const isStok = (kategori === 'STOK' || kategori === 'STOCK');

            if (!group) {
                if (isOnHands || isStok) {
                    missingIds.push(kode);
                }
                return;
            }

            let fillValue = null;
            
            if (statusToggles.onhand && isOnHands) {
                fillValue = 'url(#pattern-onhand)';
                countOnHand++;
            } else if (statusToggles.stok && isStok) {
                fillValue = 'url(#pattern-stok)';
                countStok++;
            }

            if (fillValue) {
                group.style.fill = fillValue;
                group.querySelectorAll('path, rect, polygon, circle, ellipse').forEach(el => {
                    el.style.fill = fillValue;
                    el.style.fillOpacity = '1';
                });
            }
        });
        console.log('📑 Unique categories in data:', Array.from(foundCategories));
        if (missingIds.length > 0) {
            console.warn(`⚠️ ${missingIds.length} IDs with status not found in SVG:`, missingIds.slice(0, 10), missingIds.length > 10 ? '...' : '');
        }
        console.log(`📊 Hatch results: ON_HAND: ${countOnHand}, STOK: ${countStok}`);
    }

    // 3. Apply Custom Colorings (later ones override earlier ones)
    appliedColorings.forEach(item => {
        item.kavlings.forEach(kavId => {
            const group = svg.getElementById(kavId);
            if (group) {
                group.style.fill = item.color;
                group.querySelectorAll('path, rect, polygon, circle, ellipse').forEach(el => {
                    el.style.fill = item.color;
                    el.style.fillOpacity = '1';
                });
            }
        });
    });
}

/**
 * Initialize download feature
 */
function initDownload() {
    const btn = document.getElementById('downloadMapBtn');
    btn.addEventListener('click', async () => {
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Mengolah PDF...';

        try {
            const mapArea = document.querySelector('.map-area');
            
            // Capture the map area
            const canvas = await html2canvas(mapArea, {
                scale: 3, // High quality
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            
            const orientation = canvas.width > canvas.height ? 'l' : 'p';
            const pdf = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: 'a3',
                compress: false
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
            const finalWidth = canvas.width * ratio;
            const finalHeight = canvas.height * ratio;
            
            const x = (pdfWidth - finalWidth) / 2;
            const y = (pdfHeight - finalHeight) / 2;

            pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'SLOW');
            
            // Add Title
            pdf.setFontSize(16);
            pdf.text('SITEMAP BTU KNC REPORT', 10, 15);
            
            // Add Timestamp
            pdf.setFontSize(10);
            pdf.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 10, 22);
            
            const dateStr = new Date().toISOString().split('T')[0];
            pdf.save(`Sitemap_Report_BTU_${dateStr}.pdf`);
            
            btn.innerHTML = '<span>✅</span> Selesai!';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('❌ Download error:', error);
            alert('Gagal mendownload peta.');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}
