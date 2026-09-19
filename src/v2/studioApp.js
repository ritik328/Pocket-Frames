/**
 * Pocket Frames V2 — Studio Application Coordinator
 * Wires scene state, renderer, overlay, sidebar panels, and export together.
 */

import { sceneStore, createPhotoEntry, createStickerElement, createTextElement, LOGICAL_W, LOGICAL_H } from './scene.js';
import { renderScene, renderFrameThumbnail } from './sceneRenderer.js';
import { OverlayController } from './overlayController.js';
import { FRAME_CATALOG, FRAME_CATEGORIES, getFrameById } from './frameDefinitions.js';
import { STICKER_CATALOG, STICKER_PACKS, getStickersByPack, searchStickers } from './stickerCatalog.js';
import { CanvasResizer } from '../editor/canvasResizer.js';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const canvas       = document.getElementById('v2-canvas');
const overlayEl    = document.getElementById('v2-overlay');
const fileInput    = document.getElementById('v2-file-input');
const toastEl      = document.getElementById('v2-toast');

let v2Resizer      = null;

// Sidebar tabs
const tabBtns      = document.querySelectorAll('.rail button, .rail-btn, .v2-tab-btn');
const tabPanels    = document.querySelectorAll('.v2-tab-panel');

// Controls
const undoBtn      = document.getElementById('v2-undo');
const redoBtn      = document.getElementById('v2-redo');
const newBtn       = document.getElementById('v2-new');
const exportBtn    = document.getElementById('v2-export');
const previewBtn   = document.getElementById('v2-preview');
const formatBtns   = document.querySelectorAll('[data-export-format]');
const uploadZone   = document.getElementById('v2-upload-zone');

// Sticker panel
const stickerSearch   = document.getElementById('v2-sticker-search');
const stickerPackBtns = document.getElementById('v2-pack-tabs');
const stickerGrid     = document.getElementById('v2-sticker-grid');

// Frame panel
const frameCatBtns = document.getElementById('v2-frame-cats');
const frameGrid    = document.getElementById('v2-frame-grid');

// Metadata panel (right sidebar)
const metaInputs = {
  brand:       document.getElementById('v2-meta-brand'),
  device:      document.getElementById('v2-meta-device'),
  focalLength: document.getElementById('v2-meta-fl'),
  aperture:    document.getElementById('v2-meta-ap'),
  shutter:     document.getElementById('v2-meta-sh'),
  iso:         document.getElementById('v2-meta-iso'),
  caption:     document.getElementById('v2-meta-caption'),
  location:    document.getElementById('v2-meta-location'),
};

// Text panel
const addTextBtn     = document.getElementById('v2-add-text');
const textFontBtns   = document.querySelectorAll('[data-font]');

// Layers panel
const layersList     = document.getElementById('v2-layers-list');

// Properties panel (right sidebar, shown when element selected)
const propPanel      = document.getElementById('v2-prop-panel');
const propOpacity    = document.getElementById('v2-prop-opacity');
const propOpacityVal = document.getElementById('v2-prop-opacity-val');
const propShadow     = document.getElementById('v2-prop-shadow');
const metaPanel      = document.getElementById('v2-meta-panel');

// ─── State ────────────────────────────────────────────────────────────────────
let _overlay        = null;     // OverlayController
let _raf            = null;     // requestAnimationFrame handle
let _dirty          = true;     // needs re-render
let _cleanPreview   = false;
let _exportPreset   = '2160x2700';
let _currentFont    = 'Caveat';
let _activePack     = 'all';
let _activeFrameCat = 'all';

// ─── Scale helpers ────────────────────────────────────────────────────────────
function getScale() {
  return canvas.clientWidth / LOGICAL_W;
}

function getEditorState() {
  return {
    selectedId:    _overlay?.selectedId || null,
    gridVisible:   !_cleanPreview,
    guidesVisible: !_cleanPreview
  };
}

// ─── Render loop ──────────────────────────────────────────────────────────────
function scheduleRender() {
  _dirty = true;
}

