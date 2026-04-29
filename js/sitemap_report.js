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
let svgElementMap = new Map(); // Normalized ID -> actual SVG element
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 jam

// Progress State
let dbProgress = {
    status: 0, // 0-50
    cert: 0    // 0-50
};

// Color Filter State
let allKavlingIds = [];
let allKavlingNormalizedIds = [];
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
            
            // Move patterns from external SVG to this SVG so they are available for download/rendering
            const externalDefs = document.querySelector('svg defs');
            if (externalDefs) {
                const clonedDefs = externalDefs.cloneNode(true);
                svg.insertBefore(clonedDefs, svg.firstChild);
                console.log('✅ Patterns injected into main SVG');
            }

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
                
                svgElementMap.clear();
                allKavlingIds = [];
                allKavlingNormalizedIds = [];

                groups.forEach(g => {
                    const originalId = g.id.trim();
                    const normalizedId = originalId.toUpperCase().replace(/[-_]/g, '');
                    
                    allKavlingIds.push(originalId);
                    allKavlingNormalizedIds.push(normalizedId);
                    
                    // Map normalized ID to the actual group element
                    svgElementMap.set(normalizedId, g);
                });

                // Remove duplicates from lists
                allKavlingIds = [...new Set(allKavlingIds)];
                allKavlingNormalizedIds = [...new Set(allKavlingNormalizedIds)];

                console.log(`✅ ${allKavlingIds.length} ID kavling (${allKavlingNormalizedIds.length} unik normalized) ditemukan`);
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
 * Update Database Loading Progress Bar
 */
function updateDBProgress(type, value) {
    if (type === 'status') dbProgress.status = value;
    if (type === 'cert') dbProgress.cert = value;

    const totalProgress = dbProgress.status + dbProgress.cert;
    const progressBar = document.getElementById('dbProgressBar');
    const progressText = document.getElementById('dbProgressText');

    if (progressBar) progressBar.style.width = totalProgress + '%';
    if (progressText) progressText.textContent = totalProgress + '%';

    if (totalProgress >= 100) {
        setTimeout(() => {
            const container = document.getElementById('dbLoadingContainer');
            if (container) {
                container.style.border = '1px solid #4CAF50';
                container.style.background = '#e8f5e9';
                if (progressText) progressText.innerHTML = '✅ Loaded';
            }
        }, 500);
    }
}

/**
 * Data Preloading Functions
 */
