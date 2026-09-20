/**
 * Pocket Frames V2 — Studio Application Coordinator
 * Wires scene state, renderer, overlay, sidebar panels, and export together.
 */

import { sceneStore, createPhotoEntry, createStickerElement, createTextElement, LOGICAL_W, LOGICAL_H } from './scene.js';
import { renderScene, renderFrameThumbnail } from './sceneRenderer.js';
import { OverlayController } from './overlayController.js';
import { FRAME_CATALOG, FRAME_CATEGORIES, getFrameById } from './frameDefinitions.js';
import {
  STICKER_CATALOG,
  STICKER_PACKS,
  getStickersByPack,
  searchStickers,
  setCustomStickerData,
  getAllStickers,
  getActivePacks
} from './stickerCatalog.js';
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

// Global dev backdoor state for direct collection actions
let _devUnlocked = false;
let _devPin = '';
let _pendingDevAction = null;
let _openPinModalFn = null;

async function executeDeleteCollection(packId, packLabel = '') {
  try {
    const res = await fetch('/api/stickers?action=delete-group', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${_devPin || '7788'}`
      },
      body: JSON.stringify({ packId: packId, pin: _devPin || '7788' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Collection "${packLabel || packId}" deleted`);
      _activePack = 'all';
      await preloadStickers();
      buildStickerPackTabs();
      buildStickerGrid();
      // Also update dev modal collections if opened
      const popGroup = document.getElementById('v2-dev-target-group');
      if (popGroup) {
        // Trigger dev collections re-render if function exists
        window.dispatchEvent(new CustomEvent('stickers-catalog-updated'));
      }
    } else {
      showToast(`Error: ${data.error || 'Could not delete collection'}`);
    }
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

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
const propTextGroup  = document.getElementById('v2-prop-text-group');
const propTextInput  = document.getElementById('v2-prop-text-input');
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
let _targetApertureIndex = 0;

// ─── Scale helpers ────────────────────────────────────────────────────────────
function getScale() {
  const w = (v2Resizer && v2Resizer.currentWidth) ? v2Resizer.currentWidth : (canvas.clientWidth || 400);
  return Math.max(0.05, w / LOGICAL_W);
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
    try {
      const w = Math.max(200, Math.round(v2Resizer?.currentWidth || canvas.clientWidth || 400));
      const h = Math.max(250, Math.round(w * (LOGICAL_H / LOGICAL_W)));

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
      // NOTE: updateLayersPanel() & updateUndoRedo() moved to sceneStore.subscribe
      // so continuous 60fps pan/zoom never causes DOM layout thrashing.
    } catch (renderErr) {
      console.error('Studio render loop error:', renderErr);
    }
  }
  _raf = requestAnimationFrame(renderLoop);
}