function renderLoop() {
  if (_dirty) {
    _dirty = false;
    const scale = getScale();
    const w = Math.round(canvas.clientWidth);
    const h = Math.round(canvas.clientHeight);

    renderScene(
      canvas.getContext('2d'),
      sceneStore.scene,
      sceneStore.assets,
      {
        targetWidth:  w,
        targetHeight: h,
        isExport:     _cleanPreview,
        editorState:  getEditorState()
      }
    );
    _overlay?.refresh();
    updateLayersPanel();
    updateUndoRedo();
  }
  _raf = requestAnimationFrame(renderLoop);
}

// ─── Canvas sizing ─────────────────────────────────────────────────────────────
function sizeCanvas() {
  if (v2Resizer && v2Resizer.isFitMode) {
    v2Resizer.fitToScreen();
    return;
  }
  const area   = document.getElementById('v2-canvas-area');
  if (!area) return;
  const areaH  = area.clientHeight - 85;
  const areaW  = area.clientWidth  - 48;
  const aspect = LOGICAL_H / LOGICAL_W;

  let w = areaW;
  let h = w * aspect;
  if (h > areaH) { h = areaH; w = h / aspect; }

  w = Math.floor(w);
  h = Math.floor(h);

  canvas.style.width  = `${w}px`;
  canvas.style.height = `${h}px`;
  overlayEl.style.width  = `${w}px`;
  overlayEl.style.height = `${h}px`;

  const wrap = document.getElementById('v2-canvas-wrap');
  if (wrap) {
    wrap.style.width = `${w}px`;
    wrap.style.height = `${h}px`;
  }

  scheduleRender();
}

// ─── Photo upload ─────────────────────────────────────────────────────────────
async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please upload an image file (JPG, PNG, WebP)');
    return;
  }

  try {
    const assetId = `photo-${Date.now()}`;
    await sceneStore.registerAsset(assetId, file, file.name);
    const asset = sceneStore.getAsset(assetId);
    const entry = createPhotoEntry(assetId, asset.w, asset.h);

    // Auto-fit scale
    const ap = getFrameById(sceneStore.scene.frame.id)?.apertures?.[0];
    if (ap && asset) {
      const fitScaleX = ap.w / asset.w;
      const fitScaleY = ap.h / asset.h;
      entry.scale = Math.max(fitScaleX, fitScaleY);
    }

    sceneStore.setPhoto(entry);

    // Parse EXIF if available
    tryReadExif(file);
    scheduleRender();
    showToast('Photo loaded ✓');
  } catch (err) {
    console.error(err);
    showToast('Failed to load image');
  }
}

async function tryReadExif(file) {
  // Basic EXIF: read from file via DataView (no external dependency)
  // Only extract the most useful fields for the metadata panel
  try {
    const ab = await file.arrayBuffer();
    const dv = new DataView(ab);
    if (dv.getUint16(0) !== 0xFFD8) return; // not JPEG

    let offset = 2;
    while (offset < dv.byteLength - 2) {
      const marker = dv.getUint16(offset);
      const len    = dv.getUint16(offset + 2);
      if (marker === 0xFFE1) {
        // APP1 / EXIF — basic string scan
        const segment = new Uint8Array(ab, offset + 4, len - 2);
        const text    = new TextDecoder('ascii').decode(segment);
        // Very basic fallbacks: check for common EXIF tags
        const make  = extractSimpleStr(text, 'SAMSUNG') || extractSimpleStr(text, 'Apple') || '';
        if (make && !sceneStore.scene.metadata.device) {
          sceneStore.setMetadata({ device: make });
          updateMetaInputs();
        }
      }
      offset += 2 + len;
    }
  } catch { /* silently ignore EXIF parse failures */ }
}

function extractSimpleStr(text, brand) {
  const idx = text.indexOf(brand);
  return idx !== -1 ? text.slice(idx, idx + 32).split('\0')[0] : null;
}

// ─── Photo pan interaction ────────────────────────────────────────────────────
let _panState = null;

