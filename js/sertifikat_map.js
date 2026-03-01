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
  let selectedBanks = new Set();
  let selectedGZ = new Set();
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
      case 'LAINNYA':
      default:
        return 'rgba(255,255,255,0.6)';
    }
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

    const rootGroup = svg.querySelector('#sertifikatbtu') || svg;
    const groups = Array.from(rootGroup.querySelectorAll('g[id]')).filter(g => g.id && g.id !== 'sertifikatbtu');

    groupIndexByKey = new Map();
    certShapes = [];

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
        .map(s => s.el);

      // Tandai target pewarnaan
      allShapes.forEach(s => s.removeAttribute('data-fill-target'));
      shapes.forEach(s => s.setAttribute('data-fill-target', '1'));

      if (!shapes.length) return;
      groupIndexByKey.set(key, { group, shapes });
      certShapes.push(...shapes);
    });

    certIndexByKey.forEach((item, key) => {
      const mapping = groupIndexByKey.get(key);
      if (!mapping) return;
      const shapes = mapping.shapes;
      const fullData = Array.isArray(item.fullData) ? item.fullData : [];
      const rawBank = fullData[16] || '';
      const aiValue = fullData[34] || '';
      const bankKey = normalizeBank(rawBank);
      const color = getBankColor(bankKey);
      const nomor = String(item.nomor || fullData[0] || '').trim();
      const gzTag = getGZTag(aiValue);

      shapes.forEach(el => {
        el.dataset.bank = bankKey;
        el.dataset.ai = String(aiValue || '');
        el.dataset.nomor = nomor;
        el.dataset.key = key;
        if (gzTag) el.dataset.gz = gzTag; else delete el.dataset.gz;
        // Hanya ubah fill, jangan ubah garis (stroke)
        el.style.fill = color;
        el.style.removeProperty('stroke');
        el.style.removeProperty('stroke-width');
      });
      // Pastikan teks di dalam grup tetap hitam dan tidak memiliki stroke
      const texts = mapping.group.querySelectorAll('text');
      texts.forEach(t => {
        t.style.fill = '#000';
        t.style.stroke = 'none';
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
    const nomor = element && element.dataset ? element.dataset.nomor || '' : '';

    const popup = document.createElement('div');
    popup.className = 'kavling-popup';

    popup.innerHTML = `
      <div class="kavling-popup-content">
        <div class="kavling-popup-header">
          <h3>DATA SERTIFIKAT</h3>
          <button class="close-kavling-popup">&times;</button>
        </div>
        <div class="kavling-popup-body">
          <div class="kavling-data-content">
            <div class="kavling-ai-text"></div>
            <div class="kavling-ai-meta"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    const aiTextEl = popup.querySelector('.kavling-ai-text');
    const aiMetaEl = popup.querySelector('.kavling-ai-meta');
    if (aiTextEl) {
      aiTextEl.textContent = aiText || 'Tidak ada data di kolom AI.';
    }
    if (aiMetaEl) {
      const parts = [];
      if (nomor) parts.push(`No: ${nomor}`);
      if (bankKey) parts.push(`Kategori: ${bankKey}`);
      aiMetaEl.textContent = parts.join(' • ');
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

    let t = e.target;
    while (t && t !== mapEl && t !== svg) {
      const frameGroup = t.closest && t.closest('g[id]');
      if (frameGroup && frameGroup.id && frameGroup.id !== 'sertifikatbtu') {
        const key = normalizeCertId(frameGroup.id);
        const mapping = groupIndexByKey.get(key);
        const shapes = mapping ? mapping.shapes : Array.from(frameGroup.querySelectorAll('path, polygon, rect, circle'));
        const targetEl = shapes.find(el => el.dataset && el.dataset.ai !== undefined) || shapes[0] || frameGroup;
        e.stopPropagation();
        showCertPopup(targetEl);
        return;
      }
      t = t.parentElement;
    }
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
    const anyFilter = hasBank || hasGZ;
    const selectedKeys = new Set();
    // Jika belum ada filter dipilih, tampilkan warna default (berdasarkan kolom Q)
    if (!anyFilter) {
      certShapes.forEach(el => {
        const bankKey = el.dataset.bank || '';
        el.style.opacity = '1';
        el.style.fill = getBankColor(bankKey);
      });
      updateAreaPanel([]);
      return;
    }
    certShapes.forEach(el => {
      const bankKey = el.dataset.bank || '';
      const gzTag = el.dataset.gz || '';
      const matchBank = hasBank ? selectedBanks.has(bankKey) : false;
      const matchGZ = hasGZ ? selectedGZ.has(gzTag) : false;
      const show = anyFilter ? (matchBank || matchGZ) : false;

      if (!show) {
        el.style.opacity = '1';
        el.style.fill = 'rgba(255,255,255,0.6)'; // tidak terpilih → putih
      } else {
        el.style.opacity = '1';
        // Prioritas GZ jika dipilih
        if (hasGZ && matchGZ) {
          const gzColor = getGZColor(gzTag);
          el.style.fill = gzColor || getBankColor(bankKey);
        } else {
          el.style.fill = getBankColor(bankKey);
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

    const bankCbs = Array.from(document.querySelectorAll('.bank-filter'));
    const gzCbs = Array.from(document.querySelectorAll('.gz-filter'));

    const onChange = () => applyFilters();

    bankCbs.forEach(cb => {
      cb.addEventListener('change', () => {
        const val = cb.value;
        if (cb.checked) selectedBanks.add(val);
        else selectedBanks.delete(val);
        onChange();
      });
    });

    gzCbs.forEach(cb => {
      cb.addEventListener('change', () => {
        const val = cb.value;
        if (cb.checked) selectedGZ.add(val);
        else selectedGZ.delete(val);
        onChange();
      });
    });
    // Terapkan kondisi awal: tanpa pilihan → semua putih
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

      if (seen.has(warp)) return;
      seen.add(warp);

      sumL += luasL;
      sumAA += luasAA;
      rows.push({ nomor, warp, luasL, luasAA });
    });

    totalCertEl.textContent = sumL.toLocaleString('id-ID');
    totalInAreaEl.textContent = sumAA.toLocaleString('id-ID');

    // Render table
    tbody.innerHTML = '';
    rows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:6px;border-bottom:1px solid #eee;">${idx + 1}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">${r.nomor}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${r.luasL.toLocaleString('id-ID')}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${r.luasAA.toLocaleString('id-ID')}</td>
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
});