// ─── Canvas sizing ─────────────────────────────────────────────────────────────
function sizeCanvas() {
  if (v2Resizer) {
    if (v2Resizer.isFitMode) {
      v2Resizer.fitToScreen();
    } else {
      const maxW = v2Resizer.getMaxWidth();
      if (v2Resizer.currentWidth > maxW) {
        v2Resizer.applyWidth(maxW, false);
      }
    }
    return;
  }
  const area   = document.getElementById('v2-canvas-area');
  if (!area) return;
  const areaH  = Math.max(200, area.clientHeight - 85);
  const areaW  = Math.max(200, area.clientWidth  - 48);
  const aspect = LOGICAL_H / LOGICAL_W;

  let w = areaW;
  let h = w * aspect;
  if (h > areaH) { h = areaH; w = h / aspect; }

  w = Math.max(200, Math.floor(w));
  h = Math.max(250, Math.floor(h));

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

    // Auto-fit scale to the targeted aperture
    const frameDef = getFrameById(sceneStore.scene.frame.id);
    const targetIdx = _targetApertureIndex >= 0 ? _targetApertureIndex : 0;
    const ap = frameDef?.apertures?.[targetIdx] || frameDef?.apertures?.[0];
    if (ap && asset) {
      const fitScaleX = ap.w / asset.w;
      const fitScaleY = ap.h / asset.h;
      entry.scale = Math.max(fitScaleX, fitScaleY);
    }

    sceneStore.setPhotoAt(targetIdx, entry);

    // Parse EXIF if available
    tryReadExif(file);
    scheduleRender();
    showToast(`Photo loaded for slot ${targetIdx + 1} ✓`);
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

// ─── Photo pan & element interaction ──────────────────────────────────────────
let _panState = null;

canvas.addEventListener('pointerdown', e => {
  // 1. First priority: Check if an element was clicked!
  const hitEl = _overlay?.hitTest(e.clientX, e.clientY);
  if (hitEl) {
    _overlay.selectElement(hitEl.id);
    _overlay.startDrag(e);
    scheduleRender();
    return;
  }

  // 2. Clicked empty space or aperture -> deselect element
  _overlay?.deselect();

  // 3. Find aperture under pointer
  const rect = canvas.getBoundingClientRect();
  const scale = getScale();
  const lx = (e.clientX - rect.left) / scale;
  const ly = (e.clientY - rect.top) / scale;

  const frameDef = getFrameById(sceneStore.scene.frame.id);
  const apertures = frameDef?.apertures || [];
  const apIdx = apertures.findIndex(ap => 
    lx >= ap.x && lx <= ap.x + ap.w && ly >= ap.y && ly <= ap.y + ap.h
  );

  if (apIdx !== -1) {
    _targetApertureIndex = apIdx;
    const photo = sceneStore.scene.photos?.[apIdx];
    if (!photo) {
      // Empty aperture slot -> open file picker
      fileInput.click();
      return;
    }

    // Existing photo -> pan
    _panState = {
      apertureIndex: apIdx,
      photo: photo,
      photoId: photo.id,
      startX: e.clientX,
      startY: e.clientY,
      startPX: photo.x || 0,
      startPY: photo.y || 0,
      hasMoved: false
    };
    canvas.setPointerCapture(e.pointerId);
  } else {
    // Outside apertures: if first aperture empty, trigger upload
    if (!sceneStore.scene.photos?.length || !sceneStore.scene.photos[0]) {
      _targetApertureIndex = 0;
      fileInput.click();
    }
  }
});

canvas.addEventListener('pointermove', e => {
  if (!_panState) return;
  const scale = getScale();
  const dx = (e.clientX - _panState.startX) / scale;
  const dy = (e.clientY - _panState.startY) / scale;

  // Ultra-fast direct mutation for buttery-smooth 60-120fps drag
  _panState.photo.x = _panState.startPX + dx;
  _panState.photo.y = _panState.startPY + dy;
  _panState.hasMoved = true;
  scheduleRender();
});

function finishPhotoPan() {
  if (_panState && _panState.hasMoved) {
    // Commit final position to store history & autosave
    sceneStore.updatePhotoAt(_panState.apertureIndex, {
      x: _panState.photo.x,
      y: _panState.photo.y
    });
  }
  _panState = null;
}

canvas.addEventListener('pointerup', finishPhotoPan);
canvas.addEventListener('pointercancel', finishPhotoPan);

let _wheelSaveTimer = null;
function debouncedWheelSave(apIdx) {
  clearTimeout(_wheelSaveTimer);
  _wheelSaveTimer = setTimeout(() => {
    const photo = sceneStore.scene.photos?.[apIdx];
    if (photo) {
      sceneStore.updatePhotoAt(apIdx, {
        scale: photo.scale,
        x: photo.x,
        y: photo.y
      });
    }
  }, 200);
}

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scale = getScale();
  const lx = (e.clientX - rect.left) / scale;
  const ly = (e.clientY - rect.top) / scale;

  const frameDef = getFrameById(sceneStore.scene.frame.id);
  const apertures = frameDef?.apertures || [];
  let apIdx = apertures.findIndex(ap => 
    lx >= ap.x && lx <= ap.x + ap.w && ly >= ap.y && ly <= ap.y + ap.h
  );
  if (apIdx === -1) apIdx = _targetApertureIndex || 0;

  const photo = sceneStore.scene.photos?.[apIdx];
  if (!photo) return;
  const ap = apertures[apIdx] || apertures[0];

  // Silky smooth exponential zoom (handles trackpads & mouse wheels gracefully)
  const clampedDelta = Math.max(-120, Math.min(120, e.deltaY));
  const zoomFactor = Math.exp(-clampedDelta * 0.0035);
  const oldScale = photo.scale || 1;
  const newScale = Math.max(0.05, Math.min(15, oldScale * zoomFactor));

  if (Math.abs(newScale - oldScale) > 0.0001) {
    if (ap) {
      // Zoom centered at cursor focal point (lx, ly)
      const acx = ap.x + ap.w / 2;
      const acy = ap.y + ap.h / 2;
      const curPX = photo.x || 0;
      const curPY = photo.y || 0;
      const relX = lx - (acx + curPX);
      const relY = ly - (acy + curPY);
      const ratio = newScale / oldScale;
      photo.x = curPX - relX * (ratio - 1);
      photo.y = curPY - relY * (ratio - 1);
    }
    photo.scale = newScale;
    scheduleRender();
    debouncedWheelSave(apIdx);
  }
}, { passive: false });

canvas.addEventListener('dblclick', e => {
  const hitEl = _overlay?.hitTest(e.clientX, e.clientY);
  if (hitEl) {
    _overlay.selectElement(hitEl.id);
    if (hitEl.text !== undefined || hitEl.type === 'text' || hitEl.type === 'badge' || hitEl.type === 'tag') {
      propTextInput?.focus();
      propTextInput?.select();
    }
  }
});