async function preloadKavlingStatusData() {
    console.log('📦 Memulai preload status kavling...');
    updateDBProgress('status', 10); // Start progress

    try {
        // Gunakan key yang sama dengan index.html agar berbagi cache
        const CACHE_KEY = 'kavlingStatusData';
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                // Cache 10 menit (sama dengan script.js)
                if (Date.now() - parsed.timestamp < 10 * 60 * 1000) { 
                    if (parsed.data && Array.isArray(parsed.data.data)) {
                        parsed.data.data.forEach(item => {
                            if (item.kode) {
                                // Add IMB detection logic here so it's available in the index
                                const raw = item.rawData || [];
                                let hasImb = typeof item.hasImb === 'boolean' ? item.hasImb : null;
                                if (hasImb === null && raw.length > 31) {
                                    const noImbStr = String(raw[31] || '').trim();
                                    const lower = noImbStr.toLowerCase();
                                    hasImb = noImbStr !== '' && noImbStr !== '-' && !lower.includes('belum') && !lower.includes('[belum memiliki]');
                                }
                                item.hasImbEffective = hasImb;
                                kavlingStatusIndex.set(item.kode.toUpperCase(), item);
                            }
                        });
                        console.log('⚡ Menggunakan cache status kavling (Shared with index.html)');
                        updateDBProgress('status', 50);
                        return;
                    }
                }
            } catch (e) {
                console.warn('⚠️ Gagal parse cache:', e);
            }
        }

        // Jika tidak ada cache atau expired, ambil dari API
        const url = `${API_URL}?action=status&_t=${Date.now()}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.data) {
            data.data.forEach(item => {
                if (item.kode) {
                    const raw = item.rawData || [];
                    let hasImb = typeof item.hasImb === 'boolean' ? item.hasImb : null;
                    if (hasImb === null && raw.length > 31) {
                        const noImbStr = String(raw[31] || '').trim();
                        const lower = noImbStr.toLowerCase();
                        hasImb = noImbStr !== '' && noImbStr !== '-' && !lower.includes('belum') && !lower.includes('[belum memiliki]');
                    }
                    item.hasImbEffective = hasImb;
                    kavlingStatusIndex.set(item.kode.toUpperCase(), item);
                }
            });

            // Simpan ke cache (format sama dengan script.js)
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
            
            console.log('✅ Status data preloaded from API and cached');
            updateDBProgress('status', 50);
            
            // Re-apply colors if any toggles are already on
            if (statusToggles.onhand || statusToggles.stok) {
                updateSVGColors();
            }
        }
    } catch (e) {
        console.warn('⚠️ Gagal preload status:', e);
        updateDBProgress('status', 0); // Fail
    }
}

async function loadFullCertificateDatabase() {
    console.log('📦 Memulai preload cert db...');
    updateDBProgress('cert', 5);

    const CACHE_KEY = 'fullCertDatabaseCache';
    const CACHE_DURATION = 15 * 60 * 1000; // 15 menit

    try {
        // 1. Cek LocalStorage (Shared with index.html)
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const age = Date.now() - parsed.timestamp;
                if (age < CACHE_DURATION && Array.isArray(parsed.data)) {
                    console.log(`⚡ Menggunakan cache database sertifikat (Shared with index.html)`);
                    parsed.data.forEach(row => {
                        const rawKey = row[0] || '';
                        if (rawKey) {
                            const key = normalizeCertId(rawKey);
                            certificateDB.set(key, {
                                nomor: rawKey,
                                data: row[34] || '', // Kolom AI (indeks 34)
                                fullData: row
                            });
                        }
                    });
                    updateDBProgress('cert', 50);
                    return;
                }
            } catch (e) {
                console.warn('⚠️ Gagal parse cache database:', e);
                localStorage.removeItem(CACHE_KEY);
            }
        }

        // 2. Jika tidak ada cache, ambil dari API
        const url = `${CERT_API_URL}?action=get_all&_t=${Date.now()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Network response was not ok');
        
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.data)) {
            data.data.forEach(row => {
                const rawKey = row[0] || '';
                if (rawKey) {
                    const key = normalizeCertId(rawKey);
                    certificateDB.set(key, {
                        nomor: rawKey,
                        data: row[34] || '', // Kolom AI (indeks 34)
                        fullData: row
                    });
                }
            });

            // Simpan ke cache
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: data.data
            }));

            console.log('✅ Cert database preloaded and cached');
            updateDBProgress('cert', 50);
        } else {
            throw new Error(data.message || 'Unknown error from API');
        }
    } catch (e) {
        console.warn('⚠️ Gagal preload cert db:', e.message);
        // Fallback to empty if it fails but still allow the UI to finish
        updateDBProgress('cert', 50); 
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

    // Handle paste for automatic comma separation
    kavlingInput.addEventListener('paste', (e) => {
        // Stop default paste to handle it manually
        e.preventDefault();
        
        // Get pasted data via clipboard API
        const pastedData = (e.clipboardData || window.clipboardData).getData('text');
        console.log('📋 Data di-paste (raw):', pastedData);
        
        if (pastedData) {
            // Split by any whitespace (newline, tab, space) or comma
            const cleanedKavlings = pastedData.split(/[\s,]+/)
                                           .map(s => s.trim())
                                           .filter(s => s !== '')
                                           .join(', ');
            
            console.log(`✅ Berhasil memproses ${cleanedKavlings.split(',').length} kavling.`);
            
            // If the input already has content, append with a comma
            const currentVal = kavlingInput.value.trim();
            let newVal = '';
            
            if (currentVal) {
                const separator = currentVal.endsWith(',') ? ' ' : (currentVal.endsWith(', ') ? '' : ', ');
                newVal = currentVal + separator + cleanedKavlings;
            } else {
                newVal = cleanedKavlings;
            }
            
            kavlingInput.value = newVal;
            
            // Trigger input event to notify other listeners (like autocomplete)
            kavlingInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

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
            colorName: colorName,
            matchedCount: 0 // Will be updated during updateSVGColors
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
            <div class="applied-item-info">
                <span class="kavling-names" title="${item.kavlings.join(', ')}">${item.kavlings.join(', ')}</span>
                <span class="matched-count">(${item.matchedCount || 0} Kavling)</span>
            </div>
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

    // Regex to identify text paths (e.g., "119", "131_5", "2_2")
    // This avoids matching "Vector_3", "Rectangle_1", etc.
    const isTextId = (id) => id && /^\d+(_\d+)*$/.test(id);
    // Helper to check if element should be colored (Vector or Rectangle)
    const shouldColor = (el) => {
        const id = el.id || '';
        const tagName = el.tagName.toLowerCase();
        // Only color if it's a Vector or Rectangle path/rect
        return (id.includes('Vector') || id.includes('Rectangle') || id.includes('Union')) && !isTextId(id);
    };

    // 1. Reset all colors first
    svgElementMap.forEach((group, normalizedId) => {
        group.style.fill = '';
        group.style.fillOpacity = '';
        group.querySelectorAll('path, rect, polygon, circle, ellipse').forEach(el => {
            const id = el.id || '';
            const isText = /^\d+(_\d+)*$/.test(id);
            if (!isText) {
                el.style.fill = '';
                el.style.fillOpacity = '';
            }
        });
    });

    // 2. Apply Status Toggles (Hatch Patterns)
    if (statusToggles.onhand || statusToggles.stok) {
        console.log('🎨 Applying status hatches...', statusToggles);
        let countOnHandMatched = 0;
        let countStokMatched = 0;
        let countOnHandDetectedInData = 0;
        let countStokDetectedInData = 0;

        const missingIds = [];
        
        kavlingStatusIndex.forEach((item, kode) => {
            if (!kode) return;

            const raw = item.rawData || [];
            
            // Normalize kode for matching (e.g. "GA-1" -> "GA1")
            const normalizedKode = kode.toUpperCase().replace(/[-_]/g, '');
            
            // SEARCH FOR ELEMENT (Same logic as index colorizeKavling)
            let group = svgElementMap.get(normalizedKode);
            
            if (!group) {
                // Last resort search in DOM if map missed it
                const el = document.getElementById(kode.toUpperCase());
                if (el) {
                    group = el;
                    svgElementMap.set(normalizedKode, el);
                }
            }

            // 1. Deteksi ON HAND (Berdasarkan Kolom Skema Pembiayaan (K) - Index 10)
            const skemaPembiayaan = raw.length > 10 ? String(raw[10] || '').trim().toUpperCase() : '';
            const isOnHand = skemaPembiayaan.includes('ON HAND') || skemaPembiayaan.includes('ON_HAND') || skemaPembiayaan.includes('ON-HAND');

            // 2. Deteksi STOK (Berdasarkan Kolom Skema Penjualan (I) - Index 8)
            let kategori = (item.kategori || 'unknown').toLowerCase();
            const skemaText = (item.skema || '').toString().toUpperCase();
            
            if (kategori === 'unknown' && skemaText) {
                if (skemaText.includes('STOK')) {
                    kategori = 'stok';
                }
            }
            const isStok = (kategori === 'stok' || skemaText.includes('STOK'));

            if (isOnHand) countOnHandDetectedInData++;
            if (isStok) countStokDetectedInData++;

            if (!group) {
                if ((statusToggles.onhand && isOnHand) || (statusToggles.stok && isStok)) {
                    missingIds.push(kode);
                }
                return;
            }

            // 3. Deteksi IMB (Sesuai logic script.js)
            const hasImb = item.hasImbEffective;

            let fillValue = null;
            
            // Prioritas ON HAND jika kedua toggle aktif
            if (statusToggles.onhand && isOnHand) {
                // Pilih pattern berdasarkan IMB
                fillValue = hasImb ? 'url(#pattern-onhand)' : 'url(#pattern-onhand-noimb)';
                countOnHandMatched++;
            } else if (statusToggles.stok && isStok) {
                // Pilih pattern berdasarkan IMB
                fillValue = hasImb ? 'url(#pattern-stok)' : 'url(#pattern-stok-noimb)';
                countStokMatched++;
            }

            if (fillValue) {
                // If it's a group, color the appropriate children
                if (group.tagName.toLowerCase() === 'g') {
                    group.querySelectorAll('path, rect, polygon, circle, ellipse').forEach(el => {
                        const id = el.id || '';
                        const isText = /^\d+(_\d+)*$/.test(id);
                        if (!isText) {
                            el.style.fill = fillValue;
                            el.style.fillOpacity = '1';
                        }
                    });
                } else {
                    // If it's a single element, color it directly
                    group.style.fill = fillValue;
                    group.style.fillOpacity = '1';
                }
            }
        });

        if (missingIds.length > 0) {
            console.warn(`⚠️ ${missingIds.length} IDs with status not found in SVG map:`, missingIds.slice(0, 10), missingIds.length > 10 ? '...' : '');
        }
        
        // Update the count badges in the UI
        const countOnHandEl = document.getElementById('countOnHand');
        const countStokEl = document.getElementById('countStok');
        if (countOnHandEl) countOnHandEl.textContent = countOnHandMatched;
        if (countStokEl) countStokEl.textContent = countStokMatched;

        console.log(`📊 Data Analysis: ON_HAND in Data: ${countOnHandDetectedInData}, STOK in Data: ${countStokDetectedInData}`);
        console.log(`🎨 Coloring Results: ON_HAND Colored: ${countOnHandMatched}, STOK Colored: ${countStokMatched}`);
    } else {
        // Reset counts if toggles are off
        const countOnHandEl = document.getElementById('countOnHand');
        const countStokEl = document.getElementById('countStok');
        if (countOnHandEl) countOnHandEl.textContent = '0';
        if (countStokEl) countStokEl.textContent = '0';
    }

    // 3. Apply Custom Colorings (later ones override earlier ones)
    appliedColorings.forEach(item => {
        let currentMatchedCount = 0;
        item.kavlings.forEach(kavId => {
            const normalizedKavId = kavId.toUpperCase().replace(/[-_]/g, '');
            let group = svgElementMap.get(normalizedKavId);
            
            // Last resort search in DOM if map missed it
            if (!group) {
                const el = document.getElementById(kavId.toUpperCase());
                if (el) {
                    group = el;
                    svgElementMap.set(normalizedKavId, el);
                }
            }

            if (group) {
                currentMatchedCount++;
                if (group.tagName.toLowerCase() === 'g') {
                    group.querySelectorAll('path, rect, polygon, circle, ellipse').forEach(el => {
                        // Check if it's a valid part of the kavling (vector/rectangle)
                        const id = el.id || '';
                        const isText = /^\d+(_\d+)*$/.test(id);
                        if (!isText) {
                            el.style.fill = item.color;
                            el.style.fillOpacity = '1';
                        }
                    });
                } else {
                    group.style.fill = item.color;
                    group.style.fillOpacity = '1';
                }
            }
        });
        // Update the count for the UI
        item.matchedCount = currentMatchedCount;
    });

    // 4. Update UI list to show counts
    renderAppliedColorsList();
}

/**
 * Initialize download feature
 */
function initDownload() {
    const btn = document.getElementById('downloadMapBtn');
    btn.addEventListener('click', async () => {
        const originalText = btn.innerHTML;
        const svg = document.getElementById('sitemap-svg');
        
        if (!svg) {
            alert('Peta belum dimuat sempurna.');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Mengolah PDF...';

        try {
            // 1. Persiapkan Canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Ambil dimensi asli SVG atau viewBox
            const viewBox = svg.viewBox.baseVal;
            const width = viewBox.width || svg.width.baseVal.value || 11703;
            const height = viewBox.height || svg.height.baseVal.value || 16003;
            
            // Set resolusi tinggi untuk PDF (Scale factor)
            const scale = 0.5; // Resolusi tinggi tapi tidak membuat browser crash (SVG asli sangat besar)
            canvas.width = width * scale;
            canvas.height = height * scale;
            
            // 2. Serialize SVG ke XML
            const serializer = new XMLSerializer();
            let svgData = serializer.serializeToString(svg);
            
            // Pastikan namespace ada
            if(!svgData.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
                svgData = svgData.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
            }
            if(!svgData.match(/^<svg[^>]+xmlns\:xlink="http\:\/\/www\.w3\.org\/1999\/xlink"/)){
                svgData = svgData.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
            }

            // 3. Render ke Image lalu ke Canvas
            const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);
            
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });

            // Gambar ke canvas dengan background putih
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            URL.revokeObjectURL(url);

            // 4. Buat PDF (A3 Landscape)
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'l', // Force Landscape
                unit: 'mm',
                format: 'a3'
            });
            
            const pdfWidth = 420; // A3 Landscape Width
            const pdfHeight = 297; // A3 Landscape Height
            const imgData = canvas.toDataURL('image/jpeg', 0.9); // Higher quality
            
            // Calculate scaling to fit the image on A3 Landscape
            // We want to capture exactly what is on screen
            const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
            const finalWidth = canvas.width * ratio;
            const finalHeight = canvas.height * ratio;
            
            // Center the image
            const x = (pdfWidth - finalWidth) / 2;
            const y = (pdfHeight - finalHeight) / 2;

            pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight, undefined, 'FAST');
            
            // Add Header Info (Boxed for visibility)
            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(pdfWidth - 110, 5, 105, 25, 'FD'); // Move to top right to avoid covering map center
            
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(14);
            pdf.text('SITEMAP BTU KNC REPORT', pdfWidth - 105, 15);
            pdf.setFontSize(9);
            pdf.text(`Status: ${statusToggles.onhand ? 'ON_HAND Active' : ''} ${statusToggles.stok ? 'STOK Active' : ''}`, pdfWidth - 105, 20);
            pdf.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, pdfWidth - 105, 25);
            
            const dateStr = new Date().toISOString().split('T')[0];
            pdf.save(`Sitemap_Report_BTU_${dateStr}.pdf`);
            
            btn.innerHTML = '<span>✅</span> Selesai!';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('❌ Download error:', error);
            alert('Gagal mendownload peta: ' + error.message);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}
