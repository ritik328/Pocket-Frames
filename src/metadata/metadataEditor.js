/**
 * Pocket Frames - Metadata Editor
 * Binds input fields to reactive state with live typing updates.
 * Preserves original source EXIF separately.
 */
import { store } from '../state.js';

export class MetadataEditor {
  constructor(formContainer) {
    this.container = formContainer;
    this.inputs = {};
    this.debounceTimer = null;
    this.init();
  }

  init() {
    const getEl = (sel1, sel2) => (this.container ? this.container.querySelector(sel1) || (sel2 ? this.container.querySelector(sel2) : null) : document.querySelector(sel1) || (sel2 ? document.querySelector(sel2) : null));

    this.inputs = {
      brand: getEl('#inputBrand'),
      device: getEl('#inputDevice'),
      focalLength: getEl('#inputFL', '#inputFocalLength'),
      aperture: getEl('#inputAperture'),
      shutter: getEl('#inputShutter'),
      iso: getEl('#inputISO', '#inputIso')
    };

    // Attach reactive input listeners
    Object.entries(this.inputs).forEach(([key, input]) => {
      if (!input) return;

      input.addEventListener('input', (e) => {
        store.setMetadata({ [key]: e.target.value }, false);

        // Debounce history snapshot on typing pause
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          store.pushHistory();
        }, 500);
      });

      input.addEventListener('blur', () => {
        store.pushHistory();
      });
    });

    // Subscribe to external state changes (e.g. undo/redo or EXIF auto-fill)
    store.subscribe((state, changeType) => {
      if (changeType === 'undo' || changeType === 'redo' || changeType === 'image' || changeType === 'reset') {
        this.syncInputsFromState(state.metadata);
      }
    });

    // Initial sync
    this.syncInputsFromState(store.getState().metadata);
  }

  syncInputsFromState(metadata) {
    Object.entries(this.inputs).forEach(([key, input]) => {
      if (input && metadata[key] !== undefined) {
        if (input.value !== metadata[key]) {
          input.value = metadata[key];
        }
      }
    });
  }
}
