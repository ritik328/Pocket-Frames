/**
 * Pocket Frames V2 — Canonical Scene / Document State
 *
 * Architecture: STATE → RENDER. The scene is the single source of truth.
 * DOM and canvas are purely output/interaction surfaces.
 *
 * Coordinate system: logical 2160 × 2700 canvas space.
 * All element x, y, w, h are in this space. Renderers scale to viewport.
 */

import { getFrameById } from './frameDefinitions.js';

export const SCHEMA_VERSION = 1;
export const LOGICAL_W = 2160;
export const LOGICAL_H = 2700;

// ─── Default metadata ────────────────────────────────────────────────────────
export const DEFAULT_METADATA = {
  brand: 'POCKET FRAMES',
  device: '',
  focalLength: '',
  aperture: '',
  shutter: '',
  iso: '',
  caption: '',
  location: '',
  date: ''
};

// ─── Default scene ────────────────────────────────────────────────────────────
export function createDefaultScene() {
  const initialFrame = getFrameById('plain-strip') || { id: 'plain-strip', defaultElements: [] };
  const initialElements = (initialFrame.defaultElements || []).map((el, idx) => ({
    ...JSON.parse(JSON.stringify(el)),
    id: `el-${initialFrame.id}-${idx}-${Date.now()}`,
    isFrameElement: true,
    frameId: initialFrame.id,
    zIndex: idx + 1,
    rotation: el.rotation || 0,
    scaleX: 1,
    scaleY: 1,
    opacity: el.opacity ?? 1,
    visible: true,
    locked: false,
    flipX: false,
    flipY: false,
    shadow: false,
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    canvas: { width: LOGICAL_W, height: LOGICAL_H, background: '#F8F8F8' },
    frame: { id: initialFrame.id },
    photos: [],        // PhotoEntry[] - one per aperture index
    elements: initialElements, // SceneElement[]
    metadata: { ...DEFAULT_METADATA },
    settings: {
      snap: true,
      grid: true,
      guides: true
    }
  };
}

// ─── Element factory ──────────────────────────────────────────────────────────
let _eid = 1;
export function createStickerElement(assetId, x, y, size = 200) {
  return {
    id: `el-${_eid++}`,
    type: 'sticker',
    assetId,
    x, y,
    w: size, h: size,
    rotation: 0,
    scaleX: 1, scaleY: 1,
    opacity: 1,
    zIndex: _eid,
    visible: true,
    locked: false,
    flipX: false, flipY: false,
    shadow: false,
    text: null, style: null
  };
}

export function createTextElement(text, x, y) {
  return {
    id: `el-${_eid++}`,
    type: 'text',
    assetId: null,
    x, y,
    w: 600, h: 120,
    rotation: 0,
    scaleX: 1, scaleY: 1,
    opacity: 1,
    zIndex: _eid,
    visible: true,
    locked: false,
    flipX: false, flipY: false,
    shadow: false,
    text,
    style: {
      fontFamily: 'Caveat',
      fontSize: 96,
      fontWeight: '600',
      color: '#1a1a1a',
      align: 'center',
      letterSpacing: 2,
      lineHeight: 1.2
    }
  };
}

export function createPhotoEntry(assetId, w, h) {
  return {
    id: `photo-${_eid++}`,
    assetId,
    x: 0, y: 0,           // offset from aperture center (logical px)
    scale: 1,
    rotation: 0
  };
}

// ─── Command history ──────────────────────────────────────────────────────────
const MAX_HISTORY = 50;

export class SceneStore {
  constructor() {
    this._scene = createDefaultScene();
    this._history = [];   // undo stack of scene snapshots
    this._future  = [];   // redo stack
    this._listeners = new Set();
    this._assets = new Map(); // assetId → { blob, url, img, w, h, filename }
    this._saveTimer = null;
    this._dirty = false;
  }

  // ── Getters ─────────────────────────────────────────────────────────────────
  get scene()  { return this._scene; }
  get assets() { return this._assets; }

  // ── Subscriptions ────────────────────────────────────────────────────────────
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit(changeType = 'general') {
    this._dirty = true;
    this._listeners.forEach(fn => fn(this._scene, changeType));
    this._scheduleSave();
  }

  // ── History ──────────────────────────────────────────────────────────────────
  _snapshot() {
    // Deep-clone scene (no assets/blobs in scene state, safe to JSON)
    return JSON.stringify(this._scene);
  }

  _pushHistory() {
    this._history.push(this._snapshot());
    if (this._history.length > MAX_HISTORY) this._history.shift();
    this._future = [];
  }

  get canUndo() { return this._history.length > 0; }
  get canRedo()  { return this._future.length > 0; }

  undo() {
    if (!this.canUndo) return;
    this._future.push(this._snapshot());
    this._scene = JSON.parse(this._history.pop());
    this._emit('undo');
  }

  redo() {
    if (!this.canRedo) return;
    this._history.push(this._snapshot());
    this._scene = JSON.parse(this._future.pop());
    this._emit('redo');
  }

  // ── Scene mutations (all push history) ────────────────────────────────────────
  setFrame(id) {
    this._pushHistory();
    this._scene.frame.id = id;

    // Remove previous default frame elements, preserving user-added custom stickers/elements
    this._scene.elements = (this._scene.elements || []).filter(el => !el.isFrameElement);

    // Populate new frame default elements
    const frameDef = getFrameById(id);
    if (frameDef && frameDef.defaultElements?.length) {
      const cloned = frameDef.defaultElements.map((el, idx) => ({
        ...JSON.parse(JSON.stringify(el)),
        id: `el-${id}-${idx}-${Date.now()}`,
        isFrameElement: true,
        frameId: id,
        zIndex: idx + 1,
        rotation: el.rotation || 0,
        scaleX: 1,
        scaleY: 1,
        opacity: el.opacity ?? 1,
        visible: true,
        locked: false,
        flipX: false,
        flipY: false,
        shadow: false,
      }));
      this._scene.elements.push(...cloned);
    }

    this._emit('frame');
  }

  addElement(el) {
    this._pushHistory();
    this._scene.elements.push(el);
    this._emit('elements');
    return el;
  }

  updateElement(id, partial) {
    const el = this._scene.elements.find(e => e.id === id);
    if (!el) return;
    Object.assign(el, partial);
    this._emit('elements');
  }

  updateElementWithHistory(id, partial) {
    this._pushHistory();
    this.updateElement(id, partial);
  }

  deleteElement(id) {
    this._pushHistory();
    this._scene.elements = this._scene.elements.filter(e => e.id !== id);
    this._emit('elements');
  }

  duplicateElement(id) {
    this._pushHistory();
    const el = this._scene.elements.find(e => e.id === id);
    if (!el) return null;
    const clone = JSON.parse(JSON.stringify(el));
    clone.id = `el-${_eid++}`;
    clone.zIndex = (Math.max(...this._scene.elements.map(e => e.zIndex), 0)) + 1;
    clone.x += 40; clone.y += 40;
    this._scene.elements.push(clone);
    this._emit('elements');
    return clone;
  }

  reorderElement(id, direction) { // 'up' | 'down' | 'front' | 'back'
    this._pushHistory();
    const sorted = [...this._scene.elements].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex(e => e.id === id);
    if (idx === -1) return;

    if (direction === 'front') {
      sorted[idx].zIndex = (Math.max(...sorted.map(e => e.zIndex))) + 1;
    } else if (direction === 'back') {
      sorted[idx].zIndex = (Math.min(...sorted.map(e => e.zIndex))) - 1;
    } else if (direction === 'up' && idx < sorted.length - 1) {
      const tmp = sorted[idx].zIndex;
      sorted[idx].zIndex = sorted[idx + 1].zIndex;
      sorted[idx + 1].zIndex = tmp;
    } else if (direction === 'down' && idx > 0) {
      const tmp = sorted[idx].zIndex;
      sorted[idx].zIndex = sorted[idx - 1].zIndex;
      sorted[idx - 1].zIndex = tmp;
    }
    this._emit('elements');
  }

  setPhoto(photoEntry) {
    this.setPhotoAt(0, photoEntry);
  }

  setPhotoAt(index, photoEntry) {
    this._pushHistory();
    if (!Array.isArray(this._scene.photos)) {
      this._scene.photos = [];
    }
    this._scene.photos[index] = photoEntry;
    this._emit('photo');
  }

  updatePhoto(id, partial) {
    const p = this._scene.photos?.find(p => p && p.id === id);
    if (p) {
      Object.assign(p, partial);
      this._emit('photo');
    }
  }

  updatePhotoAt(index, partial) {
    const p = this._scene.photos?.[index];
    if (p) {
      Object.assign(p, partial);
      this._emit('photo');
    }
  }

  setMetadata(partial) {
    Object.assign(this._scene.metadata, partial);
    this._emit('metadata');
  }

  setSettings(partial) {
    Object.assign(this._scene.settings, partial);
    this._emit('settings');
  }

  clearCanvas() {
    this._pushHistory();
    this._scene = createDefaultScene();
    this._emit('reset');
  }

  // ── Asset registry ─────────────────────────────────────────────────────────
  registerAsset(assetId, blob, filename) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        this._assets.set(assetId, { blob, url, img, w: img.naturalWidth, h: img.naturalHeight, filename });
        resolve(assetId);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  registerSvgAsset(assetId, svgString) {
    return new Promise((resolve) => {
      const encoded = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      const img = new Image();
      img.onload = () => {
        this._assets.set(assetId, { svg: svgString, url: encoded, img, w: img.naturalWidth || 100, h: img.naturalHeight || 100 });
        resolve(assetId);
      };
      img.onerror = () => {
        // fallback: still register
        this._assets.set(assetId, { svg: svgString, url: encoded, img, w: 100, h: 100 });
        resolve(assetId);
      };
      img.src = encoded;
    });
  }

  registerImageAsset(assetId, srcUrl, width = 200, height = 200) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this._assets.set(assetId, {
          url: srcUrl,
          img,
          w: img.naturalWidth || width,
          h: img.naturalHeight || height
        });
        resolve(assetId);
      };
      img.onerror = () => {
        // Fallback placeholder
        this._assets.set(assetId, {
          url: srcUrl,
          img: null,
          w: width,
          h: height
        });
        resolve(assetId);
      };
      img.src = srcUrl;
    });
  }

  getAsset(assetId) {
    return this._assets.get(assetId) || null;
  }

  // ── Persistence ────────────────────────────────────────────────────────────
  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._persistToDB(), 1000);
  }

  async _persistToDB() {
    try {
      const db = await openStudioDB();
      const tx = db.transaction('studio_projects', 'readwrite');
      const store = tx.objectStore('studio_projects');

      // Collect photo blobs separately
      const photoBlobs = {};
      for (const p of this._scene.photos) {
        const asset = this._assets.get(p.assetId);
        if (asset?.blob) photoBlobs[p.assetId] = asset.blob;
      }

      store.put({
        scene: JSON.stringify(this._scene),
        photoBlobs,
        savedAt: Date.now()
      }, 'active_v2');

      this._dirty = false;
    } catch (err) {
      console.warn('[SceneStore] Autosave failed:', err);
    }
  }

  async loadFromDB() {
    try {
      const db = await openStudioDB();
      const tx = db.transaction('studio_projects', 'readonly');
      const store = tx.objectStore('studio_projects');

      return new Promise((resolve, reject) => {
        const req = store.get('active_v2');
        req.onsuccess = async () => {
          const record = req.result;
          if (!record) { resolve(false); return; }

          this._scene = JSON.parse(record.scene);

          // Restore photo assets
          if (record.photoBlobs) {
            for (const [id, blob] of Object.entries(record.photoBlobs)) {
              await this.registerAsset(id, blob, id);
            }
          }
          resolve(true);
        };
        req.onerror = () => resolve(false);
      });
    } catch (err) {
      console.warn('[SceneStore] Load failed:', err);
      return false;
    }
  }

  async clearDB() {
    try {
      const db = await openStudioDB();
      const tx = db.transaction('studio_projects', 'readwrite');
      tx.objectStore('studio_projects').delete('active_v2');
    } catch {}
  }
}

// ── IndexedDB helper ──────────────────────────────────────────────────────────
function openStudioDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('PocketFramesStudio', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('studio_projects')) {
        db.createObjectStore('studio_projects');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

// ── Singleton store ────────────────────────────────────────────────────────────
export const sceneStore = new SceneStore();
