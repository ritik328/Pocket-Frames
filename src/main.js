/**
 * Pocket Frames - Main Application Coordinator
 */
import { store } from './state.js';
import { renderFrame } from './frame/frameRenderer.js';
import { ensureFontsReady } from './frame/typography.js';
import { PositionManager } from './editor/positionManager.js';
import { MetadataEditor } from './metadata/metadataEditor.js';
import { calculateFitScale, calculateFillScale, clampZoom } from './editor/zoomManager.js';
import { checkAlignment } from './editor/alignment.js';
import { downloadFrame, getPreflightSummary, EXPORT_PRESETS } from './export/exportEngine.js';
import { loadUserImage } from './image/imageLoader.js';
import { setupKeyboardShortcuts } from './shortcuts.js';
import { loadProjectFromDB, clearProjectFromDB } from './storage/projectStorage.js';
import { AiStudioModal } from './ai/aiStudioModal.js';
import { applyAiComposition } from './ai/compositionApplier.js';

// DOM Elements
const previewCanvas = document.getElementById('previewCanvas');
const previewContainer = document.getElementById('previewContainer');
const fileInput = document.getElementById('fileInput');
const btnUpload = document.getElementById('btnUpload');

const zoomSlider = document.getElementById('zoomSlider');
const zoomReadout = document.getElementById('zoomReadout');
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');

const btnFit = document.getElementById('btnFit');
const btnFill = document.getElementById('btnFill');
const btnReset = document.getElementById('btnReset');

const chkGridVisible = document.getElementById('chkGridVisible');
const chkRuleOfThirds = document.getElementById('chkRuleOfThirds');
const chkSnapEnabled = document.getElementById('chkSnapEnabled');

const dotH = document.getElementById('dotH');
const dotV = document.getElementById('dotV');
const textH = document.getElementById('textH');
const textV = document.getElementById('textV');
const alignmentCard = document.getElementById('alignmentCard');

const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
const btnNewFrame = document.getElementById('btnNewFrame');
const btnToggleCleanPreview = document.getElementById('btnToggleCleanPreview');

const selectResolution = document.getElementById('selectResolution');
const selectFormat = document.getElementById('selectFormat');
const btnDownload = document.getElementById('btnDownload');
const downloadBtnText = document.getElementById('downloadBtnText');
const headerResLabel = document.getElementById('headerResLabel');

const pfResolution = document.getElementById('pfResolution');
const pfFormat = document.getElementById('pfFormat');
const pfAlignment = document.getElementById('pfAlignment');

const exifBadge = document.getElementById('exifBadge');
const btnClearSession = document.getElementById('btnClearSession');
const sessionStatus = document.getElementById('sessionStatus');

const shortcutsModal = document.getElementById('shortcutsModal');
const btnShortcutsHelp = document.getElementById('btnShortcutsHelp');
const btnCloseShortcuts = document.getElementById('btnCloseShortcuts');

let positionManager = null;
let metadataEditor = null;
let aiStudioModal = null;

const btnAiAutoCompose = document.getElementById('btnAiAutoCompose');

// Initialize App
async function initApp() {
  await ensureFontsReady();

  // Setup sub-managers
  positionManager = new PositionManager(previewCanvas, previewContainer);
  metadataEditor = new MetadataEditor(document.getElementById('panelDetails'));
  setupKeyboardShortcuts();

  // Setup Event Listeners
  setupEventListeners();

  // Initialize Theme Switcher (Liquid Glass Light/Dark/Dim)
  initThemeSwitcher();

  // Initialize AI Photography Director Studio Modal
  aiStudioModal = new AiStudioModal();

  // Handle Resize
  setupResizeObserver();

  // State Subscription for Live Updates
  store.subscribe(onStateChange);

  // Restore session from IndexedDB if available
  await tryRestoreSession();

  // Initial render
  updatePreview();
  updatePreflightUI();
}

/**
 * Handle state changes and trigger reactive updates
 */
