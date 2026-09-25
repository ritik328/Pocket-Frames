/**
 * Pocket Frames - Central LUT Manager & State Synchronization Engine
 */
import { store } from '../state.js';
import { getBuiltinPresets } from './lutPresets.js';
import { applyLut } from './lutProcessor.js';
import { parseCubeLut } from './lutParser.js';
import { saveCustomLut, loadAllCustomLuts, deleteCustomLut } from './lutStorage.js';

class LutManager {
  constructor() {
    this.builtinPresets = [];
    this.customLuts = [];
    this.activeLut = null;
    this.intensity = 1.0;
    this.isBypassed = false;
    this.listeners = new Set();
    this.isInitialized = false;
    this.debounceTimer = null;
  }

  async init() {
    if (this.isInitialized) return;

    // 1. Load built-in presets
    this.builtinPresets = getBuiltinPresets();

    // 2. Load custom user LUTs from IndexedDB
    try {
      this.customLuts = await loadAllCustomLuts();
    } catch (e) {
      console.warn('[LutManager] Failed loading custom LUTs:', e);
      this.customLuts = [];
    }

    // 3. Subscribe to store for new image uploads
    store.subscribe((state, changeType) => {
      if (changeType === 'image' || changeType === 'reset') {
        this.onImageChanged(state);
      }
    });

    this.isInitialized = true;
    this.notify();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }

  getAllLuts() {
    return [...this.builtinPresets, ...this.customLuts];
  }

  findLutById(id) {
    return this.getAllLuts().find(l => l.id === id) || null;
  }

  onImageChanged(state) {
    if (!state.image) {
      return;
    }

    // Ensure originalElement is anchored
    if (!state.image.originalElement) {
      state.image.originalElement = state.image.element;
    }

    // If a LUT is currently active, re-apply it to the new image
    if (this.activeLut && !this.isBypassed && this.intensity > 0) {
      this.reapplyCurrentLut();
    }
  }

  /**
   * Select and activate a LUT
   * @param {CubeLut|null} lut 
   * @param {number} [intensity]
   */
  async selectLut(lut, intensity = null) {
    if (intensity !== null) {
      this.intensity = Math.max(0, Math.min(1, intensity));
    }
    this.activeLut = lut;
    this.isBypassed = false;

    await this.reapplyCurrentLut();
    this.notify();
  }

  /**
   * Set LUT intensity (0.0 to 1.0)
   */
  setIntensity(val, immediate = true) {
    this.intensity = Math.max(0, Math.min(1, val));
    if (!this.activeLut) {
      this.notify();
      return;
    }

    if (immediate) {
      this.reapplyCurrentLut();
    } else {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.reapplyCurrentLut();
      }, 16);
    }
    this.notify();
  }

  /**
   * Toggle temporary bypass (before/after comparison)
   */
  setBypass(bypassed) {
    this.isBypassed = Boolean(bypassed);
    this.reapplyCurrentLut();
    this.notify();
  }

  /**
   * Reset / Remove active LUT
   */
  clearLut() {
    this.activeLut = null;
    this.isBypassed = false;

    const state = store.getState();
    if (state.image && state.image.originalElement) {
      state.image.element = state.image.originalElement;
      state.image.lutElement = null;
    }

    store.setLut({
      enabled: false,
      id: null,
      title: null,
      intensity: this.intensity,
      activeLut: null
    });

    this.notify();
  }

  /**
   * Preview a LUT temporarily on hover without committing it
   */
  previewLut(lut) {
    this.previewHoverLut = lut;
    const state = store.getState();
    if (!state.image) return;

    if (!state.image.originalElement) {
      state.image.originalElement = state.image.element;
    }

    if (!lut || this.intensity <= 0) {
      state.image.element = state.image.originalElement;
    } else {
      const renderedCanvas = applyLut(
        state.image.originalElement,
        lut,
        this.intensity,
        state.image.lutElement || null
      );
      state.image.lutElement = renderedCanvas;
      state.image.element = renderedCanvas;
    }

    store.notify('lut-preview');
  }

  /**
   * Restore the committed active LUT when hover ends
   */
  restoreCommittedLut() {
    this.previewHoverLut = null;
    this.reapplyCurrentLut();
  }

  /**
   * Core re-render routine
   */
  reapplyCurrentLut() {
    const state = store.getState();
    if (!state.image) {
      store.setLut({
        enabled: Boolean(this.activeLut),
        id: this.activeLut ? this.activeLut.id : null,
        title: this.activeLut ? this.activeLut.title : null,
        intensity: this.intensity,
        activeLut: this.activeLut
      });
      return;
    }

    if (!state.image.originalElement) {
      state.image.originalElement = state.image.element;
    }

    if (!this.activeLut || this.isBypassed || this.intensity <= 0) {
      state.image.element = state.image.originalElement;
      state.image.lutElement = null;
    } else {
      const renderedCanvas = applyLut(
        state.image.originalElement,
        this.activeLut,
        this.intensity,
        state.image.lutElement || null
      );
      state.image.lutElement = renderedCanvas;
      state.image.element = renderedCanvas;
    }

    store.setLut({
      enabled: Boolean(this.activeLut && !this.isBypassed && this.intensity > 0),
      id: this.activeLut ? this.activeLut.id : null,
      title: this.activeLut ? this.activeLut.title : null,
      intensity: this.intensity,
      activeLut: this.activeLut
    });
  }

  /**
   * Import a .cube file uploaded by the user
   */
  async importCubeFile(file) {
    if (!file) throw new Error('No file provided.');
    if (!file.name.toLowerCase().endsWith('.cube')) {
      throw new Error('Only .cube files are supported (Adobe / DaVinci Resolve format).');
    }

    const text = await file.text();
    const lut = parseCubeLut(text, file.name);
    lut.isBuiltin = false;

    // Check duplicate by title or id
    const existingIdx = this.customLuts.findIndex(l => l.title === lut.title || l.filename === lut.filename);
    if (existingIdx >= 0) {
      this.customLuts[existingIdx] = lut;
    } else {
      this.customLuts.unshift(lut);
    }

    await saveCustomLut(lut);
    this.notify();
    return lut;
  }

  /**
   * Delete a custom user LUT
   */
  async deleteLut(id) {
    const idx = this.customLuts.findIndex(l => l.id === id);
    if (idx < 0) return false;

    this.customLuts.splice(idx, 1);
    await deleteCustomLut(id);

    if (this.activeLut && this.activeLut.id === id) {
      this.clearLut();
    } else {
      this.notify();
    }
    return true;
  }
}

export const lutManager = new LutManager();