canvas.addEventListener('pointerdown', e => {
  if (_overlay?.selectedId) return;  // element selected — overlay handles it

  const scene = sceneStore.scene;
  if (!scene.photos?.[0]) {
    // No photo — trigger upload
    fileInput.click();
    return;
  }

  _panState = {
    startX: e.clientX,
    startY: e.clientY,
    startPX: scene.photos[0].x,
    startPY: scene.photos[0].y
  };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', e => {
  if (!_panState) return;
  const scale = getScale();
  const photo = sceneStore.scene.photos?.[0];
  if (!photo) return;
  const dx = (e.clientX - _panState.startX) / scale;
  const dy = (e.clientY - _panState.startY) / scale;
  sceneStore.updatePhoto(photo.id, { x: _panState.startPX + dx, y: _panState.startPY + dy });
  scheduleRender();
});

canvas.addEventListener('pointerup',   () => { _panState = null; });
canvas.addEventListener('pointercancel', () => { _panState = null; });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const photo = sceneStore.scene.photos?.[0];
  if (!photo) return;
  const delta = e.deltaY < 0 ? 0.05 : -0.05;
  sceneStore.updatePhoto(photo.id, { scale: Math.max(0.1, Math.min(10, (photo.scale || 1) + delta)) });
  scheduleRender();
}, { passive: false });

// ─── Sticker panel ────────────────────────────────────────────────────────────
// Pre-load all SVGs as assets once
async function preloadStickers() {
  const promises = STICKER_CATALOG.map(sticker =>
    sceneStore.registerSvgAsset(sticker.id, sticker.svg)
  );
  await Promise.all(promises);
}

function buildStickerPackTabs() {
  if (!stickerPackBtns) return;
  stickerPackBtns.innerHTML = '';
  STICKER_PACKS.forEach(pack => {
    const btn = document.createElement('button');
    const isActive = pack.id === _activePack;
    btn.className = `chip v2-pack-tab ${isActive ? 'active is-active' : ''}`;
    btn.dataset.pack = pack.id;
    btn.innerHTML = `<span>${pack.emoji}</span> <span>${pack.label}</span>`;
    btn.addEventListener('click', () => {
      _activePack = pack.id;
      stickerPackBtns.querySelectorAll('.chip, .v2-pack-tab').forEach(b => {
        const on = b.dataset.pack === pack.id;
        b.classList.toggle('active', on);
        b.classList.toggle('is-active', on);
      });
      buildStickerGrid();
    });
    stickerPackBtns.appendChild(btn);
  });
}

function buildStickerGrid(query = '') {
  if (!stickerGrid) return;
  stickerGrid.innerHTML = '';

  const list = query
    ? searchStickers(query)
    : getStickersByPack(_activePack);

  list.forEach(sticker => {
    const tile = document.createElement('div');
    tile.className = 'v2-sticker-tile';
    tile.title = sticker.name;

    // Preview via canvas
    const tc = document.createElement('canvas');
    tc.width = 64; tc.height = 64;
    const tctx = tc.getContext('2d');
    const asset = sceneStore.getAsset(sticker.id);
    if (asset?.img) {
      tctx.drawImage(asset.img, 0, 0, 64, 64);
    }
    tile.appendChild(tc);

    const lbl = document.createElement('span');
    lbl.textContent = sticker.name;
    tile.appendChild(lbl);

    tile.addEventListener('click', () => addSticker(sticker));
    stickerGrid.appendChild(tile);
  });
}

function addSticker(sticker) {
  // Place sticker at center of aperture with default size
  const ap   = getFrameById(sceneStore.scene.frame.id)?.apertures?.[0];
  const defS = sticker.defaultSize || 200;
  const x    = ap ? ap.x + ap.w / 2 - defS / 2 : LOGICAL_W / 2 - defS / 2;
  const y    = ap ? ap.y + ap.h / 2 - defS / 2 : LOGICAL_H / 2 - defS / 2;

  const el = createStickerElement(sticker.id, x, y, defS);
  el.rotation = (Math.random() - 0.5) * 12;  // slight random tilt

  sceneStore.addElement(el);
  _overlay?.selectElement(el.id);
  scheduleRender();
  showToast(`${sticker.name} added`);

  // Switch to photo tab so user sees the result
  activateTab('photo');
}

