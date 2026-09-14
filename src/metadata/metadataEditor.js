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
    this.inputs = {
      brand: this.container.querySelector('#inputBrand'),
      device: this.container.querySelector('#inputDevice'),
      focalLength: this.container.querySelector('#inputFocalLength'),
      aperture: this.container.querySelector('#inputAperture'),
      shutter: this.container.querySelector('#inputShutter'),
      iso: this.container.querySelector('#inputIso')
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
