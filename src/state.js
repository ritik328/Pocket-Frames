/**
 * Pocket Frames - Central State Management & Undo/Redo Engine
 */
import { saveProjectToDB } from './storage/projectStorage.js';

export const DEFAULT_METADATA = {
  brand: 'HASSELBLAD',
  device: 'OPPO Find X9',
  focalLength: '146mm',
  aperture: 'f/2.6',
  shutter: '1/25',
  iso: '1600'
};

export const DEFAULT_STATE = {
  image: null, // { element, file, filename, width, height, orientation }
  transform: {
    x: 0,     // Canonical export-space offset from aperture center
    y: 0,     // Canonical export-space offset from aperture center
    scale: 1  // Scale multiplier
  },
  metadata: { ...DEFAULT_METADATA },
  originalExif: null,
  editor: {
    gridVisible: true,
    ruleOfThirds: true,
    crosshair: true,
    snapEnabled: true,
    cleanPreview: false
  },
  export: {
    resolution: '2160x2700', // '1080x1350', '2160x2700', '3240x4050'
    format: 'image/jpeg',    // 'image/jpeg', 'image/png'
    quality: 0.99
  },
  ai: {
    dayNumber: 18,
    campaign: '47 DAYS / 47 FRAMES',
    postData: null,
    isAnalyzing: false,
    status: 'IDLE',
    error: null,
    selectedCaptionStyle: 'minimal'
  },
  lut: {
    enabled: false,
    id: null,
    title: null,
    intensity: 1.0,
    activeLut: null
  }
};

class StateStore {
  constructor() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.state.image = null;

    this.listeners = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 30;
    this.persistDebounceTimer = null;
  }

  getState() {
    return this.state;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(changeType = 'general') {
    this.listeners.forEach(fn => fn(this.state, changeType));
    this.schedulePersist();
  }

  schedulePersist() {
    clearTimeout(this.persistDebounceTimer);
    this.persistDebounceTimer = setTimeout(() => {
      if (this.state.image && this.state.image.file) {
        saveProjectToDB({
          imageBlob: this.state.image.file,
          filename: this.state.image.filename,
          transform: this.state.transform,
          metadata: this.state.metadata,
          originalExif: this.state.originalExif,
          editor: this.state.editor,
          export: this.state.export,
          lut: {
            enabled: this.state.lut?.enabled,
            id: this.state.lut?.id,
            title: this.state.lut?.title,
            intensity: this.state.lut?.intensity
          }
        });
      }
    }, 800);
  }

  pushHistory() {
    const snapshot = {
      transform: { ...this.state.transform },
      metadata: { ...this.state.metadata }
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return;
    const current = {
      transform: { ...this.state.transform },
      metadata: { ...this.state.metadata }
    };
    this.redoStack.push(current);

    const previous = this.undoStack.pop();
    this.state.transform = { ...previous.transform };
    this.state.metadata = { ...previous.metadata };
    this.notify('undo');
  }

  redo() {
    if (!this.canRedo()) return;
    const current = {
      transform: { ...this.state.transform },
      metadata: { ...this.state.metadata }
    };
    this.undoStack.push(current);

    const next = this.redoStack.pop();
    this.state.transform = { ...next.transform };
    this.state.metadata = { ...next.metadata };
    this.notify('redo');
  }

  setImage(imageData) {
    this.pushHistory();
    if (imageData && !imageData.originalElement) {
      imageData.originalElement = imageData.element;
    }
    this.state.image = imageData;
    this.notify('image');
  }

  setTransform(partial, commitHistory = false) {
    if (commitHistory) {
      this.pushHistory();
    }
    this.state.transform = {
      ...this.state.transform,
      ...partial
    };
    this.notify('transform');
  }

  setMetadata(partial, commitHistory = false) {
    if (commitHistory) {
      this.pushHistory();
    }
    this.state.metadata = {
      ...this.state.metadata,
      ...partial
    };
    this.notify('metadata');
  }

  setEditor(partial) {
    this.state.editor = {
      ...this.state.editor,
      ...partial
    };
    this.notify('editor');
  }

  setExport(partial) {
    this.state.export = {
      ...this.state.export,
      ...partial
    };
    this.notify('export');
  }

  setAiState(partial) {
    this.state.ai = {
      ...this.state.ai,
      ...partial
    };
    this.notify('ai');
  }

  setLut(partial) {
    this.state.lut = {
      ...this.state.lut,
      ...partial
    };
    this.notify('lut');
  }

  resetNewFrame() {
    this.pushHistory();
    this.state.image = null;
    this.state.transform = { x: 0, y: 0, scale: 1 };
    this.state.metadata = { ...DEFAULT_METADATA };
    this.state.originalExif = null;
    this.notify('reset');
  }
}

export const store = new StateStore();