// ─── Frame picker ─────────────────────────────────────────────────────────────
function buildFrameCategoryTabs() {
  if (!frameCatBtns) return;
  frameCatBtns.innerHTML = '';
  FRAME_CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    const isActive = cat.id === _activeFrameCat;
    btn.className = `chip v2-pack-tab ${isActive ? 'active is-active' : ''}`;
    btn.dataset.cat = cat.id;
    btn.textContent = cat.label;
    btn.addEventListener('click', () => {
      _activeFrameCat = cat.id;
      frameCatBtns.querySelectorAll('.chip, .v2-pack-tab').forEach(b => {
        const on = b.dataset.cat === cat.id;
        b.classList.toggle('active', on);
        b.classList.toggle('is-active', on);
      });
      buildFrameGrid();
    });
    frameCatBtns.appendChild(btn);
  });
}

function buildFrameGrid() {
  if (!frameGrid) return;
  frameGrid.innerHTML = '';

  const list = _activeFrameCat === 'all'
    ? FRAME_CATALOG
    : FRAME_CATALOG.filter(f => f.category === _activeFrameCat);

  list.forEach(frame => {
    const tile = document.createElement('div');
    tile.className = `v2-frame-tile ${sceneStore.scene.frame.id === frame.id ? 'is-active' : ''}`;
    tile.title = frame.name;

    const tc = document.createElement('canvas');
    renderFrameThumbnail(tc, frame.id);
    tile.appendChild(tc);

    const lbl = document.createElement('span');
    lbl.textContent = frame.name;
    tile.appendChild(lbl);

    tile.addEventListener('click', () => {
      sceneStore.setFrame(frame.id);
      frameGrid.querySelectorAll('.v2-frame-tile').forEach(t => t.classList.remove('is-active'));
      tile.classList.add('is-active');
      scheduleRender();
      showToast(`Frame: ${frame.name}`);
    });

    frameGrid.appendChild(tile);
  });
}

// ─── Layers panel ─────────────────────────────────────────────────────────────
function updateLayersPanel() {
  if (!layersList) return;
  const sorted = [...sceneStore.scene.elements]
    .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

  layersList.innerHTML = '';
  if (!sorted.length) {
    layersList.innerHTML = '<div class="v2-layers-empty">Add stickers or text to see layers here.</div>';
    return;
  }
  sorted.forEach(el => {
    const row = document.createElement('div');
    const isSelected = el.id === _overlay?.selectedId;
    row.className = `layer-row v2-layer-row ${isSelected ? 'active is-selected' : ''}`;
    row.dataset.id = el.id;

    const name = el.type === 'sticker'
      ? (STICKER_CATALOG.find(s => s.id === el.assetId)?.name || el.assetId)
      : el.type === 'text'
      ? (el.text?.slice(0, 20) || 'Text')
      : 'Tape';

    row.innerHTML = `
      <svg class="grip" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>
      <span>${name}</span>
      <button class="v2-layer-vis" data-id="${el.id}" title="Toggle visibility" style="background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;">
        <svg class="eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity:${el.visible ? '1' : '0.35'}"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button class="v2-layer-lock" data-id="${el.id}" title="Toggle lock" style="background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;color:var(--muted);font-size:11px;">
        ${el.locked ? '🔒' : '🔓'}
      </button>
    `;

    row.addEventListener('click', () => {
      _overlay?.selectElement(el.id);
      scheduleRender();
    });

    row.querySelector('.v2-layer-vis').addEventListener('click', e => {
      e.stopPropagation();
      sceneStore.updateElement(el.id, { visible: !el.visible });
      scheduleRender();
    });

    row.querySelector('.v2-layer-lock').addEventListener('click', e => {
      e.stopPropagation();
      sceneStore.updateElement(el.id, { locked: !el.locked });
    });

    layersList.appendChild(row);
  });
}

