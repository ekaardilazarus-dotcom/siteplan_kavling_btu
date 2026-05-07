document.addEventListener('DOMContentLoaded', () => {
  const CERT_API_URL = 'https://script.google.com/macros/s/AKfycbxuAe7llIpc3SxGAhJ-d_HHYa4Ut9z-nHj8MVUGx4-_Qo7W5mwSLHEKStifg4MRD5Nofg/exec';
  const mapEl = document.getElementById('cert-map');
  const loader = mapEl.querySelector('.smap-loading');
  const DB_CACHE_KEY = 'fullCertDatabaseCache';
  const DB_CACHE_DURATION = 15 * 60 * 1000; // 15 menit
  let svgCache = null;
  let originalViewBox = null;
  let viewBoxState = { x: 0, y: 0, w: 1000, h: 1000 };
  let isPanning = false;
  let isDragging = false;
  let panStart = { x: 0, y: 0 };
  let lastPanTime = 0;
  let lastWheelTime = 0;
  const PAN_THROTTLE_MS = 16;
  const WHEEL_THROTTLE_MS = 30;
  let certBankRows = [];
  let certShapes = [];
  let activeBankFilter = null;
  let activeCategory = null; // null, 'bank', atau 'recipient'
  let selectedBanks = new Set();
  let selectedGZ = new Set();
  let selectedRecipients = new Set();
  let certIndexByKey = new Map();
  let groupIndexByKey = new Map();
  let duplicateDBKeys = new Set();

  const parseViewBox = (vb) => {
    const p = vb.split(/\s+/).map(Number);
    return { x: p[0], y: p[1], w: p[2], h: p[3] };
  };
  const applyViewBox = (svg) => {
    svg.setAttribute('viewBox', `${viewBoxState.x} ${viewBoxState.y} ${viewBoxState.w} ${viewBoxState.h}`);
  };

  const setupSVG = () => {
    const svg = mapEl.querySelector('svg');
    if (!svg) return;
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    originalViewBox = svg.getAttribute('viewBox');
    if (!originalViewBox) {
      const b = svg.getBBox();
      originalViewBox = `${b.x} ${b.y} ${b.width} ${b.height}`;
      svg.setAttribute('viewBox', originalViewBox);
    }
    const base = parseViewBox(originalViewBox);
    const zoomFactor = 0.1;
    const newW = base.w * zoomFactor;
    const newH = base.h * zoomFactor;
    const newX = base.x + (base.w - newW) / 2;
    const newY = base.y + (base.h - newH) / 2;
    viewBoxState = { x: newX, y: newY, w: newW, h: newH };
    applyViewBox(svg);
  };

  const normalizeCertId = (raw) => {
    if (!raw) return '';
    // Hapus keterangan dalam kurung jika ada (misal: B.4597 (Bukopin) -> B.4597)
    let text = String(raw).split('(')[0].trim();
    return text
      .toUpperCase()
      .replace(/SHGB|SHM/g, '') // Hapus kata kunci SHGB atau SHM
      .replace(/[\s\-_./]/g, '') // Hapus spasi, strip, underscore, titik, slash
      .replace(/^([A-Z])0+/, '$1') // Hapus leading zeros setelah satu huruf (misal: B04597 -> B4597)
      .replace(/^0+/, '') // Hapus leading zeros di depan angka jika tidak ada huruf
      .trim();
  };

  const normalizeBank = (raw) => {
    if (!raw) return 'LAINNYA';
    const text = String(raw).toUpperCase();
    if (text.includes('UMM')) return 'UMM';
    if (text.includes('UNISMA')) return 'UNISMA';
    if (text.includes('ABC')) return 'ABC';
    if (text.includes('BTN')) return 'BTN';
    if (text.includes('BUKOPIN')) return 'BUKOPIN';
    if (text.includes('MANDIRI')) return 'MANDIRI';
    if (text.includes('PSU')) return 'PSU';
    return 'LAINNYA';
  };

  const getBankColor = (bankKey) => {
    switch (bankKey) {
      case 'UMM':
        return 'rgba(128,0,0,0.6)';
      case 'UNISMA':
        return 'rgba(0,100,0,0.6)';
      case 'ABC':
        return 'rgba(128,0,128,0.6)';
      case 'BTN':
        return 'rgba(33,150,243,0.6)';
      case 'BUKOPIN':
        return 'rgba(255,235,59,0.6)';
      case 'MANDIRI':
        return 'rgba(13,71,161,0.6)';
      case 'PSU':
        return 'url(#psuHatch)';
      case 'LAINNYA':
        // Kategori LAINNYA tidak diwarnai (biarkan warna default SVG)
        return null;
      default:
        return null;
    }
  };

  const getRecipientColor = (recipientKey) => {
    switch (recipientKey) {
      case 'NOTARIS': return 'rgba(233,30,99,0.6)';
      case 'BTN': return 'rgba(33,150,243,0.6)';
      case 'ASABRI': return 'rgba(32, 104, 34, 0.6)';
      case 'BUKOPIN': return 'rgba(255,235,59,0.6)';
      case 'USER': return 'rgba(255, 0, 0, 0.6)';
      case 'MANDIRI': return 'rgba(13,71,161,0.6)';
      case 'PT GA': return 'rgba(156,39,176,0.6)';
      case 'BPN': return 'rgba(161, 110, 92, 0.6)';
      case 'KOSONG': return 'rgba(144,238,144,0.6)'; // Hijau muda
      default: return null;
    }
  };

  const normalizeRecipient = (raw) => {
    if (!raw) return 'KOSONG';
    const text = String(raw).toUpperCase().trim();
    if (text === '' || text === '-') return 'KOSONG';
    if (text.includes('NOTARIS')) return 'NOTARIS';
    if (text.includes('BTN')) return 'BTN';
    if (text.includes('ASABRI')) return 'ASABRI';
    if (text.includes('BUKOPIN')) return 'BUKOPIN';
    if (text.includes('USER')) return 'USER';
    if (text.includes('MANDIRI')) return 'MANDIRI';
    if (text.includes('PT GA')) return 'PT GA';
    if (text.includes('BPN')) return 'BPN';
    return text;
  };


  const getGZTag = (aiText) => {
    if (!aiText) return '';
    const t = String(aiText).toUpperCase();
    if (t.includes('GZ#1') || t.includes('GZ1')) return 'GZ1';
    if (t.includes('GZ#2') || t.includes('GZ2')) return 'GZ2';
    if (t.includes('GZ#3') || t.includes('GZ3')) return 'GZ3';
    return '';
  };

  const getGZColor = (tag) => {
    switch (tag) {
      case 'GZ1': return 'rgba(255,165,0,0.8)';      // Orange
      case 'GZ2': return 'rgba(255,185,60,0.8)';     // Orange lebih terang
      case 'GZ3': return 'rgba(255,205,110,0.8)';    // Orange sangat terang
      default: return null;
    }
  };

  const ensurePatterns = (svg) => {
    if (!svg) return;
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    if (!svg.querySelector('#psuHatch')) {
      const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
      pattern.setAttribute('id', 'psuHatch');
      pattern.setAttribute('patternUnits', 'userSpaceOnUse');
      pattern.setAttribute('width', '4');
      pattern.setAttribute('height', '4');

      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', '4');
      bg.setAttribute('height', '4');
      bg.setAttribute('fill', '#ffffff');
      bg.setAttribute('opacity', '1');

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line1.setAttribute('d', 'M0,4 L4,0');
      line1.setAttribute('stroke', '#b71c1c');
      line1.setAttribute('stroke-width', '0.9');
      line1.setAttribute('opacity', '0.75');

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line2.setAttribute('d', 'M-2,4 L2,0');
      line2.setAttribute('stroke', '#b71c1c');
      line2.setAttribute('stroke-width', '0.9');
      line2.setAttribute('opacity', '0.75');

      pattern.appendChild(bg);
      pattern.appendChild(line1);
      pattern.appendChild(line2);
      defs.appendChild(pattern);
    }
  };

  const buildCertIndex = () => {
    certIndexByKey = new Map();
    duplicateDBKeys = new Set();
    const counts = new Map();
    certBankRows.forEach(item => {
      const fullData = Array.isArray(item.fullData) ? item.fullData : [];
      const nomor = String(item.nomor || fullData[0] || '').trim();
      const key = normalizeCertId(nomor);
      if (key) {
        certIndexByKey.set(key, item);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    counts.forEach((cnt, k) => {
      if (cnt > 1) duplicateDBKeys.add(k);
    });
  };

  const loadCertBankData = async () => {
    if (certBankRows.length) return certBankRows;
    try {
      const cachedRaw = localStorage.getItem(DB_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && Array.isArray(cached.data) && cached.timestamp && Date.now() - cached.timestamp < DB_CACHE_DURATION) {
          console.log('♻️ Memuat database sertifikat dari cache bersama (Shared Cache)');
          certBankRows = cached.data;
          buildCertIndex();
          return certBankRows;
        }
      }
    } catch (e) {
      console.warn('Failed to load cert map cache', e);
    }

    console.log('⏳ Memuat seluruh database sertifikat...');
    const res = await fetch(`${CERT_API_URL}?action=get_all&_t=${Date.now()}`);
    const json = await res.json();
    if (json && json.status === 'success' && Array.isArray(json.results)) {
      certBankRows = json.results;
      buildCertIndex();
      try {
        localStorage.setItem(DB_CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: certBankRows
        }));
      } catch (e) {
        console.warn('Failed to save cert map cache', e);
      }
      return certBankRows;
    }

    certBankRows = [];
    return certBankRows;
  };

  const applyBankFilter = () => {
    if (!certShapes.length) return;
    certShapes.forEach(el => {
      const bankKey = el.dataset.bank || 'LAINNYA';
      if (!activeBankFilter || bankKey === activeBankFilter) {
        el.style.opacity = '1';
      } else {
        el.style.opacity = '0.15';
      }
    });
  };

  const setupBankFilterButtons = () => {
    const buttons = Array.from(document.querySelectorAll('.smap-btn[data-bank]'));
    if (!buttons.length) return;

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const bankKey = btn.dataset.bank;
        if (!bankKey) return;

        if (activeBankFilter === bankKey) {
          activeBankFilter = null;
          buttons.forEach(b => b.classList.remove('active'));
        } else {
          activeBankFilter = bankKey;
          buttons.forEach(b => b.classList.toggle('active', b === btn));
        }

        applyBankFilter();
      });
    });
  };

  const isGenericId = (id) => {
    if (!id) return true;
    const t = id.toLowerCase();
    return t.includes('vector') || t.includes('rectangle') || t.includes('path') || 
           t.includes('group') || t.includes('layer') || t.includes('frame') ||
           t.includes('text') || t.includes('image') || t.includes('clip');
  };

  const colorizeSertifikatMap = () => {
    const svg = mapEl.querySelector('svg');
    if (!svg || !certBankRows.length || !certIndexByKey.size) return;
    ensurePatterns(svg);

    const rootGroup = svg.querySelector('#sertifikatbtu') || svg;
    // Kumpulkan semua group yang memiliki ID dan bukan ID generik
    const groups = Array.from(rootGroup.querySelectorAll('g'))
      .filter(g => g.id && g.id !== 'sertifikatbtu' && !isGenericId(g.id));

    // Sort groups agar yang paling "dangkal" (parent) diproses pertama
    const getDepth = (el) => {
      let depth = 0;
      while (el.parentNode) { depth++; el = el.parentNode; }
      return depth;
    };
    groups.sort((a, b) => getDepth(a) - getDepth(b));

    groupIndexByKey = new Map();
    certShapes = [];
    const claimedShapes = new Set();

    const isTextOutline = (el) => {
      const rawFill = (el.getAttribute('fill') || el.style.fill || '').toLowerCase();
      const rawStroke = (el.getAttribute('stroke') || el.style.stroke || '').toLowerCase();
      const swRaw = el.getAttribute('stroke-width') || el.style.strokeWidth || '0';
      const sw = parseFloat(swRaw) || 0;
      const isBlack = rawFill === 'black' || rawFill === '#000' || rawFill === '#000000';
      const hasStroke = rawStroke && rawStroke !== 'none' && sw > 0.05;
      return isBlack && !hasStroke;
    };

    groups.forEach(group => {
      const key = normalizeCertId(group.id);
      if (!key) return;

      // Ambil semua elemen bentuk di dalam grup ini
      const allShapes = Array.from(group.querySelectorAll('path, polygon, rect, circle, ellipse'));
      if (!allShapes.length) return;
      
      // Hitung luas dan rasio setiap bentuk untuk menemukan "bidang tanah" utama
      const shapeAreas = allShapes.map(el => {
        try {
          const bbox = el.getBBox();
          const area = bbox.width * bbox.height;
          const ratio = (bbox.width > 0 && bbox.height > 0) ? Math.min(bbox.width, bbox.height) / Math.max(bbox.width, bbox.height) : 0;
          return { el, area, ratio };
        } catch (_) {
          return { el, area: 0, ratio: 0 };
        }
      });

      const maxArea = Math.max(...shapeAreas.map(s => s.area), 0);
      
      // Pilih bentuk yang memiliki rasio cukup "kotak" (bukan garis/teks tipis)
      // atau termasuk klaster terbesar (>= 60% dari max area)
      const shapes = shapeAreas
        .filter(s => s.area > 0 && (s.ratio >= 0.12 || s.area >= maxArea * 0.6))
        .map(s => s.el)
        // Buang path outline tulisan (fill hitam, tanpa stroke)
        .filter(el => !isTextOutline(el))
        // Buang yang sudah diklaim oleh group parent
        .filter(el => !claimedShapes.has(el));

      if (!shapes.length) return;

      // Tandai sebagai diklaim agar tidak diambil grup anak
      shapes.forEach(el => claimedShapes.add(el));

      // Tandai target pewarnaan
      allShapes.forEach(s => s.removeAttribute('data-fill-target'));
      shapes.forEach(s => s.setAttribute('data-fill-target', '1'));

      groupIndexByKey.set(key, { group, shapes });
      certShapes.push(...shapes);
    });

    const coloredKeys = new Set();
    certIndexByKey.forEach((item, key) => {
      const mapping = groupIndexByKey.get(key);
      if (!mapping) return;
      coloredKeys.add(key);
      const shapes = mapping.shapes;
      const fullData = Array.isArray(item.fullData) ? item.fullData : [];
      const rawBank = fullData[16] || '';
      const rawRecipient = fullData[21] || ''; // Kolom V (index 21)
      const aiValue = fullData[34] || '';
      const bankKey = normalizeBank(rawBank);
      const recipientKey = normalizeRecipient(rawRecipient);
      const gzTag = getGZTag(aiValue);
      const nomor = String(item.nomor || fullData[0] || '').trim();

      shapes.forEach(el => {
        el.dataset.bank = bankKey;
        el.dataset.recipient = recipientKey;
        el.dataset.recipientFull = rawRecipient;
        el.dataset.groupId = (mapping.group && mapping.group.id) ? mapping.group.id : '';
        el.dataset.ai = String(aiValue || '');
        el.dataset.nomor = nomor;
        el.dataset.key = key;
        if (gzTag) el.dataset.gz = gzTag; else delete el.dataset.gz;

        // Default coloring based on active category
        if (activeCategory === 'bank') {
          const color = getBankColor(bankKey);
          if (color) el.style.fill = color; else el.style.fill = '#ffffff';
        } else if (activeCategory === 'recipient') {
          const color = getRecipientColor(recipientKey);
          if (color) el.style.fill = color; else el.style.fill = '#ffffff';
        } else {
          el.style.fill = '#ffffff';
        }
        
        el.style.removeProperty('stroke');
        el.style.removeProperty('stroke-width');
        // Tandai duplikasi database dengan garis hijau kecil
        if (duplicateDBKeys && duplicateDBKeys.has(key)) {
          el.dataset.duplicate = '1';
          el.style.stroke = '#2e7d32';
          el.style.strokeWidth = '0.6';
          el.style.strokeDasharray = '2 2';
        }
      });
      // Pastikan teks di dalam grup tetap hitam dan tidak memiliki stroke
      const texts = mapping.group.querySelectorAll('text');
      texts.forEach(t => {
        t.style.fill = '#000';
        t.style.stroke = 'none';
        try {
          // Pastikan teks berada di atas bidang (DOM order terakhir)
          mapping.group.appendChild(t);
        } catch (_) {}
      });
    });

    // Warnai abu-abu muda untuk ID yang ada di SVG tapi tidak ada di database
    // (Bukan hitam agar tidak tertukar dengan outline teks)
    groupIndexByKey.forEach((mapping, key) => {
      if (coloredKeys.has(key)) return;
      const shapes = mapping.shapes || [];
      shapes.forEach(el => {
        el.dataset.missing = '1';
        el.dataset.key = key;
        el.dataset.nomor = mapping.group && mapping.group.id ? mapping.group.id : key;
        el.style.fill = '#eeeeee'; // Abu-abu sangat muda
        el.style.stroke = '#cccccc'; // Garis tepi abu-abu
        el.style.strokeWidth = '0.5';
      });
      const texts = mapping.group.querySelectorAll('text');
      texts.forEach(t => {
        t.style.fill = '#000';
        t.style.stroke = 'none';
        try { mapping.group.appendChild(t); } catch (_) {}
      });
    });

    applyFilters();
  };

  const initCertMapColors = async () => {
    const svg = mapEl.querySelector('svg');
    if (!svg) return;

    const overlay = document.createElement('div');
    overlay.className = 'smap-loading';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(255,255,255,0.85)';
    overlay.innerHTML = `
      <div class="smap-spinner"></div>
      <div>Mewarnai peta sertifikat...</div>
    `;
    mapEl.appendChild(overlay);

    try {
      await loadCertBankData();
      colorizeSertifikatMap();
      setupFilterCheckboxes();
      setupQuickSearch();
    } catch (e) {
      console.error('Gagal mewarnai peta sertifikat', e);
    } finally {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  };

  const loadSVG = async () => {
    try {
      if (loader) loader.style.display = 'flex';
      const res = await fetch('sertifikatbtu.svg', { cache: 'default' });
      const text = await res.text();
      svgCache = text;
      mapEl.innerHTML = text;
      setupSVG();
    } catch (e) {
      mapEl.innerHTML = '<div style="padding:20px; color:#c62828;">Gagal memuat peta sertifikat.</div>';
    }
  };

  const showCertPopup = (element) => {
    const oldPopup = document.querySelector('.kavling-popup');
    if (oldPopup) document.body.removeChild(oldPopup);

    const aiText = element && element.dataset ? element.dataset.ai || '' : '';
    const bankKey = element && element.dataset ? element.dataset.bank || '' : '';
    const recipientFull = element && element.dataset ? element.dataset.recipientFull || '' : '';
    const groupId = element && element.dataset ? element.dataset.groupId || '' : '';
    const nomor = element && element.dataset ? element.dataset.nomor || '' : '';

    const popup = document.createElement('div');
    popup.className = 'kavling-popup';

    popup.innerHTML = `
      <div class="kavling-popup-content">
        <div class="kavling-popup-header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <h3 id="kavlingPopupTitle" style="margin:0;font-size:16px;">DATA SERTIFIKAT</h3>
            <span id="kavlingGroupIdChip" style="font-size:8px;color:#555;background:#f0f2f7;border:1px dashed #bbb;padding:2px 6px;border-radius:6px;">ID</span>
            <span id="kavlingMissingChip" style="display:none;font-size:9px;color:#b71c1c;background:#ffebee;border:1px solid #ffcdd2;padding:2px 6px;border-radius:6px;">PERIKSA DATA</span>
          </div>
          <button class="close-kavling-popup">&times;</button>
        </div>
        <div class="kavling-popup-body" style="padding:8px;">
          <div class="kavling-data-content" style="line-height:1.1;">
            <div class="kavling-ai-meta" style="margin-bottom:4px;font-size:14px;color:#333;font-weight:700;"></div>
            <div class="kavling-recipient-info" style="margin-bottom:8px;font-size:12px;color:#666;"></div>
            <div class="kavling-ai-text" style="font-size:14px;color:#444;white-space:pre-line;"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    const titleEl = popup.querySelector('#kavlingPopupTitle');
    const aiTextEl = popup.querySelector('.kavling-ai-text');
    const aiMetaEl = popup.querySelector('.kavling-ai-meta');
    const idChip = popup.querySelector('#kavlingGroupIdChip');
    const missingChip = popup.querySelector('#kavlingMissingChip');
    const recipientEl = popup.querySelector('.kavling-recipient-info');

    if (aiTextEl) {
      const norm = (aiText || 'Tidak ada data di kolom AI.')
        .replace(/\r?\n{2,}/g, '\n')   // gabungkan blank line ganda
        .replace(/[ \t]+\n/g, '\n')    // hapus spasi di akhir baris
        .trim();
      aiTextEl.textContent = norm;
    }
    if (aiMetaEl) {
      const parts = [];
      if (nomor) parts.push(`No: ${nomor}`);
      if (bankKey) parts.push(`Pembiayaan: ${bankKey}`);
      if (recipientFull) parts.push(`Penerima: ${recipientFull}`);
      aiMetaEl.textContent = parts.join(' • ');
    }
    if (idChip) {
      let gid = groupId;
      if (!gid && element) {
        let n = element;
        while (n && n.tagName && n.tagName.toLowerCase() !== 'svg') {
          if (n.tagName.toLowerCase() === 'g' && n.id) { gid = n.id; break; }
          n = n.parentNode;
        }
      }
      if (gid) {
        idChip.textContent = `ID: ${gid}`;
      } else {
        idChip.style.display = 'none';
      }
    }
    if (missingChip) {
      const isMissing = element && element.dataset && element.dataset.missing === '1';
      const isDup = element && element.dataset && element.dataset.duplicate === '1';
      if (isDup) {
        missingChip.style.display = 'inline-block';
        missingChip.textContent = 'PERIKSA DATA - DATA DOUBLE ID';
      } else if (isMissing) {
        missingChip.style.display = 'inline-block';
        missingChip.textContent = 'PERIKSA DATA';
      } else {
        missingChip.style.display = 'none';
      }
    }
    if (recipientEl) {
      recipientEl.style.display = 'none'; // Sembunyikan karena sudah masuk ke aiMetaEl
    }
    if (titleEl && nomor) {
      titleEl.textContent = `DATA SERTIFIKAT – ${nomor}`;
    }

    const closePopup = () => {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    };

    popup.querySelector('.close-kavling-popup')?.addEventListener('click', closePopup);
    popup.addEventListener('click', (e) => {
      if (e.target === popup) closePopup();
    });

    requestAnimationFrame(() => {
      popup.style.display = 'flex';
    });
  };

  const handleClick = (e) => {
    if (isDragging) return;
    const svg = mapEl.querySelector('svg');
    if (!svg || !groupIndexByKey.size) return;

    const shape = e.target.closest && e.target.closest('[data-fill-target="1"]');
    if (!shape) return;
    e.stopPropagation();
    showCertPopup(shape);
  };

  const handleMouseDown = (e) => {
    isPanning = true;
    isDragging = false;
    panStart = { x: e.clientX, y: e.clientY };
    mapEl.classList.add('grabbing');
  };
  const handleMouseMove = (e) => {
    if (!isPanning) return;
    const now = performance.now();
    if (now - lastPanTime < PAN_THROTTLE_MS) return;
    lastPanTime = now;

    const dxRaw = e.clientX - panStart.x;
    const dyRaw = e.clientY - panStart.y;

    if (Math.abs(dxRaw) > 3 || Math.abs(dyRaw) > 3) isDragging = true;

    const svg = mapEl.querySelector('svg');
    if (!svg) return;

    const dx = dxRaw * (viewBoxState.w / mapEl.clientWidth);
    const dy = dyRaw * (viewBoxState.h / mapEl.clientHeight);

    viewBoxState.x -= dx;
    viewBoxState.y -= dy;

    panStart = { x: e.clientX, y: e.clientY };
    applyViewBox(svg);
  };
  const endPan = () => {
    isPanning = false;
    mapEl.classList.remove('grabbing');
  };
  const handleWheel = (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now - lastWheelTime < WHEEL_THROTTLE_MS) return;
    lastWheelTime = now;
    const svg = mapEl.querySelector('svg');
    if (!svg) return;
    const rect = mapEl.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    const newW = viewBoxState.w * factor;
    const newH = viewBoxState.h * factor;
    viewBoxState.x += (viewBoxState.w - newW) * mx;
    viewBoxState.y += (viewBoxState.h - newH) * my;
    viewBoxState.w = newW;
    viewBoxState.h = newH;
    applyViewBox(svg);
  };

  const openPrintWindowFromElement = (svgEl) => {
    if (!svgEl) return;
    const win = window.open('', '_blank');
    if (!win) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Cetak Peta Sertifikat</title>
          <style>
            @page { size: A4; margin: 10mm; }
            html, body { margin: 0; padding: 0; }
            body {
              display: flex;
              align-items: center;
              justify-content: center;
              background: #ffffff;
            }
            svg { width: 100%; height: auto; }
          </style>
        </head>
        <body></body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();

    win.addEventListener('load', () => {
      try {
        const imported = win.document.importNode(svgEl, true);
        imported.removeAttribute('width');
        imported.removeAttribute('height');
        imported.style.width = 'auto';
        imported.style.height = 'auto';
        win.document.body.appendChild(imported);
        win.focus();
        setTimeout(() => win.print(), 300);
      } catch (err) {
        console.error('Print error:', err);
      }
    });
  };

  const handlePrintFull = () => {
    openOrientationModal('full');
  };

  const handlePrintView = () => {
    openOrientationModal('view');
  };

  const openOrientationModal = (mode) => {
    const modal = document.getElementById('orientationModal');
    const landscapeBtn = document.getElementById('printLandscapeBtn');
    const portraitBtn = document.getElementById('printPortraitBtn');
    const closeBtn = modal?.querySelector('.close-orientation-modal');
    
    if (!modal) return;

    modal.style.display = 'flex';

    const onLandscape = () => {
      modal.style.display = 'none';
      cleanup();
      processPDFDownload(mode, 'l');
    };
    const onPortrait = () => {
      modal.style.display = 'none';
      cleanup();
      processPDFDownload(mode, 'p');
    };
    const onClose = () => {
      modal.style.display = 'none';
      cleanup();
    };

    const cleanup = () => {
      landscapeBtn?.removeEventListener('click', onLandscape);
      portraitBtn?.removeEventListener('click', onPortrait);
      closeBtn?.removeEventListener('click', onClose);
    };

    landscapeBtn?.addEventListener('click', onLandscape);
    portraitBtn?.addEventListener('click', onPortrait);
    closeBtn?.addEventListener('click', onClose);
  };

  const processPDFDownload = async (mode, orientation) => {
    const btnId = mode === 'full' ? 'smapPrintFull' : 'smapPrintView';
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Mengolah...';

    try {
      const mapContainer = document.getElementById('cert-map');
      
      // Simpan dimensi asli peta saja
      const originalMapWidth = mapContainer.offsetWidth;
      const originalMapHeight = mapContainer.offsetHeight;

      const canvas = await html2canvas(mapContainer, {
        scale: 4,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 30000,
        onclone: (clonedDoc) => {
          const clonedMap = clonedDoc.getElementById('cert-map');
          if (clonedMap) {
            clonedMap.style.width = originalMapWidth + 'px';
            clonedMap.style.height = originalMapHeight + 'px';
            clonedMap.style.border = 'none';
            clonedMap.style.borderRadius = '0';
            
            const svg = clonedMap.querySelector('svg');
            if (svg) {
              svg.style.width = '100%';
              svg.style.height = '100%';
              svg.style.display = 'block';
              
              if (mode === 'full' && originalViewBox) {
                svg.setAttribute('viewBox', originalViewBox);
              } else if (mode === 'view' && viewBoxState) {
                const vb = `${viewBoxState.x} ${viewBoxState.y} ${viewBoxState.w} ${viewBoxState.h}`;
                svg.setAttribute('viewBox', vb);
              }
            }
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const { jsPDF } = window.jspdf;
      
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a3',
        compress: true
      });
      
      const pdfWidth = orientation === 'l' ? 420 : 297;
      const pdfHeight = orientation === 'l' ? 297 : 420;
      
      const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
      const finalWidth = canvas.width * ratio;
      const finalHeight = canvas.height * ratio;
      
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight, undefined, 'SLOW');
      
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = mode === 'full' ? `Full_Sitemap_BTU_${dateStr}.pdf` : `View_Sitemap_BTU_${dateStr}.pdf`;
      pdf.save(filename);
      
      btn.innerHTML = '<span>✅</span> Berhasil!';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('❌ PDF Download error:', error);
      alert('Gagal mendownload PDF: ' + error.message);
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  const applyFilters = () => {
    if (!certShapes.length) return;
    
    const hasBank = selectedBanks.size > 0;
    const hasGZ = selectedGZ.size > 0;
    const hasRecipient = selectedRecipients.size > 0;
    
    const anyFilter = (activeCategory === 'bank') ? (hasBank || hasGZ) : hasRecipient;
    const selectedKeys = new Set();

    // Jika belum ada filter dipilih, tampilkan warna default berdasarkan kategori aktif
    if (!anyFilter) {
      certShapes.forEach(el => {
        el.style.opacity = '1';
        if (el.dataset && el.dataset.missing === '1') {
          el.style.fill = '#eeeeee';
          return;
        }
        if (activeCategory === 'bank') {
          const bankKey = el.dataset.bank || '';
          const c = getBankColor(bankKey);
          if (c) el.style.fill = c; else el.style.fill = '#ffffff';
        } else if (activeCategory === 'recipient') {
          const recipientKey = el.dataset.recipient || '';
          const c = getRecipientColor(recipientKey);
          if (c) el.style.fill = c; else el.style.fill = '#ffffff';
        } else {
          el.style.fill = '#ffffff';
        }
      });
      updateAreaPanel([]);
      return;
    }

    certShapes.forEach(el => {
      if (el.dataset && el.dataset.missing === '1') {
        el.style.opacity = '1';
        el.style.fill = '#eeeeee';
        return;
      }
      let show = false;
      let targetColor = null;

      if (activeCategory === 'bank') {
        const bankKey = el.dataset.bank || '';
        const gzTag = el.dataset.gz || '';
        const matchBank = hasBank ? selectedBanks.has(bankKey) : false;
        const matchGZ = hasGZ ? selectedGZ.has(gzTag) : false;
        show = matchBank || matchGZ;

        if (show) {
          if (hasGZ && matchGZ) {
            targetColor = getGZColor(gzTag);
          }
          if (!targetColor) {
            targetColor = getBankColor(bankKey);
          }
        }
      } else {
        const recipientKey = el.dataset.recipient || '';
        show = hasRecipient ? selectedRecipients.has(recipientKey) : false;
        if (show) {
          targetColor = getRecipientColor(recipientKey);
        }
      }

      if (!show) {
        el.style.opacity = '1';
        el.style.fill = 'rgba(255,255,255,0.6)'; // tidak terpilih → putih
      } else {
        el.style.opacity = '1';
        if (targetColor) {
          el.style.fill = targetColor;
        } else {
          el.style.fill = '#ffffff';
        }
        
        if (el.dataset && (el.dataset.key || el.dataset.nomor)) {
          const k = el.dataset.key || normalizeCertId(el.dataset.nomor);
          if (k) selectedKeys.add(k);
        }
      }
    });
    updateAreaPanel(Array.from(selectedKeys));
  };

  const setupFilterCheckboxes = () => {
    selectedBanks = new Set();
    selectedGZ = new Set();
    selectedRecipients = new Set();

    const bankCbs = Array.from(document.querySelectorAll('.bank-filter'));
    const gzCbs = Array.from(document.querySelectorAll('.gz-filter'));
    const recipientCbs = Array.from(document.querySelectorAll('.recipient-filter'));
    const categoryTabs = Array.from(document.querySelectorAll('.category-tab'));
    const bankAll = document.getElementById('bankSelectAll');
    const recipientAll = document.getElementById('recipientSelectAll');

    const onChange = () => applyFilters();

    bankCbs.forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selectedBanks.add(cb.value);
        else selectedBanks.delete(cb.value);
        if (bankAll) {
          const total = bankCbs.length;
          const checked = bankCbs.filter(x => x.checked).length;
          bankAll.checked = checked === total;
          bankAll.indeterminate = checked > 0 && checked < total;
        }
        onChange();
      });
    });

    gzCbs.forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selectedGZ.add(cb.value);
        else selectedGZ.delete(cb.value);
        onChange();
      });
    });

    recipientCbs.forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selectedRecipients.add(cb.value);
        else selectedRecipients.delete(cb.value);
        if (recipientAll) {
          const total = recipientCbs.length;
          const checked = recipientCbs.filter(x => x.checked).length;
          recipientAll.checked = checked === total;
          recipientAll.indeterminate = checked > 0 && checked < total;
        }
        onChange();
      });
    });

    if (bankAll) {
      bankAll.addEventListener('change', () => {
        const check = bankAll.checked;
        bankAll.indeterminate = false;
        selectedBanks.clear();
        bankCbs.forEach(cb => {
          cb.checked = check;
          if (check) selectedBanks.add(cb.value);
        });
        onChange();
      });
    }

    if (recipientAll) {
      recipientAll.addEventListener('change', () => {
        const check = recipientAll.checked;
        recipientAll.indeterminate = false;
        selectedRecipients.clear();
        recipientCbs.forEach(cb => {
          cb.checked = check;
          if (check) selectedRecipients.add(cb.value);
        });
        onChange();
      });
    }

    categoryTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const cat = tab.dataset.category;
        
        if (activeCategory === cat) {
          // Toggle off if clicking the same tab
          activeCategory = null;
          tab.classList.remove('active');
          document.getElementById('filter-bank-group').style.display = 'none';
          document.getElementById('filter-recipient-group').style.display = 'none';
        } else {
          // Switch to new category
          activeCategory = cat;
          categoryTabs.forEach(t => t.classList.toggle('active', t === tab));

          // Toggle filter group visibility
          document.getElementById('filter-bank-group').style.display = (cat === 'bank') ? 'block' : 'none';
          document.getElementById('filter-recipient-group').style.display = (cat === 'recipient') ? 'block' : 'none';
        }

        // Reset all checkboxes always when switching or toggling off
        bankCbs.forEach(cb => cb.checked = false);
        gzCbs.forEach(cb => cb.checked = false);
        recipientCbs.forEach(cb => cb.checked = false);
        if (bankAll) { bankAll.checked = false; bankAll.indeterminate = false; }
        if (recipientAll) { recipientAll.checked = false; recipientAll.indeterminate = false; }
        
        selectedBanks.clear();
        selectedGZ.clear();
        selectedRecipients.clear();

        onChange();
      });
    });

    // Terapkan kondisi awal
    applyFilters();
  };


  const parseNumber = (val) => {
    if (val == null) return 0;
    const s = String(val).trim();
    if (!s) return 0;
    // Hilangkan karakter non-digit selain koma/titik lalu coba parsing cerdas
    const normalized = s
      .replace(/[^0-9.,-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  };

  const updateAreaPanel = (selectedKeys = []) => {
    const totalCertEl = document.getElementById('smapAreaTotalCert');
    const totalInAreaEl = document.getElementById('smapAreaTotalInArea');
    const tbody = document.getElementById('smapAreaTableBody');
    if (!totalCertEl || !totalInAreaEl || !tbody) return;

    let sumL = 0;
    let sumAA = 0;
    let rows = [];
    let seen = new Set();

    selectedKeys.forEach(key => {
      const item = certIndexByKey.get(key) || certIndexByKey.get(normalizeCertId(key));
      if (!item) return;
      const fullData = Array.isArray(item.fullData) ? item.fullData : [];
      const nomor = String(item.nomor || fullData[0] || '').trim();
      const warp = normalizeCertId(nomor);
      const luasL = parseNumber(fullData[11]); // L
      const luasAA = parseNumber(fullData[26]); // AA
      const rawRecipient = String(fullData[21] || '').trim();
      const recipient = rawRecipient || ' '; // Tampilkan raw data atau KOSONG jika kosong

      if (seen.has(warp)) return;
      seen.add(warp);

      sumL += luasL;
      sumAA += luasAA;
      rows.push({ nomor, warp, luasL, luasAA, recipient });
    });

    totalCertEl.textContent = sumL.toLocaleString('id-ID');
    totalInAreaEl.textContent = sumAA.toLocaleString('id-ID');

    // Render table
    tbody.innerHTML = '';
    rows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:6px;border-bottom:1px solid #eee;">${idx + 1}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">
          <a href="#" class="smapAreaLink" data-key="${r.warp}" style="color:#1565c0;text-decoration:underline;">${r.nomor}</a>
        </td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${r.luasL.toLocaleString('id-ID')}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${r.luasAA.toLocaleString('id-ID')}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">${r.recipient}</td>
      `;
      tbody.appendChild(tr);
    });
  };

  const initCertMap = async () => {
    try {
      await loadSVG();
      await initCertMapColors();
    } finally {
      if (loader) loader.style.display = 'none';
      console.log('CERT_API_URL', CERT_API_URL);
    }
  };

  initCertMap();

  mapEl.addEventListener('click', handleClick);
  mapEl.addEventListener('mousedown', handleMouseDown);
  mapEl.addEventListener('mousemove', handleMouseMove);
  mapEl.addEventListener('mouseup', endPan);
  mapEl.addEventListener('mouseleave', endPan);
  mapEl.addEventListener('wheel', handleWheel, { passive: false });

  document.getElementById('smapPrintFull')?.addEventListener('click', handlePrintFull);
  document.getElementById('smapPrintView')?.addEventListener('click', handlePrintView);

  // ============ Download PDF (A3) ala sitemap_report ============
  const setupPDFDownload = () => {
    const btn = document.getElementById('smapDownloadPDF');
    if (btn) {
      btn.addEventListener('click', handlePrintFull);
    }
  };

  setupPDFDownload();

  // ============ Fokus ke sertifikat pada SVG dari tabel ============
  const focusToCertByKey = (key) => {
    if (!key) return;
    const svg = mapEl.querySelector('svg');
    if (!svg || !groupIndexByKey || groupIndexByKey.size === 0) return;
    const norm = normalizeCertId(key);
    const mapping = groupIndexByKey.get(norm);
    if (!mapping) return;
    let bb;
    try { bb = mapping.group.getBBox(); } catch (e) { return; }
    if (!bb || bb.width === 0 || bb.height === 0) return;

    // Padding dan penyesuaian aspect ratio viewport
    const viewportRatio = mapEl.clientWidth / Math.max(1, mapEl.clientHeight);
    let pad = Math.max(bb.width, bb.height) * 0.15;
    let x = bb.x - pad;
    let y = bb.y - pad;
    let w = bb.width + pad * 2;
    let h = bb.height + pad * 2;
    const boxRatio = w / Math.max(1, h);
    if (boxRatio > viewportRatio) {
      const targetH = w / viewportRatio;
      const add = (targetH - h) / 2;
      y -= add;
      h = targetH;
    } else if (boxRatio < viewportRatio) {
      const targetW = h * viewportRatio;
      const add = (targetW - w) / 2;
      x -= add;
      w = targetW;
    }

    viewBoxState = { x, y, w, h };
    applyViewBox(svg);
  };

  document.getElementById('smapAreaTableBody')?.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('.smapAreaLink');
    if (link) {
      e.preventDefault();
      const key = link.getAttribute('data-key');
      focusToCertByKey(key);
    }
  });

  // ============ Quick Search Nomor Sertifikat (dropdown max 5) ============
  const setupQuickSearch = () => {
    const input = document.getElementById('smapQuickSearch');
    const box = document.getElementById('smapQuickSuggestions');
    if (!input || !box) return;

    const render = (items) => {
      box.innerHTML = '';
      items.slice(0, 5).forEach(({ key, nomor }) => {
        const row = document.createElement('div');
        row.className = 'smap-suggestion';
        row.dataset.key = key;
        row.textContent = nomor;
        row.style.cssText = 'padding:8px 10px; font-size:12px; cursor:pointer; border-bottom:1px solid #f0f0f0; color:#222;';
        row.addEventListener('mouseenter', () => row.style.background = '#f9fafb');
        row.addEventListener('mouseleave', () => row.style.background = '#fff');
        row.addEventListener('click', () => {
          focusToCertByKey(key);
          input.value = '';
          box.style.display = 'none';
        });
        box.appendChild(row);
      });
      box.style.display = items.length ? 'block' : 'none';
      box.style.color = '#222';
    };

    const search = (q) => {
      const term = String(q || '').trim().toUpperCase();
      if (!term) return [];
      const norm = term.replace(/[\s._-]/g, '');
      const results = [];
      certIndexByKey.forEach((item, key) => {
        // Hanya masukkan jika berhasil diwarnai (ada di SVG)
        if (!groupIndexByKey.has(key)) return;

        const nomor = String(item.nomor || item.fullData?.[0] || '').trim();
        const hay = nomor.toUpperCase();
        const hayNorm = hay.replace(/[\s._-]/g, '');
        if (hay.includes(term) || hayNorm.includes(norm) || key.includes(norm)) {
          results.push({ key, nomor });
        }
      });
      // Prioritaskan prefix match
      results.sort((a, b) => {
        const ap = a.nomor.toUpperCase().startsWith(term) ? 0 : 1;
        const bp = b.nomor.toUpperCase().startsWith(term) ? 0 : 1;
        return ap - bp || a.nomor.localeCompare(b.nomor);
      });
      return results;
    };

    input.addEventListener('input', () => {
      const val = input.value;
      const items = search(val);
      render(items);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        box.style.display = 'none';
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => (box.style.display = 'none'), 120);
    });
  };
});