function onStateChange(state, changeType) {
  updatePreview();
  updateAlignmentUI(state);
  updatePreflightUI();
  updateUndoRedoUI();

  // Update zoom slider and readout
  const scale = state.transform.scale;
  zoomSlider.value = scale;
  zoomReadout.textContent = `${scale.toFixed(2)}×`;
  const minZoom = parseFloat(zoomSlider.min) || 0.1;
  const maxZoom = parseFloat(zoomSlider.max) || 4.0;
  const percent = Math.min(100, Math.max(0, ((scale - minZoom) / (maxZoom - minZoom)) * 100));
  zoomSlider.style.setProperty('--zoom-percent', `${percent}%`);

  // Clean preview mode toggle
  if (state.editor.cleanPreview) {
    document.body.classList.add('clean-preview');
  } else {
    document.body.classList.remove('clean-preview');
  }

  // Toggles sync
  chkGridVisible.checked = state.editor.gridVisible;
  chkRuleOfThirds.checked = state.editor.ruleOfThirds;
  chkSnapEnabled.checked = state.editor.snapEnabled;

  // Header resolution label
  const preset = EXPORT_PRESETS[state.export.resolution] || EXPORT_PRESETS['2160x2700'];
  headerResLabel.textContent = `${preset.width} × ${preset.height}`;
}

/**
 * Render the live preview on canvas
 */
function updatePreview() {
  const state = store.getState();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const rect = previewCanvas.getBoundingClientRect();
  const cssWidth = rect.width || 540;
  const cssHeight = rect.height || 675;

  const targetWidth = Math.round(cssWidth * dpr);
  const targetHeight = Math.round(cssHeight * dpr);

  renderFrame(previewCanvas, state, {
    isExport: false,
    targetWidth,
    targetHeight
  });
}

/**
 * Update alignment indicators
 */
function updateAlignmentUI(state) {
  if (!state.image) {
    alignmentCard.style.opacity = '0.5';
    dotH.classList.remove('active');
    dotV.classList.remove('active');
    textH.textContent = 'Horizontal Position';
    textV.textContent = 'Vertical Position';
    return;
  }

  alignmentCard.style.opacity = '1';
  const alignment = checkAlignment(state.transform);

  // X alignment = Vertical center guide
  if (alignment.isXAligned) {
    dotV.classList.add('active');
    textV.textContent = '✓ Horizontally Centered';
    textV.parentElement.classList.add('active');
  } else {
    dotV.classList.remove('active');
    textV.textContent = 'Horizontal Offset';
    textV.parentElement.classList.remove('active');
  }

  // Y alignment = Horizontal center guide
  if (alignment.isYAligned) {
    dotH.classList.add('active');
    textH.textContent = '✓ Vertically Centered';
    textH.parentElement.classList.add('active');
  } else {
    dotH.classList.remove('active');
    textH.textContent = 'Vertical Offset';
    textH.parentElement.classList.remove('active');
  }
}

/**
 * Update preflight summary in bottom bar
 */
function updatePreflightUI() {
  const state = store.getState();
  const preflight = getPreflightSummary(state);

  pfResolution.textContent = preflight.resolutionLabel;
  pfFormat.textContent = preflight.formatLabel;

  if (!preflight.hasImage) {
    pfAlignment.textContent = 'Empty Frame';
    pfAlignment.style.color = 'var(--text-dim)';
  } else if (preflight.isFullyAligned) {
    pfAlignment.textContent = 'Perfect Center';
    pfAlignment.style.color = 'var(--accent-red)';
  } else if (preflight.isXAligned || preflight.isYAligned) {
    pfAlignment.textContent = preflight.isXAligned ? 'H-Centered' : 'V-Centered';
    pfAlignment.style.color = 'var(--text-main)';
  } else {
    pfAlignment.textContent = 'Manual Offset';
    pfAlignment.style.color = 'var(--text-muted)';
  }
}

/**
 * Update undo/redo button enabled states
 */
function updateUndoRedoUI() {
  btnUndo.disabled = !store.canUndo();
  btnRedo.disabled = !store.canRedo();
}

/**
 * Liquid Glass Theme Switcher Engine (Light, Dark, Dim)
 * Tracks direction of movement for the elastic liquid indicator and persists preference
 */