// ─── Properties panel ─────────────────────────────────────────────────────────
function showPropsForSelected(id) {
  if (!propPanel || !metaPanel) return;
  if (!id) {
    propPanel.style.display = 'none';
    metaPanel.style.display = '';
    return;
  }
  propPanel.style.display = '';
  metaPanel.style.display = 'none';

  const el = sceneStore.scene.elements.find(e => e.id === id);
  if (!el) return;

  if (propOpacity) {
    propOpacity.value = Math.round((el.opacity ?? 1) * 100);
    if (propOpacityVal) propOpacityVal.textContent = `${propOpacity.value}%`;
  }
  if (propShadow) propShadow.checked = el.shadow || false;
}

if (propOpacity) {
  propOpacity.addEventListener('input', () => {
    const id = _overlay?.selectedId;
    if (!id) return;
    const val = propOpacity.value / 100;
    if (propOpacityVal) propOpacityVal.textContent = `${propOpacity.value}%`;
    sceneStore.updateElement(id, { opacity: val });
    scheduleRender();
  });
}

if (propShadow) {
  propShadow.addEventListener('change', () => {
    const id = _overlay?.selectedId;
    if (!id) return;
    sceneStore.updateElement(id, { shadow: propShadow.checked });
    scheduleRender();
  });
}

// ─── Text ─────────────────────────────────────────────────────────────────────
if (addTextBtn) {
  addTextBtn.addEventListener('click', () => {
    const ap  = getFrameById(sceneStore.scene.frame.id)?.apertures?.[0];
    const x   = ap ? ap.x + 40 : 200;
    const y   = ap ? ap.y + ap.h / 2 - 60 : LOGICAL_H / 2;
    const el  = createTextElement("your text", x, y);
    el.style.fontFamily = _currentFont;
    sceneStore.addElement(el);
    _overlay?.selectElement(el.id);
    scheduleRender();
    showToast('Text added — click to edit');
  });
}

textFontBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    _currentFont = btn.dataset.font;
    textFontBtns.forEach(b => b.classList.toggle('is-active', b === btn));

    const id = _overlay?.selectedId;
    if (id) {
      const el = sceneStore.scene.elements.find(e => e.id === id);
      if (el?.type === 'text') {
        sceneStore.updateElementWithHistory(id, { style: { ...el.style, fontFamily: _currentFont } });
        scheduleRender();
      }
    }
  });
});

// ─── Metadata inputs ──────────────────────────────────────────────────────────
function updateMetaInputs() {
  const m = sceneStore.scene.metadata;
  Object.entries(metaInputs).forEach(([key, el]) => {
    if (el && m[key] !== undefined) el.value = m[key];
  });
}

