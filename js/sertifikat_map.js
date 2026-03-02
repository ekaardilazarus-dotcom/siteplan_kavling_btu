document.addEventListener('DOMContentLoaded', () => {
  const CERT_API_URL = 'https://script.google.com/macros/s/AKfycbxuAe7llIpc3SxGAhJ-d_HHYa4Ut9z-nHj8MVUGx4-_Qo7W5mwSLHEKStifg4MRD5Nofg/exec';
  const mapEl = document.getElementById('cert-map');
  const loader = mapEl.querySelector('.smap-loading');
  const BANK_CACHE_KEY = 'certMapBankCache';
  const BANK_CACHE_DURATION = 10 * 60 * 1000;
  let svgCache = null;
  let originalViewBox = null;
  let viewBoxState = { x: 0, y: 0, w: 1000, h: 1000 };
  let isPanning = false;
  let isDragging = false;
  let panStart = { x: 0, y: 0 };
  let certBankRows = [];
  let certShapes = [];
  let activeBankFilter = null;
  let activeCategory = null; // null, 'bank', atau 'recipient'
  let selectedBanks = new Set();
  let selectedGZ = new Set();
  let selectedRecipients = new Set();
  let certIndexByKey = new Map();
  let groupIndexByKey = new Map();

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
    viewBoxState = parseViewBox(originalViewBox);
  };

  const normalizeCertId = (raw) => {
    if (!raw) return '';
    return String(raw)
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[-_.]/g, '')
      .replace(/\//g, '')
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
      pattern.setAttribute('width', '8');
      pattern.setAttribute('height', '8');

      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', '8');
      bg.setAttribute('height', '8');
      bg.setAttribute('fill', '#ffffff');
      bg.setAttribute('opacity', '1');

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line1.setAttribute('d', 'M0,8 L8,0');
      line1.setAttribute('stroke', '#b71c1c');
      line1.setAttribute('stroke-width', '1');
      line1.setAttribute('opacity', '0.7');

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line2.setAttribute('d', 'M-2,6 L2,10');
      line2.setAttribute('stroke', '#b71c1c');
      line2.setAttribute('stroke-width', '1');
      line2.setAttribute('opacity', '0.7');

      pattern.appendChild(bg);
      pattern.appendChild(line1);
      pattern.appendChild(line2);
      defs.appendChild(pattern);
    }
  };

  const buildCertIndex = () => {
    certIndexByKey = new Map();
    certBankRows.forEach(item => {
      const fullData = Array.isArray(item.fullData) ? item.fullData : [];
      const nomor = String(item.nomor || fullData[0] || '').trim();
      const key = normalizeCertId(nomor);
      if (key) {
        certIndexByKey.set(key, item);
      }
    });
  };

  const loadCertBankData = async () => {
    if (certBankRows.length) return certBankRows;
    try {
      const cachedRaw = localStorage.getItem(BANK_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && Array.isArray(cached.results) && cached.timestamp && Date.now() - cached.timestamp < BANK_CACHE_DURATION) {
          certBankRows = cached.results;
          buildCertIndex();
          return certBankRows;
        }
      }
    } catch (e) {
      console.warn('Failed to load cert map cache', e);
    }

    const res = await fetch(`${CERT_API_URL}?action=get_all&_t=${Date.now()}`);
    const json = await res.json();
    if (json && json.status === 'success' && Array.isArray(json.results)) {
      certBankRows = json.results;
      buildCertIndex();
      try {
        localStorage.setItem(BANK_CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          results: certBankRows
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

  const colorizeSertifikatMap = () => {
    const svg = mapEl.querySelector('svg');
    if (!svg || !certBankRows.length || !certIndexByKey.size) return;
    ensurePatterns(svg);

    const rootGroup = svg.querySelector('#sertifikatbtu') || svg;
    const groups = Array.from(rootGroup.querySelectorAll('g[id]')).filter(g => g.id && g.id !== 'sertifikatbtu');

    groupIndexByKey = new Map();
    certShapes = [];

    const isTextOutline = (el) => {
      try {
        const rawFill = (el.getAttribute('fill') || el.style.fill || window.getComputedStyle(el).fill || '').toLowerCase();
        const rawStroke = (el.getAttribute('stroke') || el.style.stroke || window.getComputedStyle(el).stroke || '').toLowerCase();
        const sw = parseFloat(el.getAttribute('stroke-width') || el.style.strokeWidth || window.getComputedStyle(el).strokeWidth || '0') || 0;
        const isBlack = rawFill === 'black' || rawFill === '#000' || rawFill === '#000000' || rawFill.startsWith('rgb(0, 0, 0)');
        const hasStroke = rawStroke && rawStroke !== 'none' && sw > 0.05;
        return isBlack && !hasStroke;
      } catch (_) {
        return false;
      }
    };

    groups.forEach(group => {
      const key = normalizeCertId(group.id);
      if (!key) return;
      const allShapes = Array.from(group.querySelectorAll('path, polygon, rect, circle'));
      if (!allShapes.length) return;
      // Pilih hanya shape kavling utama (bukan outline teks/path tulisan)
      let gbb;
      try { gbb = group.getBBox(); } catch (_) { gbb = null; }
      const gArea = gbb ? Math.max(1, gbb.width * gbb.height) : 1;

      // Hitung area tiap shape
      const shapeAreas = allShapes.map(el => {
        try {
          const bb = el.getBBox();
          const area = Math.max(0, bb.width * bb.height);
          return { el, area, ratio: area / gArea };
        } catch (_) {
          return { el, area: 0, ratio: 0 };
        }
      });

      // Ambil area terbesar sebagai kandidat utama
      const maxArea = shapeAreas.reduce((m, s) => Math.max(m, s.area), 0);
      // Kriteria: shape dianggap bidang kavling bila cukup besar terhadap grup
      // atau termasuk klaster terbesar (>= 60% dari max area)
      const shapes = shapeAreas
        .filter(s => s.area > 0 && (s.ratio >= 0.12 || s.area >= maxArea * 0.6))
        .map(s => s.el)
        // Buang path outline tulisan (fill hitam, tanpa stroke)
        .filter(el => !isTextOutline(el));

      // Tandai target pewarnaan
      allShapes.forEach(s => s.removeAttribute('data-fill-target'));
      shapes.forEach(s => s.setAttribute('data-fill-target', '1'));

      if (!shapes.length) return;
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
          if (color) el.style.fill = color; else el.style.removeProperty('fill');
        } else if (activeCategory === 'recipient') {
          const color = getRecipientColor(recipientKey);
          if (color) el.style.fill = color; else el.style.removeProperty('fill');
        } else {
          el.style.removeProperty('fill');
        }
        
        el.style.removeProperty('stroke');
        el.style.removeProperty('stroke-width');
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

    // Warnai hitam untuk ID yang ada di SVG tapi tidak ada di database
    groupIndexByKey.forEach((mapping, key) => {
      if (coloredKeys.has(key)) return;
      const shapes = mapping.shapes || [];
      shapes.forEach(el => {
        el.dataset.missing = '1';
        el.dataset.key = key;
        el.dataset.nomor = mapping.group && mapping.group.id ? mapping.group.id : key;
        el.style.fill = '#000000';
        el.style.removeProperty('stroke');
        el.style.removeProperty('stroke-width');
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
      missingChip.style.display = isMissing ? 'inline-block' : 'none';
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
    const svg = mapEl.querySelector('svg');
    if (!svg || !originalViewBox) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('viewBox', originalViewBox);
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    openPrintWindowFromElement(clone);
  };

  const handlePrintView = () => {
    const svg = mapEl.querySelector('svg');
    if (!svg || !viewBoxState) return;
    const clone = svg.cloneNode(true);
    const vb = `${viewBoxState.x} ${viewBoxState.y} ${viewBoxState.w} ${viewBoxState.h}`;
    clone.setAttribute('viewBox', vb);
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    openPrintWindowFromElement(clone);
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
          el.style.fill = '#000000';
          return;
        }
        if (activeCategory === 'bank') {
          const bankKey = el.dataset.bank || '';
          const c = getBankColor(bankKey);
          if (c) el.style.fill = c; else el.style.removeProperty('fill');
        } else if (activeCategory === 'recipient') {
          const recipientKey = el.dataset.recipient || '';
          const c = getRecipientColor(recipientKey);
          if (c) el.style.fill = c; else el.style.removeProperty('fill');
        } else {
          el.style.removeProperty('fill');
        }
      });
      updateAreaPanel([]);
      return;
    }

    certShapes.forEach(el => {
      if (el.dataset && el.dataset.missing === '1') {
        el.style.opacity = '1';
        el.style.fill = '#000000';
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
          el.style.removeProperty('fill');
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

    const onChange = () => applyFilters();

    bankCbs.forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selectedBanks.add(cb.value);
        else selectedBanks.delete(cb.value);
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
        onChange();
      });
    });

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
