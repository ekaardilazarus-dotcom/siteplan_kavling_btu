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
      const shapes = Array.from(group.querySelectorAll('path, polygon, rect, circle'));
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

      shapes.forEach(el => {
        el.dataset.bank = bankKey;
        el.dataset.ai = String(aiValue || '');
        el.dataset.nomor = nomor;
        el.style.fill = color;
        el.style.stroke = 'rgba(0,0,0,0.4)';
        el.style.strokeWidth = '0.2';
      });
    });

    applyBankFilter();
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
      setupBankFilterButtons();
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
            <div class="kavling-ai-title">Kolom AI</div>
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