// ─── Sticker panel ────────────────────────────────────────────────────────────
// Pre-load all SVGs and custom sticker images as assets
async function preloadStickers() {
  try {
    const res = await fetch('/api/stickers');
    if (res.ok) {
      const data = await res.json();
      setCustomStickerData(data);
    }
  } catch (err) {
    console.warn('[StudioApp] Could not load dynamic stickers from backend:', err);
  }

  const all = getAllStickers();
  const promises = all.map(sticker => {
    if (sticker.svg) {
      return sceneStore.registerSvgAsset(sticker.id, sticker.svg);
    } else if (sticker.url) {
      return sceneStore.registerImageAsset(sticker.id, sticker.url, sticker.width || 200, sticker.height || 200);
    }
    return Promise.resolve();
  });
  await Promise.all(promises);
}

function buildStickerPackTabs() {
  if (!stickerPackBtns) return;
  stickerPackBtns.innerHTML = '';
  const packs = getActivePacks();

  // If current active pack was deleted, fall back to 'all'
  if (!packs.some(p => p.id === _activePack)) {
    _activePack = 'all';
  }

  packs.forEach(pack => {
    const btn = document.createElement('button');
    const isActive = pack.id === _activePack;
    btn.className = `chip v2-pack-tab ${isActive ? 'active is-active' : ''}`;
    btn.dataset.pack = pack.id;
    btn.innerHTML = `<span>${pack.emoji}</span> <span>${pack.label}</span>${pack.count !== undefined ? ` <small style="opacity:0.65;font-size:10px;">(${pack.count})</small>` : ''}`;
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

  // Active pack action bar in sidebar (shows count & direct Delete button)
  const activePackBar = document.getElementById('v2-active-pack-bar');
  if (activePackBar) {
    if (_activePack !== 'all' && !query) {
      const packObj = getActivePacks().find(p => p.id === _activePack);
      if (packObj) {
        activePackBar.style.display = 'flex';
        activePackBar.innerHTML = `
          <span class="v2-active-pack-title">${packObj.emoji || '✦'} ${packObj.label} <small>(${packObj.count} stickers)</small></span>
          <button type="button" class="v2-delete-active-pack-btn" title="Delete entire ${packObj.label} collection">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>Delete Group</span>
          </button>
        `;

        const delBtn = activePackBar.querySelector('.v2-delete-active-pack-btn');
        let confirmPending = false;
        let confirmTimer = null;

        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();

          if (!_devUnlocked || !_devPin) {
            _pendingDevAction = () => executeDeleteCollection(packObj.id, packObj.label);
            if (_openPinModalFn) _openPinModalFn();
            return;
          }

          if (!confirmPending) {
            confirmPending = true;
            delBtn.classList.add('is-confirming');
            delBtn.innerHTML = `<span>⚠️ Confirm delete?</span>`;
            confirmTimer = setTimeout(() => {
              confirmPending = false;
              delBtn.classList.remove('is-confirming');
              delBtn.innerHTML = `
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <span>Delete Group</span>
              `;
            }, 3500);
            return;
          }

          clearTimeout(confirmTimer);
          delBtn.disabled = true;
          delBtn.textContent = 'Deleting...';
          await executeDeleteCollection(packObj.id, packObj.label);
        });
      } else {
        activePackBar.style.display = 'none';
        activePackBar.innerHTML = '';
      }
    } else {
      activePackBar.style.display = 'none';
      activePackBar.innerHTML = '';
    }
  }

  const list = query
    ? searchStickers(query)
    : getStickersByPack(_activePack);

  if (list.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'v2-layers-empty';
    emptyMsg.style.gridColumn = '1 / -1';
    emptyMsg.style.padding = '24px 12px';
    emptyMsg.textContent = 'No stickers found in this collection.';
    stickerGrid.appendChild(emptyMsg);
    return;
  }

  list.forEach(sticker => {
    const tile = document.createElement('div');
    tile.className = 'v2-sticker-tile';
    tile.title = sticker.name;

    // Preview via canvas or image
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
  // Stay on sticker tab so user can add multiple stickers seamlessly
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
    layersList.innerHTML = '<div class="v2-layers-empty" style="font-family:var(--hand);font-size:13px;padding:8px 4px;color:var(--muted);">No active elements on canvas.</div>';
  } else {
    sorted.forEach(el => {
      const row = document.createElement('div');
      const isSelected = el.id === _overlay?.selectedId;
      row.className = `lay layer-row ${isSelected ? 'on is-selected' : ''}`;
      row.dataset.id = el.id;

      // Icon based on type
      let icon = '✿';
      let friendlyName = 'Element';
      if (el.type === 'text') {
        icon = '✎';
        friendlyName = el.text ? `"${el.text.slice(0, 18)}"` : 'Text';
      } else if (el.type === 'badge') {
        icon = '🏷';
        friendlyName = el.text ? `badge: ${el.text.slice(0, 16)}` : 'Badge';
      } else if (el.type === 'tag') {
        icon = '🔖';
        friendlyName = el.text ? `tag: ${el.text.slice(0, 16)}` : 'Tag';
      } else if (el.type === 'sticker') {
        icon = '✿';
        const st = STICKER_CATALOG.find(s => s.id === el.assetId);
        friendlyName = st ? st.name : 'Sticker';
      } else if (el.type === 'bow') {
        icon = '🎀';
        friendlyName = 'Bow';
      } else if (el.type === 'envelope') {
        icon = '✉';
        friendlyName = 'Envelope';
      } else if (el.type === 'clip') {
        icon = '📎';
        friendlyName = 'Clip';
      } else if (el.type === 'seal' || el.type === 'stamp') {
        icon = '⌗';
        friendlyName = el.type === 'seal' ? 'Wax seal' : 'Stamp';
      } else if (el.type === 'tape') {
        icon = '▭';
        friendlyName = 'Tape strip';
      } else if (el.type === 'button-deco') {
        icon = '🔘';
        friendlyName = 'Button';
      } else if (el.type === 'club-suit') {
        icon = '♣';
        friendlyName = 'Card suit';
      } else if (el.type === 'crosshair') {
        icon = '⌖';
        friendlyName = 'Crosshair';
      } else if (el.type === 'controls') {
        icon = '⚙';
        friendlyName = 'Controls';
      } else if (el.type === 'vinyl') {
        icon = '💿';
        friendlyName = 'Vinyl disc';
      }

      row.innerHTML = `
        <span class="lay-icon">${icon}</span>
        <span class="nm">${friendlyName}</span>
        <button type="button" class="v2-lay-btn v2-lay-up" data-id="${el.id}" title="Move forward">↑</button>
        <button type="button" class="v2-lay-btn v2-lay-down" data-id="${el.id}" title="Move backward">↓</button>
        <button type="button" class="v2-lay-btn v2-lay-vis" data-id="${el.id}" title="${el.visible ? 'Hide layer' : 'Show layer'}">${el.visible ? '◌' : '●'}</button>
        <button type="button" class="v2-lay-btn v2-lay-lock" data-id="${el.id}" title="${el.locked ? 'Unlock' : 'Lock'}">${el.locked ? '🔒' : '🔓'}</button>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        _overlay?.selectElement(el.id);
        scheduleRender();
      });

      row.querySelector('.v2-lay-up').addEventListener('click', e => {
        e.stopPropagation();
        sceneStore.reorderElement(el.id, 'up');
        scheduleRender();
      });

      row.querySelector('.v2-lay-down').addEventListener('click', e => {
        e.stopPropagation();
        sceneStore.reorderElement(el.id, 'down');
        scheduleRender();
      });

      row.querySelector('.v2-lay-vis').addEventListener('click', e => {
        e.stopPropagation();
        sceneStore.updateElement(el.id, { visible: !el.visible });
        scheduleRender();
      });

      row.querySelector('.v2-lay-lock').addEventListener('click', e => {
        e.stopPropagation();
        sceneStore.updateElement(el.id, { locked: !el.locked });
        scheduleRender();
      });

      layersList.appendChild(row);
    });
  }

  // Also show photo aperture slots in layers list
  const frameDef = getFrameById(sceneStore.scene.frame.id);
  const apertures = frameDef?.apertures || [];
  apertures.forEach((ap, idx) => {
    const slotRow = document.createElement('div');
    const photo = sceneStore.scene.photos?.[idx];
    slotRow.className = 'lay slot';
    slotRow.innerHTML = `<span>📷</span><span class="nm">${photo ? `photo ${idx + 1}` : `photo slot ${idx + 1}`}</span>`;
    slotRow.addEventListener('click', () => {
      _targetApertureIndex = idx;
      if (!photo) {
        fileInput.click();
      } else {
        showToast(`Selected photo slot ${idx + 1}`);
      }
    });
    layersList.appendChild(slotRow);
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
    b.classList.toggle('on', active);
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
let prevAreaW = 0;
let prevAreaH = 0;
const v2AreaObserver = new ResizeObserver(entries => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;
    if (width <= 0 || height <= 0) continue;
    if (Math.abs(width - prevAreaW) > 8 || Math.abs(height - prevAreaH) > 8) {
      prevAreaW = width;
      prevAreaH = height;
      sizeCanvas();
    }
  }
});
const areaEl = document.getElementById('v2-canvas-area');
if (areaEl) v2AreaObserver.observe(areaEl);

// ─── Theme Switcher (Light / Dark / Auto) ────────────────────────────────────
function initThemeSwitcher() {
  const THEME_KEY = 'pocketframes-theme';
  let currentChoice = document.documentElement.getAttribute('data-theme-choice') || localStorage.getItem(THEME_KEY) || 'auto';

  function systemPrefersLight() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  }

  function applyTheme(choice) {
    const updateDom = () => {
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
    };

    // Smooth fluid motion: use View Transitions API if supported
    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('theme-transitioning');
      const transition = document.startViewTransition(() => {
        updateDom();
      });
      transition.finished.finally(() => {
        document.documentElement.classList.remove('theme-transitioning');
      });
    } else {
      document.documentElement.classList.add('theme-transitioning');
      updateDom();
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 450);
    }
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
    if (_overlay) {
      if (typeof _overlay.refresh === 'function') _overlay.refresh();
      else if (typeof _overlay.onScaleChange === 'function') _overlay.onScaleChange();
    }
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

  // Sticker preload + panels
  await preloadStickers();
  buildStickerPackTabs();
  buildStickerGrid();
  buildFrameCategoryTabs();
  buildFrameGrid();

  // Metadata
  updateMetaInputs();

  // Subscribe to scene changes → re-render & update UI
  sceneStore.subscribe((scene, changeType) => {
    scheduleRender();
    if (!changeType || changeType === 'elements' || changeType === 'frame' || changeType === 'undo' || changeType === 'redo' || changeType === 'reset') {
      updateLayersPanel();
      updateUndoRedo();
    }
  });

  // Initial layer & undo/redo sync
  updateLayersPanel();
  updateUndoRedo();

  // Start render loop
  renderLoop();

  // Default tab
  activateTab('photo');

  // Default font btn
  textFontBtns[0]?.classList.add('is-active');

  // Initialize Developer Sticker Backdoor
  initDevStickerBackdoor();
}

// ══════════════════════════════════════════════════════════════════════════════
// DEVELOPER BACKDOOR CONTROLLER: PIN, BATCH UPLOAD (50), BG REMOVAL & DELETE
// ══════════════════════════════════════════════════════════════════════════════
function initDevStickerBackdoor() {
  const btnOpenDev       = document.getElementById('v2-open-dev-stickers');
  const pinModal         = document.getElementById('v2-dev-pin-modal');
  const pinModalClose    = document.getElementById('v2-pin-modal-close');
  const pinCard          = pinModal?.querySelector('.v2-pin-modal-card');
  const pinDots          = pinModal?.querySelectorAll('.v2-pin-dot');
  const pinError         = document.getElementById('v2-pin-error');
  const pinHiddenInput   = document.getElementById('v2-pin-hidden-input');
  const keypadBtns       = pinModal?.querySelectorAll('.v2-keypad-btn[data-num]');
  const keypadClear      = document.getElementById('v2-pin-btn-clear');
  const keypadDel        = document.getElementById('v2-pin-btn-del');

  const devModal         = document.getElementById('v2-dev-sticker-modal');
  const devModalClose    = document.getElementById('v2-dev-modal-close');
  const tabDevUpload     = document.getElementById('v2-tab-dev-upload');
  const tabDevManage     = document.getElementById('v2-tab-dev-manage');
  const sectionDevUpload = document.getElementById('v2-dev-section-upload');
  const sectionDevManage = document.getElementById('v2-dev-section-manage');

  const groupSelect      = document.getElementById('v2-dev-group-select');
  const newGroupNameInput= document.getElementById('v2-dev-new-group-name');
  const dropzone         = document.getElementById('v2-dev-dropzone');
  const fileInputBatch   = document.getElementById('v2-dev-stickers-file-input');
  const fileCountBadge   = document.getElementById('v2-dev-file-count');
  const previewBox       = document.getElementById('v2-dev-preview-box');
  const fileGrid         = document.getElementById('v2-dev-file-grid');
  const clearSelectedBtn = document.getElementById('v2-dev-clear-selected');
  const chkBgRemoval     = document.getElementById('v2-dev-chk-bg-removal');
  const chkAutoCat       = document.getElementById('v2-dev-chk-auto-cat');
  const btnSubmitUpload  = document.getElementById('v2-dev-btn-upload-submit');
  const btnSubmitLabel   = document.getElementById('v2-dev-btn-submit-label');

  const progressContainer= document.getElementById('v2-dev-progress-container');
  const progressBar      = document.getElementById('v2-dev-progress-bar');
  const progressStatus   = document.getElementById('v2-dev-progress-status');
  const progressPercent  = document.getElementById('v2-dev-progress-percent');

  const collectionsGrid  = document.getElementById('v2-dev-collections-grid');

  let devUnlocked = false;
  let devPin = '';
  let currentPin = '';
  let selectedFiles = []; // array of { file, name, dataUrl, mimeType }

  if (!btnOpenDev) return;

  // 1. PIN Modal Controls
  _openPinModalFn = openPinModal;

  btnOpenDev.addEventListener('click', () => {
    if (_devUnlocked && _devPin) {
      openDevStickerModal();
    } else {
      openPinModal();
    }
  });

  function openPinModal() {
    currentPin = '';
    updatePinDots();
    if (pinError) pinError.style.display = 'none';
    if (pinModal) pinModal.style.display = 'flex';
    pinHiddenInput?.focus();
  }

  function closePinModal() {
    if (pinModal) pinModal.style.display = 'none';
    currentPin = '';
    updatePinDots();
  }

  if (pinModalClose) pinModalClose.addEventListener('click', closePinModal);
  if (pinModal) {
    pinModal.addEventListener('click', e => {
      if (e.target === pinModal) closePinModal();
    });
  }

  function updatePinDots() {
    pinDots?.forEach((dot, idx) => {
      dot.classList.toggle('is-filled', idx < currentPin.length);
    });
  }

  async function handlePinSubmit(entered) {
    try {
      const res = await fetch('/api/stickers?action=verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: entered })
      });
      const data = await res.json();
      if (data.success) {
        _devUnlocked = true;
        _devPin = entered;
        closePinModal();
        if (typeof _pendingDevAction === 'function') {
          const fn = _pendingDevAction;
          _pendingDevAction = null;
          fn();
        } else {
          showToast('Developer backdoor unlocked');
          openDevStickerModal();
        }
      } else {
        triggerPinError();
      }
    } catch (err) {
      // Fallback check
      if (entered === '7788') {
        _devUnlocked = true;
        _devPin = entered;
        closePinModal();
        if (typeof _pendingDevAction === 'function') {
          const fn = _pendingDevAction;
          _pendingDevAction = null;
          fn();
        } else {
          showToast('Developer backdoor unlocked');
          openDevStickerModal();
        }
      } else {
        triggerPinError();
      }
    }
  }

  function triggerPinError() {
    if (pinError) pinError.style.display = 'block';
    if (pinCard) pinCard.classList.add('is-shaking');
    setTimeout(() => {
      if (pinCard) pinCard.classList.remove('is-shaking');
      currentPin = '';
      updatePinDots();
      if (pinHiddenInput) pinHiddenInput.value = '';
    }, 500);
  }

  function addPinChar(ch) {
    if (currentPin.length < 4 && /^[0-9]$/.test(ch)) {
      currentPin += ch;
      updatePinDots();
      if (currentPin.length === 4) {
        handlePinSubmit(currentPin);
      }
    }
  }

  keypadBtns?.forEach(btn => {
    btn.addEventListener('click', () => addPinChar(btn.dataset.num));
  });

  if (keypadClear) {
    keypadClear.addEventListener('click', () => {
      currentPin = '';
      updatePinDots();
      if (pinError) pinError.style.display = 'none';
    });
  }

  if (keypadDel) {
    keypadDel.addEventListener('click', () => {
      currentPin = currentPin.slice(0, -1);
      updatePinDots();
      if (pinError) pinError.style.display = 'none';
    });
  }

  if (pinHiddenInput) {
    pinHiddenInput.addEventListener('input', e => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      currentPin = val.slice(0, 4);
      updatePinDots();
      if (currentPin.length === 4) {
        handlePinSubmit(currentPin);
      }
    });
  }

  // 2. Developer Modal Controls
  function openDevStickerModal() {
    if (devModal) devModal.style.display = 'flex';
    populateGroupSelect();
    renderManageCollections();
    switchDevTab('upload');
  }

  function closeDevStickerModal() {
    if (devModal) devModal.style.display = 'none';
  }

  if (devModalClose) devModalClose.addEventListener('click', closeDevStickerModal);
  if (devModal) {
    devModal.addEventListener('click', e => {
      if (e.target === devModal) closeDevStickerModal();
    });
  }

  function switchDevTab(tab) {
    const isUpload = tab === 'upload';
    tabDevUpload?.classList.toggle('is-active', isUpload);
    tabDevManage?.classList.toggle('is-active', !isUpload);
    if (sectionDevUpload) sectionDevUpload.style.display = isUpload ? 'flex' : 'none';
    if (sectionDevManage) sectionDevManage.style.display = !isUpload ? 'flex' : 'none';
    if (!isUpload) renderManageCollections();
  }

  tabDevUpload?.addEventListener('click', () => switchDevTab('upload'));
  tabDevManage?.addEventListener('click', () => switchDevTab('manage'));

  // Populate Group Select Dropdown
  function populateGroupSelect() {
    if (!groupSelect) return;
    const currentVal = groupSelect.value;
    groupSelect.innerHTML = `
      <option value="__new__">+ Create New Group (e.g. Summer Vibes)</option>
      <option value="__auto__">🤖 AI Auto-Categorize with Gemini (floral, mirrors, ocean...)</option>
    `;

    const activePacks = getActivePacks().filter(p => p.id !== 'all');
    activePacks.forEach(pack => {
      const opt = document.createElement('option');
      opt.value = pack.id;
      opt.textContent = `${pack.emoji} ${pack.label} (${pack.count} stickers)`;
      groupSelect.appendChild(opt);
    });

    if (currentVal && Array.from(groupSelect.options).some(o => o.value === currentVal)) {
      groupSelect.value = currentVal;
    } else {
      groupSelect.value = '__new__';
    }
    updateGroupInputVisibility();
  }

  function updateGroupInputVisibility() {
    if (!newGroupNameInput || !groupSelect) return;
    const isNew = groupSelect.value === '__new__';
    newGroupNameInput.style.display = isNew ? 'block' : 'none';
    if (chkAutoCat) {
      if (groupSelect.value === '__auto__') {
        chkAutoCat.checked = true;
      }
    }
  }

  groupSelect?.addEventListener('change', updateGroupInputVisibility);

  // 3. Dropzone & File Selection (Limit: 50 files)
  dropzone?.addEventListener('click', () => fileInputBatch?.click());

  dropzone?.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });

  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));

  dropzone?.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    if (e.dataTransfer?.files) {
      handleBatchFilesSelected(e.dataTransfer.files);
    }
  });

  fileInputBatch?.addEventListener('change', e => {
    if (e.target.files) {
      handleBatchFilesSelected(e.target.files);
    }
  });

  function handleBatchFilesSelected(fileList) {
    const rawArr = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (rawArr.length === 0) {
      showToast('Please select valid image files (PNG, JPG, WebP, SVG)');
      return;
    }

    // Limit check: 50 files max
    let filesToAdd = rawArr;
    if (selectedFiles.length + filesToAdd.length > 50) {
      const allowed = 50 - selectedFiles.length;
      if (allowed <= 0) {
        showToast('Maximum batch limit of 50 stickers reached.');
        return;
      }
      filesToAdd = filesToAdd.slice(0, allowed);
      showToast(`Batch limit is 50 stickers. Added first ${allowed} files.`);
    }

    let loadedCount = 0;
    filesToAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = evt => {
        selectedFiles.push({
          file,
          name: file.name,
          dataUrl: evt.target.result,
          mimeType: file.type || 'image/png'
        });
        loadedCount++;
        if (loadedCount === filesToAdd.length) {
          updateSelectedFilesUI();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function updateSelectedFilesUI() {
    if (!fileGrid || !fileCountBadge || !btnSubmitUpload || !btnSubmitLabel) return;

    fileCountBadge.textContent = `${selectedFiles.length} / 50 selected`;
    btnSubmitLabel.textContent = `Upload & Process ${selectedFiles.length} Sticker${selectedFiles.length === 1 ? '' : 's'}`;
    btnSubmitUpload.disabled = selectedFiles.length === 0;

    if (previewBox) {
      previewBox.style.display = selectedFiles.length > 0 ? 'block' : 'none';
    }

    fileGrid.innerHTML = '';
    selectedFiles.forEach((item, idx) => {
      const chip = document.createElement('div');
      chip.className = 'v2-dev-file-chip';
      chip.title = item.name;

      const img = document.createElement('img');
      img.src = item.dataUrl;
      chip.appendChild(img);

      const delBtn = document.createElement('button');
      delBtn.className = 'v2-dev-file-chip-del';
      delBtn.innerHTML = '✕';
      delBtn.title = 'Remove sticker';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        selectedFiles.splice(idx, 1);
        updateSelectedFilesUI();
      });
      chip.appendChild(delBtn);

      fileGrid.appendChild(chip);
    });
  }

  clearSelectedBtn?.addEventListener('click', () => {
    selectedFiles = [];
    if (fileInputBatch) fileInputBatch.value = '';
    updateSelectedFilesUI();
  });

  // 4. Batch Upload Submission to Backend
  btnSubmitUpload?.addEventListener('click', async () => {
    if (selectedFiles.length === 0 || !devPin) return;

    const isAutoCat = groupSelect?.value === '__auto__';
    const isNew = groupSelect?.value === '__new__';
    const groupName = isAutoCat ? '' : (isNew ? (newGroupNameInput?.value || 'Custom') : groupSelect?.value);

    // Lock UI and show progress
    btnSubmitUpload.disabled = true;
    if (progressContainer) progressContainer.style.display = 'flex';
    if (progressBar) progressBar.style.width = '10%';
    if (progressStatus) progressStatus.textContent = `Processing ${selectedFiles.length} sticker(s) with Gemini AI...`;
    if (progressPercent) progressPercent.textContent = '10%';

    try {
      const payload = {
        pin: devPin,
        targetGroup: groupName,
        autoCategorize: isAutoCat || chkAutoCat?.checked,
        removeBackground: chkBgRemoval?.checked !== false,
        files: selectedFiles.map(f => ({
          name: f.name,
          data: f.dataUrl,
          mimeType: f.mimeType
        }))
      };

      if (progressBar) progressBar.style.width = '45%';
      if (progressStatus) progressStatus.textContent = 'Removing backgrounds via Gemini Flash 2.5 Image API...';
      if (progressPercent) progressPercent.textContent = '45%';

      const res = await fetch('/api/stickers?action=upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${devPin}`
        },
        body: JSON.stringify(payload)
      });

      if (progressBar) progressBar.style.width = '85%';
      if (progressPercent) progressPercent.textContent = '85%';

      // Check HTTP status BEFORE parsing JSON
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch { /* ignore parse errors */ }
        throw new Error(errMsg);
      }

      const result = await res.json();

      if (result.success) {
        if (progressBar) progressBar.style.width = '100%';
        if (progressStatus) progressStatus.textContent = `Complete! ${result.uploaded} stickers processed.`;
        if (progressPercent) progressPercent.textContent = '100%';

        showToast(`Successfully added ${result.uploaded} stickers!`);

        // Refresh dynamic stickers in memory and UI
        await preloadStickers();
        buildStickerPackTabs();

        // Switch to the target pack if applicable
        if (result.results?.[0]?.pack) {
          _activePack = result.results[0].pack;
          stickerPackBtns?.querySelectorAll('.chip, .v2-pack-tab').forEach(b => {
            const on = b.dataset.pack === _activePack;
            b.classList.toggle('active', on);
            b.classList.toggle('is-active', on);
          });
        }
        buildStickerGrid();

        // Reset upload form
        setTimeout(() => {
          selectedFiles = [];
          if (fileInputBatch) fileInputBatch.value = '';
          updateSelectedFilesUI();
          if (progressContainer) progressContainer.style.display = 'none';
          closeDevStickerModal();
        }, 1200);

      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (err) {
      console.error('[DevStickerBackdoor] Upload failed:', err);
      if (progressStatus) progressStatus.textContent = `Error: ${err.message}`;
      showToast(`Upload error: ${err.message}`);
      btnSubmitUpload.disabled = false;
    }
  });

  // 5. Manage & Delete Collections Logic
  function renderManageCollections() {
    if (!collectionsGrid) return;
    collectionsGrid.innerHTML = '';

    const packs = getActivePacks().filter(p => p.id !== 'all');

    if (packs.length === 0) {
      collectionsGrid.innerHTML = '<div class="v2-layers-empty">No active collections found.</div>';
      return;
    }

    packs.forEach(pack => {
      const card = document.createElement('div');
      card.className = 'v2-dev-col-card';

      // Header row
      const header = document.createElement('div');
      header.className = 'v2-dev-col-header';

      const nameGroup = document.createElement('div');
      nameGroup.className = 'v2-dev-col-name-group';

      const emoji = document.createElement('span');
      emoji.className = 'v2-dev-col-emoji';
      emoji.textContent = pack.emoji || '✦';

      const title = document.createElement('span');
      title.className = 'v2-dev-col-title';
      title.textContent = pack.label;

      nameGroup.appendChild(emoji);
      nameGroup.appendChild(title);

      const count = document.createElement('span');
      count.className = 'v2-dev-col-count';
      count.textContent = `${pack.count || 0} stickers`;

      header.appendChild(nameGroup);
      header.appendChild(count);
      card.appendChild(header);

      // Mini preview strip
      const stickersInPack = getStickersByPack(pack.id).slice(0, 5);
      const previewStrip = document.createElement('div');
      previewStrip.style.display = 'flex';
      previewStrip.style.gap = '6px';
      previewStrip.style.overflow = 'hidden';

      stickersInPack.forEach(stk => {
        const mini = document.createElement('canvas');
        mini.width = 36; mini.height = 36;
        mini.style.borderRadius = '4px';
        mini.style.background = 'rgba(0,0,0,0.04)';
        const mctx = mini.getContext('2d');
        const asset = sceneStore.getAsset(stk.id);
        if (asset?.img) {
          mctx.drawImage(asset.img, 0, 0, 36, 36);
        }
        previewStrip.appendChild(mini);
      });
      card.appendChild(previewStrip);

      // Delete collection button
      const delBtn = document.createElement('button');
      delBtn.className = 'v2-dev-col-delete-btn';
      delBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        <span>Delete Entire Collection</span>
      `;

      let confirmPending = false;
      let confirmTimer = null;

      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        if (!confirmPending) {
          confirmPending = true;
          delBtn.classList.add('is-confirming');
          delBtn.innerHTML = `<span>⚠️ Click again to confirm deleting "${pack.label}"</span>`;
          clearTimeout(confirmTimer);
          confirmTimer = setTimeout(() => {
            confirmPending = false;
            delBtn.classList.remove('is-confirming');
            delBtn.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              <span>Delete Entire Collection</span>
            `;
          }, 4000);
          return;
        }

        clearTimeout(confirmTimer);
        confirmPending = false;
        delBtn.disabled = true;
        delBtn.textContent = 'Deleting collection...';
        await executeDeleteCollection(pack.id, pack.label);
      });

      card.appendChild(delBtn);
      collectionsGrid.appendChild(card);
    });
  }

  window.addEventListener('stickers-catalog-updated', () => {
    populateGroupSelect();
    renderManageCollections();
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
init().catch(console.error);