function initThemeSwitcher() {
  const switcher = document.getElementById('themeSwitcher');
  if (!switcher) return;

  const radios = switcher.querySelectorAll('input[type="radio"]');
  let previousValue = null;

  // Restore saved theme or match system dark preference
  let savedTheme = localStorage.getItem('pocket_frames_theme');
  if (!savedTheme) {
    savedTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }

  const initialRadio = switcher.querySelector(`input[value="${savedTheme}"]`) || switcher.querySelector('input[value="light"]');
  if (initialRadio) {
    initialRadio.checked = true;
    previousValue = initialRadio.getAttribute('c-option');
    switcher.setAttribute('c-previous', previousValue);
    document.body.setAttribute('data-theme', savedTheme);
  }

  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        switcher.setAttribute('c-previous', previousValue ?? '');
        previousValue = radio.getAttribute('c-option');
        const theme = radio.value;
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('pocket_frames_theme', theme);
      }
    });
  });
}

/**
 * Wire up UI listeners
 */
function setupEventListeners() {
  // File upload
  btnUpload.addEventListener('click', () => fileInput.click());
  previewCanvas.addEventListener('click', () => {
    if (!store.getState().image) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      btnUpload.disabled = true;
      btnUpload.textContent = 'Decoding...';

      const loaded = await loadUserImage(file);
      store.setImage(loaded);

      // Auto-calculate initial Fill scale
      const fillScale = calculateFillScale(loaded.width, loaded.height);
      store.setTransform({ x: 0, y: 0, scale: fillScale }, true);

      // If EXIF extracted, auto-fill editable metadata
      if (loaded.extractedExif) {
        const updates = {};
        if (loaded.extractedExif.device) updates.device = loaded.extractedExif.device;
        if (loaded.extractedExif.focalLength) updates.focalLength = loaded.extractedExif.focalLength;
        if (loaded.extractedExif.aperture) updates.aperture = loaded.extractedExif.aperture;
        if (loaded.extractedExif.shutter) updates.shutter = loaded.extractedExif.shutter;
        if (loaded.extractedExif.iso) updates.iso = loaded.extractedExif.iso;

        if (Object.keys(updates).length > 0) {
          store.setMetadata(updates, true);
          exifBadge.classList.remove('hidden');
          setTimeout(() => exifBadge.classList.add('hidden'), 5000);
        }
      }
    } catch (err) {
      alert(err.message || 'Error loading image.');
    } finally {
      btnUpload.disabled = false;
      btnUpload.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        Upload Photo
      `;
      fileInput.value = '';
    }
  });

  // Zoom Slider
  zoomSlider.addEventListener('input', (e) => {
    const scale = parseFloat(e.target.value);
    store.setTransform({ scale }, false);
  });
  zoomSlider.addEventListener('change', () => {
    store.pushHistory();
  });

  // Zoom +/- Buttons
  btnZoomIn.addEventListener('click', () => {
    const current = store.getState().transform.scale;
    const next = clampZoom(current * 1.1);
    store.setTransform({ scale: next }, true);
  });
  btnZoomOut.addEventListener('click', () => {
    const current = store.getState().transform.scale;
    const next = clampZoom(current * 0.9);
    store.setTransform({ scale: next }, true);
  });

  // Presets: Fit, Fill, Reset
  btnFit.addEventListener('click', () => {
    const state = store.getState();
    if (!state.image) return;
    const scale = calculateFitScale(state.image.width, state.image.height);
    store.setTransform({ x: 0, y: 0, scale }, true);
  });

  btnFill.addEventListener('click', () => {
    const state = store.getState();
    if (!state.image) return;
    const scale = calculateFillScale(state.image.width, state.image.height);
    store.setTransform({ x: 0, y: 0, scale }, true);
  });

  btnReset.addEventListener('click', () => {
    const state = store.getState();
    if (!state.image) return;
    const scale = calculateFillScale(state.image.width, state.image.height);
    store.setTransform({ x: 0, y: 0, scale }, true);
  });

  // AI Auto-Compose Framing Preset
  if (btnAiAutoCompose) {
    btnAiAutoCompose.addEventListener('click', () => {
      const state = store.getState();
      if (!state.image) {
        fileInput.click();
        return;
      }
      aiStudioModal.open();
      aiStudioModal.runAnalysis();
    });
  }

  // Toggles
  chkGridVisible.addEventListener('change', (e) => {
    store.setEditor({ gridVisible: e.target.checked });
  });

  chkRuleOfThirds.addEventListener('change', (e) => {
    store.setEditor({ ruleOfThirds: e.target.checked });
  });

  chkSnapEnabled.addEventListener('change', (e) => {
    store.setEditor({ snapEnabled: e.target.checked });
  });

  // Undo / Redo
  btnUndo.addEventListener('click', () => store.undo());
  btnRedo.addEventListener('click', () => store.redo());

  // New Frame
  btnNewFrame.addEventListener('click', () => {
    if (confirm('Start a new frame? Current photo and positioning will be cleared.')) {
      store.resetNewFrame();
      clearProjectFromDB();
    }
  });

  // Clean Preview Mode Toggle
  btnToggleCleanPreview.addEventListener('click', () => {
    const current = store.getState().editor.cleanPreview;
    store.setEditor({ cleanPreview: !current });
  });

  // Resolution & Format dropdowns
  selectResolution.addEventListener('change', (e) => {
    store.setExport({ resolution: e.target.value });
  });

  selectFormat.addEventListener('change', (e) => {
    store.setExport({ format: e.target.value });
  });

  // Download Frame
  btnDownload.addEventListener('click', async () => {
    const state = store.getState();
    try {
      btnDownload.disabled = true;
      downloadBtnText.textContent = 'Rendering Master...';

      await downloadFrame(state, (msg) => {
        downloadBtnText.textContent = msg;
      });

      downloadBtnText.textContent = 'Downloaded!';
      setTimeout(() => {
        downloadBtnText.textContent = 'Download Frame';
        btnDownload.disabled = false;
      }, 2000);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
      downloadBtnText.textContent = 'Download Frame';
      btnDownload.disabled = false;
    }
  });

  // Clear Session
  btnClearSession.addEventListener('click', async () => {
    await clearProjectFromDB();
    sessionStatus.textContent = 'Cache cleared';
    setTimeout(() => {
      sessionStatus.textContent = 'Saved to local device';
    }, 2000);
  });

  // Mobile Tab Bar Switching
  const tabBtnControls = document.getElementById('tabBtnControls');
  const tabBtnDetails = document.getElementById('tabBtnDetails');
  const panelControls = document.getElementById('panelControls');
  const panelDetails = document.getElementById('panelDetails');

  if (tabBtnControls && tabBtnDetails && panelControls && panelDetails) {
    tabBtnControls.addEventListener('click', () => {
      tabBtnControls.classList.add('active');
      tabBtnDetails.classList.remove('active');
      panelControls.classList.add('mobile-active');
      panelDetails.classList.remove('mobile-active');
    });

    tabBtnDetails.addEventListener('click', () => {
      tabBtnDetails.classList.add('active');
      tabBtnControls.classList.remove('active');
      panelDetails.classList.add('mobile-active');
      panelControls.classList.remove('mobile-active');
    });
  }

  // Keyboard Shortcuts Modal
  btnShortcutsHelp.addEventListener('click', () => shortcutsModal.classList.remove('hidden'));
  btnCloseShortcuts.addEventListener('click', () => shortcutsModal.classList.add('hidden'));
  shortcutsModal.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) shortcutsModal.classList.add('hidden');
  });
}

/**
 * Handle responsive canvas resizing smoothly
 */
function setupResizeObserver() {
  const resizeObserver = new ResizeObserver(() => {
    updatePreview();
  });
  resizeObserver.observe(previewContainer);
}

/**
 * Restore previous session from IndexedDB if found
 */
async function tryRestoreSession() {
  try {
    const saved = await loadProjectFromDB();
    if (!saved || !saved.imageBlob) return;

    const loaded = await loadUserImage(saved.imageBlob);
    store.setImage(loaded);

    if (saved.transform) {
      store.setTransform(saved.transform, false);
    }
    if (saved.metadata) {
      store.setMetadata(saved.metadata, false);
    }
    if (saved.editor) {
      store.setEditor(saved.editor);
    }
    if (saved.export) {
      store.setExport(saved.export);
      selectResolution.value = saved.export.resolution || '2160x2700';
      selectFormat.value = saved.export.format || 'image/jpeg';
    }

    // Check if AI recommendation was applied from AI Photography Director page
    try {
      const pendingComp = localStorage.getItem('pocket_frames_applied_composition');
      if (pendingComp) {
        const rec = JSON.parse(pendingComp);
        localStorage.removeItem('pocket_frames_applied_composition');
        if (rec) {
          applyAiComposition(store, rec);
        }
      }
    } catch (e) {
      console.warn('Could not apply pending AI composition:', e);
    }
  } catch (err) {
    console.warn('Could not restore previous project session:', err);
  }
}

// Boot application
initApp();