Object.entries(metaInputs).forEach(([key, el]) => {
  if (!el) return;
  el.addEventListener('input', () => {
    sceneStore.setMetadata({ [key]: el.value });
    scheduleRender();
  });
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function activateTab(id) {
  tabBtns.forEach(b => {
    const active = b.dataset.tab === id;
    b.classList.toggle('is-active', active);
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  tabPanels.forEach(p => {
    const active = p.dataset.panel === id;
    p.classList.toggle('is-active', active);
    p.classList.toggle('active', active);
    p.style.display = active ? '' : 'none';
  });
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

// ─── Upload wiring ────────────────────────────────────────────────────────────
if (uploadZone) {
  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('is-drag'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('is-drag'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault(); uploadZone.classList.remove('is-drag');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
    fileInput.value = '';
  });
}

// ─── Undo / Redo ──────────────────────────────────────────────────────────────
function updateUndoRedo() {
  if (undoBtn) undoBtn.disabled = !sceneStore.canUndo;
  if (redoBtn) redoBtn.disabled = !sceneStore.canRedo;
}

if (undoBtn) undoBtn.addEventListener('click', () => { sceneStore.undo(); scheduleRender(); });
if (redoBtn) redoBtn.addEventListener('click', () => { sceneStore.redo(); scheduleRender(); });

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
    sceneStore.undo(); scheduleRender();
  }
  if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
    sceneStore.redo(); scheduleRender();
  }
});

// ─── New / Clear ──────────────────────────────────────────────────────────────
if (newBtn) {
  newBtn.addEventListener('click', () => {
    if (!confirm('Start fresh? All unsaved work will be lost.')) return;
    _overlay?.deselect();
    sceneStore.clearCanvas();
    sceneStore.clearDB();
    updateMetaInputs();
    scheduleRender();
    showToast('New canvas ready');
  });
}

// ─── Preview toggle ───────────────────────────────────────────────────────────
if (previewBtn) {
  previewBtn.addEventListener('click', () => {
    _cleanPreview = !_cleanPreview;
    previewBtn.classList.toggle('is-active', _cleanPreview);
    previewBtn.title = _cleanPreview ? 'Exit preview (Space)' : 'Clean preview (Space)';
    scheduleRender();
  });
}

document.addEventListener('keydown', e => {
  if (e.key === ' ' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    if (previewBtn) previewBtn.click();
  }
});

// ─── Export ───────────────────────────────────────────────────────────────────
const EXPORT_PRESETS = {
  '1080x1350':  { w: 1080,  h: 1350,  label: '1080 × 1350  (Instagram 1×)' },
  '2160x2700':  { w: 2160,  h: 2700,  label: '2160 × 2700  (High Quality 2×)' },
  '1080x1920':  { w: 1080,  h: 1920,  label: '1080 × 1920  (Story 9:16)' },
  '1000x1500':  { w: 1000,  h: 1500,  label: '1000 × 1500  (Pinterest 2:3)' },
};

if (exportBtn) {
  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true;
    exportBtn.textContent = 'Rendering…';
    try {
      await document.fonts.ready;
      const preset  = EXPORT_PRESETS[_exportPreset] || EXPORT_PRESETS['2160x2700'];
      const offCanvas = document.createElement('canvas');
      renderScene(
        offCanvas.getContext('2d'),
        sceneStore.scene,
        sceneStore.assets,
        { targetWidth: preset.w, targetHeight: preset.h, isExport: true, editorState: {} }
      );

      const mimeType = 'image/jpeg';
      offCanvas.toBlob(blob => {
        if (!blob) { showToast('Export failed'); return; }
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href  = url;
        link.download = `PocketFrames_${preset.w}x${preset.h}.jpg`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showToast('Downloaded ✓');
      }, mimeType, 0.95);
    } catch (err) {
      console.error(err);
      showToast('Export error');
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = '↓ Export';
    }
  });
}

formatBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    _exportPreset = btn.dataset.exportFormat;
    formatBtns.forEach(b => b.classList.toggle('is-active', b === btn));
    const preset = EXPORT_PRESETS[_exportPreset];
    if (preset) showToast(preset.label);
  });
});

// ─── Overlay selection → properties panel ────────────────────────────────────
// (wired after overlay init)

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('is-visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2400);
}

// ─── Sticker search wiring ────────────────────────────────────────────────────
if (stickerSearch) {
  stickerSearch.addEventListener('input', () => {
    buildStickerGrid(stickerSearch.value.trim());
  });
}

// ─── Washi tape element buttons ───────────────────────────────────────────────
function addTapeElement(orientation = 'h') {
  const ap  = getFrameById(sceneStore.scene.frame.id)?.apertures?.[0];
  const el  = {
    id: `el-tape-${Date.now()}`,
    type: 'tape',
    assetId: null,
    x: ap ? ap.x + 80 : 200,
    y: ap ? ap.y + ap.h / 2 : LOGICAL_H / 2 - 30,
    w: orientation === 'h' ? 420 : 80,
    h: orientation === 'h' ? 60 : 420,
    rotation: orientation === 'h' ? (Math.random() - 0.5) * 10 : (Math.random() - 0.5) * 10,
    scaleX: 1, scaleY: 1,
    opacity: 0.85,
    zIndex: Date.now(),
    visible: true, locked: false,
    flipX: false, flipY: false,
    shadow: false, text: null,
    style: { color: ['rgba(220,210,180,0.75)','rgba(180,220,200,0.75)','rgba(200,180,220,0.75)'][Math.floor(Math.random()*3)] }
  };
  sceneStore.addElement(el);
  _overlay?.selectElement(el.id);
  scheduleRender();
  showToast('Washi tape added');
}

const addTapeBtn  = document.getElementById('v2-add-tape');
const addTapeHBtn = document.getElementById('v2-add-tape-h');
if (addTapeBtn)  addTapeBtn.addEventListener('click',  () => addTapeElement('h'));
if (addTapeHBtn) addTapeHBtn.addEventListener('click', () => addTapeElement('v'));

// ─── Resize observer ─────────────────────────────────────────────────────────
new ResizeObserver(sizeCanvas).observe(document.getElementById('v2-canvas-area'));

// ─── Theme Switcher (Light / Dark / Auto) ────────────────────────────────────
function initThemeSwitcher() {
  const THEME_KEY = 'pocketframes-theme';
  let currentChoice = document.documentElement.getAttribute('data-theme-choice') || localStorage.getItem(THEME_KEY) || 'auto';

  function systemPrefersLight() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  }

  function applyTheme(choice) {
    currentChoice = choice;
    const resolved = choice === 'auto' ? (systemPrefersLight() ? 'light' : 'dark') : choice;
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-choice', choice);
    document.body.setAttribute('data-theme', resolved);

    document.querySelectorAll('.theme-switch__btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.themeChoice === choice);
    });

    try {
      localStorage.setItem(THEME_KEY, choice);
    } catch (e) {}

    scheduleRender();
  }

  applyTheme(currentChoice);

  document.querySelectorAll('.theme-switch__btn').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeChoice));
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (currentChoice === 'auto') applyTheme('auto');
    });
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
  initThemeSwitcher();
  sizeCanvas();

  // Restore session
  const restored = await sceneStore.loadFromDB();
  if (restored) showToast('Session restored');

  // Set up overlay controller
  _overlay = new OverlayController(overlayEl, canvas, getScale);
  _overlay.onSelectionChange(id => {
    showPropsForSelected(id);
    scheduleRender();
  });

  // Set up liquid glass canvas resizer
  const canvasWrap = document.getElementById('v2-canvas-wrap');
  const canvasArea = document.getElementById('v2-canvas-area');

  v2Resizer = new CanvasResizer(canvas, canvasWrap, () => {
    scheduleRender();
    if (_overlay) _overlay.onScaleChange();
  }, {
    prefix: 'v2',
    canvasArea: canvasArea,
    overlayEl: overlayEl,
    aspectRatio: LOGICAL_H / LOGICAL_W,
    storageKey: 'pocketframes-v2-canvas-width',
    defaultWidth: 400,
    defaultFit: true,
    setHeight: true,
    fitPaddingBottom: 90
  });

  // Canvas click → hit test elements
  canvas.addEventListener('pointerdown', e => {
    if (_panState) return;
    const hit = _overlay.hitTestCanvas(e.clientX, e.clientY);
    if (!hit) _panState = {   // start pan if no element hit
      startX: e.clientX, startY: e.clientY,
      startPX: sceneStore.scene.photos?.[0]?.x || 0,
      startPY: sceneStore.scene.photos?.[0]?.y || 0
    };
  }, { capture: true });

  // Sticker preload + panels
  await preloadStickers();
  buildStickerPackTabs();
  buildStickerGrid();
  buildFrameCategoryTabs();
  buildFrameGrid();

  // Metadata
  updateMetaInputs();

  // Subscribe to scene changes → re-render
  sceneStore.subscribe(() => { scheduleRender(); });

  // Start render loop
  renderLoop();

  // Default tab
  activateTab('photo');

  // Default font btn
  textFontBtns[0]?.classList.add('is-active');
}

init().catch(console.error);

