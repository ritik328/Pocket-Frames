/**
 * Pocket Frames - Main Application Coordinator
 * Powers the Modern Liquid Glass Studio layout.
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
import { InteractiveDots } from './canvas/interactiveDots.js';
import { CanvasResizer } from './editor/canvasResizer.js';
import './lut/lut.css';
import { LutBackdoorModal } from './lut/lutBackdoorModal.js';
import { lutManager } from './lut/lutManager.js';
import { playSecretTapSound, playBackdoorUnlockSound } from './lut/audioFx.js';
import { SidebarLutControl } from './lut/sidebarLutControl.js';
import { VideoDock } from './video/videoDock.js';
import { videoManager } from './video/videoManager.js';
import { videoExportModal } from './video/videoExportModal.js';
import { initMobileApp } from './mobile/mobileApp.js';

// DOM Elements with Dual-Selector Support
const previewCanvas = document.getElementById('previewCanvas');
const previewContainer = document.getElementById('previewContainer') || document.getElementById('canvasArea');
const fileInput = document.getElementById('fileInput');
const btnUpload = document.getElementById('uploadBtn') || document.getElementById('btnUpload');

let canvasResizer = null;

const zoomSlider = document.getElementById('zoomSlider');
const zoomReadout = document.getElementById('zoomValue') || document.getElementById('zoomReadout');
const btnZoomIn = document.getElementById('zoomPlus') || document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('zoomMinus') || document.getElementById('btnZoomOut');

const btnFit = document.getElementById('fitBtn') || document.getElementById('btnFit');
const btnFill = document.getElementById('fillBtn') || document.getElementById('btnFill');
const btnReset = document.getElementById('resetBtn') || document.getElementById('btnReset');
const btnAiAutoCompose = document.getElementById('aiFramingBtn') || document.getElementById('btnAiAutoCompose');

const chkGridVisible = document.getElementById('guideAlignment') || document.getElementById('chkGridVisible');
const chkRuleOfThirds = document.getElementById('guideThirds') || document.getElementById('chkRuleOfThirds');
const chkSnapEnabled = document.getElementById('guideSnap') || document.getElementById('chkSnapEnabled');

const itemVCentered = document.getElementById('itemVCentered');
const itemHCentered = document.getElementById('itemHCentered');
const confirmList = document.getElementById('confirmList');
const alignmentStatus = document.getElementById('alignmentStatus') || document.getElementById('pfAlignment');

const btnUndo = document.getElementById('undoBtn') || document.getElementById('btnUndo');
const btnRedo = document.getElementById('redoBtn') || document.getElementById('btnRedo');
const btnNewFrame = document.getElementById('newFrameBtn') || document.getElementById('btnNewFrame');
const btnToggleCleanPreview = document.getElementById('previewBtn') || document.getElementById('btnToggleCleanPreview');

const btnDownload = document.getElementById('downloadBtn') || document.getElementById('btnDownload');
const downloadBtnText = document.getElementById('downloadBtnText');
const headerResLabel = document.getElementById('headerResLabel');
const pfResolution = document.getElementById('pfResolution');
const pfFormat = document.getElementById('pfFormat');

const btnClearSession = document.getElementById('clearCacheBtn') || document.getElementById('btnClearSession');
const sizeSelectBtn = document.getElementById('sizeSelect');
const qualitySelectBtn = document.getElementById('qualitySelect');

const shortcutsModal = document.getElementById('shortcutsModal');
const btnShortcutsHelp = document.getElementById('helpBtn') || document.getElementById('btnShortcutsHelp');
const btnCloseShortcuts = document.getElementById('btnCloseShortcuts');
const btnOpenAiStudio = document.getElementById('aiDirectorBtn') || document.getElementById('btnOpenAiStudio');

const toastEl = document.getElementById('toast');
let toastTimer = null;

let positionManager = null;
let metadataEditor = null;
let aiStudioModal = null;
let lutBackdoorModal = null;
let sidebarLutControl = null;
let videoDock = null;

/**
 * Toast helper for non-blocking tactile feedback
 */
export function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('is-visible');
  }, 2200);
}

// Initialize App
async function initApp() {
  // 1. Immediately boot Android Mobile PWA & Liquid Glass Experience (0ms latency, non-blocking)
  try {
    initMobileApp();

    const btnToggleMobilePreview = document.getElementById('btnToggleMobilePreview');
    const mobileContainer = document.getElementById('mobileAppContainer');
    const btnClosePreview = document.getElementById('mobBtnClosePreview');

    const togglePreview = (forceState) => {
      if (!mobileContainer) return;
      const shouldShow = forceState !== undefined ? forceState : !mobileContainer.classList.contains('force-mobile-preview');
      mobileContainer.classList.toggle('force-mobile-preview', shouldShow);
      btnToggleMobilePreview?.classList.toggle('is-active', shouldShow);
      if (shouldShow) {
        showToast('📱 Android Phone Preview Mode Activated');
      }
    };

    btnToggleMobilePreview?.addEventListener('click', () => togglePreview());
    btnClosePreview?.addEventListener('click', () => togglePreview(false));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileContainer?.classList.contains('force-mobile-preview')) {
        togglePreview(false);
      }
    });
  } catch (err) {
    console.error('[PocketFrames] Error initializing mobile app:', err);
  }

  // 2. Setup desktop canvas and async dependencies
  await ensureFontsReady();

  // Setup sub-managers
  if (previewCanvas && previewContainer) {
    positionManager = new PositionManager(previewCanvas, previewContainer);
    canvasResizer = new CanvasResizer(previewCanvas, previewContainer, () => {
      updatePreview();
    });
  }
  
  const panelDetails = document.getElementById('panelDetails') || document.querySelector('.sidebar--right');
  metadataEditor = new MetadataEditor(panelDetails);
  setupKeyboardShortcuts();

  // Setup Event Listeners
  setupEventListeners();

  // Initialize Theme Switcher (Light / Dark / Auto)
  initThemeSwitcher();

  // Initialize AI Photography Director Studio Modal
  aiStudioModal = new AiStudioModal();

  // Initialize Hasselblad 3D LUT Color Lab Backdoor & On-Page Controls
  lutBackdoorModal = new LutBackdoorModal();
  await lutManager.init();
  sidebarLutControl = new SidebarLutControl(() => lutBackdoorModal);

  // Initialize Video Playback Dock & Real-Time Grading Loop
  videoDock = new VideoDock(previewContainer || canvasArea);
  videoManager.setUpdateCallback(() => performUpdatePreview());

  // Initialize Interactive Dots for Dark Mode (Desktop only)
  const dotsCanvas = document.getElementById('interactiveDotsCanvas');
  const canvasArea = document.getElementById('canvasArea');
  if (dotsCanvas && canvasArea) {
    new InteractiveDots(dotsCanvas, canvasArea);
  }

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
  if (zoomSlider) zoomSlider.value = scale;
  if (zoomReadout) zoomReadout.textContent = `${scale.toFixed(2)}×`;

  // Clean preview mode toggle
  if (state.editor.cleanPreview) {
    document.body.classList.add('clean-preview');
    if (btnToggleCleanPreview) {
      btnToggleCleanPreview.classList.add('is-toggled');
      const label = btnToggleCleanPreview.querySelector('.btn-label');
      if (label) label.textContent = 'Editing';
    }
  } else {
    document.body.classList.remove('clean-preview');
    if (btnToggleCleanPreview) {
      btnToggleCleanPreview.classList.remove('is-toggled');
      const label = btnToggleCleanPreview.querySelector('.btn-label');
      if (label) label.textContent = 'Preview';
    }
  }

  // Toggles sync
  if (chkGridVisible) chkGridVisible.checked = state.editor.gridVisible;
  if (chkRuleOfThirds) chkRuleOfThirds.checked = state.editor.ruleOfThirds;
  if (chkSnapEnabled) chkSnapEnabled.checked = state.editor.snapEnabled;

  // Header resolution label
  const preset = EXPORT_PRESETS[state.export.resolution] || EXPORT_PRESETS['2160x2700'];
  if (headerResLabel) headerResLabel.textContent = `${preset.width} × ${preset.height}`;

  // Download button text & mode sync (Framed Video vs Photo)
  const isVideo = Boolean(state.image && (state.image.type === 'video' || state.image.isVideo || state.image.videoElement));
  if (downloadBtnText) {
    if (isVideo) {
      downloadBtnText.textContent = 'Download Framed Video';
      if (btnDownload) {
        btnDownload.title = 'Export playing video inside frame (45s max limit)';
        btnDownload.classList.add('btn--video-export');
      }
    } else {
      downloadBtnText.textContent = 'Download frame';
      if (btnDownload) {
        btnDownload.title = 'Download master high-resolution photo';
        btnDownload.classList.remove('btn--video-export');
      }
    }
  }
}

let updatePreviewRaf = null;

/**
 * Render the live preview on canvas (debounced via requestAnimationFrame)
 */
function updatePreview() {
  if (!previewCanvas) return;
  if (updatePreviewRaf) {
    cancelAnimationFrame(updatePreviewRaf);
  }
  updatePreviewRaf = requestAnimationFrame(() => {
    updatePreviewRaf = null;
    performUpdatePreview();
  });
}

function performUpdatePreview() {
  if (!previewCanvas) return;
  const state = store.getState();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const cssWidth = (canvasResizer && canvasResizer.currentWidth)
    ? canvasResizer.currentWidth
    : (previewCanvas.getBoundingClientRect().width || 400);
  const cssHeight = Math.round(cssWidth * (5 / 4));

  const targetWidth = Math.max(200, Math.round(cssWidth * dpr));
  const targetHeight = Math.max(250, Math.round(cssHeight * dpr));

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
    if (itemVCentered) itemVCentered.classList.remove('is-aligned');
    if (itemHCentered) itemHCentered.classList.remove('is-aligned');
    if (alignmentStatus) {
      alignmentStatus.textContent = 'Empty frame';
      alignmentStatus.classList.remove('statusbar__value--sage');
    }
    return;
  }

  const alignment = checkAlignment(state.transform);

  if (itemVCentered) itemVCentered.classList.toggle('is-aligned', alignment.isYAligned);
  if (itemHCentered) itemHCentered.classList.toggle('is-aligned', alignment.isXAligned);

  if (alignmentStatus) {
    if (alignment.isFullyAligned) {
      alignmentStatus.textContent = 'Perfect center';
      alignmentStatus.classList.add('statusbar__value--sage');
    } else if (alignment.isXAligned) {
      alignmentStatus.textContent = 'H-Centered';
      alignmentStatus.classList.remove('statusbar__value--sage');
    } else if (alignment.isYAligned) {
      alignmentStatus.textContent = 'V-Centered';
      alignmentStatus.classList.remove('statusbar__value--sage');
    } else {
      alignmentStatus.textContent = 'Unsnapped';
      alignmentStatus.classList.remove('statusbar__value--sage');
    }
  }
}

/**
 * Update preflight summary in bottom bar
 */
function updatePreflightUI() {
  const state = store.getState();
  const preflight = getPreflightSummary(state);
  const isVideo = Boolean(state.image && (state.image.type === 'video' || state.image.isVideo || state.image.videoElement));

  if (pfResolution) pfResolution.textContent = isVideo ? '1080 × 1350' : preflight.resolutionLabel;
  if (pfFormat) pfFormat.textContent = isVideo ? 'MP4 Video (Max 45s)' : preflight.formatLabel;
}

/**
 * Update undo/redo button enabled states
 */
function updateUndoRedoUI() {
  if (btnUndo) btnUndo.disabled = !store.canUndo();
  if (btnRedo) btnRedo.disabled = !store.canRedo();
}

/**
 * Modern Liquid Glass Theme Switcher Engine (Light, Dark, Auto)
 */
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

/**
 * Handle user uploading or dropping an image or video file
 */
export async function handleFileLoad(file) {
  if (!file) return;

  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);
  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(file.name);

  if (!isImage && !isVideo) {
    showToast("Please upload a photo (JPG, PNG, WebP) or video (MP4, WebM, MOV).");
    return;
  }

  if (file.size > 500 * 1024 * 1024) {
    showToast('That file is larger than 500MB.');
    return;
  }

  try {
    if (btnUpload) btnUpload.disabled = true;
    showToast(isVideo ? 'Decoding video & loading first frame...' : 'Decoding photograph...');

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
      }
    }
    showToast(isVideo ? 'Video loaded into frame! Press Play or Space.' : 'Photo uploaded & centered.');
  } catch (err) {
    showToast(err.message || 'Error loading file.');
  } finally {
    if (btnUpload) btnUpload.disabled = false;
  }
}

/**
 * Wire up UI listeners
 */
function setupEventListeners() {
  // File upload
  if (btnUpload && fileInput) {
    btnUpload.addEventListener('click', () => fileInput.click());
  }

  if (previewCanvas && fileInput) {
    previewCanvas.addEventListener('click', () => {
      if (!store.getState().image) {
        fileInput.click();
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        await handleFileLoad(file);
      }
      fileInput.value = '';
    });
  }

  // Drag and drop onto canvasArea or previewContainer
  const dropZone = previewContainer || document.getElementById('canvasArea');
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(evtName => {
      dropZone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'dragend'].forEach(evtName => {
      dropZone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('is-dragover');
      });
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('is-dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        await handleFileLoad(file);
      }
    });
  }

  // Prevent default drag and drop on window to avoid accidentally navigating away
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // Zoom Slider
  if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
      const scale = parseFloat(e.target.value);
      store.setTransform({ scale }, false);
    });
    zoomSlider.addEventListener('change', () => {
      store.pushHistory();
    });
  }

  // Zoom +/- Buttons
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      const current = store.getState().transform.scale;
      const next = clampZoom(current * 1.1);
      store.setTransform({ scale: next }, true);
    });
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      const current = store.getState().transform.scale;
      const next = clampZoom(current * 0.9);
      store.setTransform({ scale: next }, true);
    });
  }

  // Presets: Fit, Fill, Reset
  if (btnFit) {
    btnFit.addEventListener('click', () => {
      const state = store.getState();
      if (!state.image) {
        fileInput?.click();
        return;
      }
      const scale = calculateFitScale(state.image.width, state.image.height);
      store.setTransform({ x: 0, y: 0, scale }, true);
      showToast('Fitted to frame.');
    });
  }

  if (btnFill) {
    btnFill.addEventListener('click', () => {
      const state = store.getState();
      if (!state.image) {
        fileInput?.click();
        return;
      }
      const scale = calculateFillScale(state.image.width, state.image.height);
      store.setTransform({ x: 0, y: 0, scale }, true);
      showToast('Filled the frame.');
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      const state = store.getState();
      if (!state.image) return;
      const scale = calculateFillScale(state.image.width, state.image.height);
      store.setTransform({ x: 0, y: 0, scale }, true);
      showToast('Zoom reset.');
    });
  }

  // AI Auto-Compose Framing Preset
  if (btnAiAutoCompose) {
    btnAiAutoCompose.addEventListener('click', () => {
      const state = store.getState();
      if (!state.image) {
        fileInput?.click();
        return;
      }
      if (aiStudioModal) {
        aiStudioModal.open();
        aiStudioModal.runAnalysis();
      }
    });
  }

  // AI Photography Director Main Header Button
  if (btnOpenAiStudio) {
    btnOpenAiStudio.addEventListener('click', () => {
      if (aiStudioModal) {
        aiStudioModal.open();
      }
    });
  }

  // Toggles
  if (chkGridVisible) {
    chkGridVisible.addEventListener('change', (e) => {
      store.setEditor({ gridVisible: e.target.checked });
    });
  }

  if (chkRuleOfThirds) {
    chkRuleOfThirds.addEventListener('change', (e) => {
      store.setEditor({ ruleOfThirds: e.target.checked });
    });
  }

  if (chkSnapEnabled) {
    chkSnapEnabled.addEventListener('change', (e) => {
      store.setEditor({ snapEnabled: e.target.checked });
      if (confirmList) confirmList.style.opacity = e.target.checked ? '1' : '0.4';
    });
  }

  // Undo / Redo
  if (btnUndo) {
    btnUndo.addEventListener('click', () => {
      if (store.canUndo()) {
        store.undo();
        showToast('Undone.');
      } else {
        showToast('Nothing to undo.');
      }
    });
  }

  if (btnRedo) {
    btnRedo.addEventListener('click', () => {
      if (store.canRedo()) {
        store.redo();
        showToast('Redone.');
      } else {
        showToast('Nothing to redo.');
      }
    });
  }

  // New Frame
  if (btnNewFrame) {
    btnNewFrame.addEventListener('click', () => {
      if (confirm('Start a new frame? Current photo and positioning will be cleared.')) {
        store.resetNewFrame();
        clearProjectFromDB();
        showToast('Started a new frame.');
      }
    });
  }

  // Clean Preview Mode Toggle
  if (btnToggleCleanPreview) {
    btnToggleCleanPreview.addEventListener('click', () => {
      const current = store.getState().editor.cleanPreview;
      store.setEditor({ cleanPreview: !current });
    });
  }

  // Size & Quality Select Buttons
  if (sizeSelectBtn) {
    sizeSelectBtn.addEventListener('click', () => {
      const state = store.getState();
      const isVideo = Boolean(state.image && (state.image.type === 'video' || state.image.isVideo || state.image.videoElement));
      if (isVideo) {
        videoExportModal.open();
      } else {
        showToast('Master resolution: 2160 × 2700 (Instagram Portrait 4:5)');
      }
    });
  }

  if (qualitySelectBtn) {
    qualitySelectBtn.addEventListener('click', () => {
      const state = store.getState();
      const isVideo = Boolean(state.image && (state.image.type === 'video' || state.image.isVideo || state.image.videoElement));
      if (isVideo) {
        videoExportModal.open();
      } else {
        showToast('Master format: JPEG (99% archival quality)');
      }
    });
  }

  // Download Frame Master Button
  if (btnDownload) {
    btnDownload.addEventListener('click', async () => {
      const state = store.getState();
      if (!state.image) {
        showToast('Upload a photo or video first to download your frame.');
        return;
      }

      const isVideo = Boolean(state.image && (state.image.type === 'video' || state.image.isVideo || state.image.videoElement));

      // If video is loaded, export framed video playing with max 45s limit
      if (isVideo) {
        videoExportModal.open();
        return;
      }

      try {
        btnDownload.disabled = true;
        if (downloadBtnText) downloadBtnText.textContent = 'Rendering...';

        await downloadFrame(state, (msg) => {
          if (downloadBtnText) downloadBtnText.textContent = msg;
        });

        if (downloadBtnText) downloadBtnText.textContent = 'Downloaded!';
        showToast('Frame downloaded successfully.');
        setTimeout(() => {
          if (downloadBtnText) downloadBtnText.textContent = 'Download frame';
          btnDownload.disabled = false;
        }, 2200);
      } catch (err) {
        showToast(`Export failed: ${err.message}`);
        if (downloadBtnText) downloadBtnText.textContent = 'Download frame';
        btnDownload.disabled = false;
      }
    });
  }

  // Clear Session Cache
  if (btnClearSession) {
    btnClearSession.addEventListener('click', async () => {
      await clearProjectFromDB();
      showToast('Local cache cleared.');
    });
  }

  // Keyboard Shortcuts Modal
  if (btnShortcutsHelp && shortcutsModal) {
    btnShortcutsHelp.addEventListener('click', () => shortcutsModal.classList.remove('hidden'));
  }
  if (btnCloseShortcuts && shortcutsModal) {
    btnCloseShortcuts.addEventListener('click', () => shortcutsModal.classList.add('hidden'));
  }
  if (shortcutsModal) {
    shortcutsModal.addEventListener('click', (e) => {
      if (e.target === shortcutsModal) shortcutsModal.classList.add('hidden');
    });
  }

  // ── Hasselblad Switch Button: Secret 3-Click Backgate Trigger ──
  const tabHasselblad = document.getElementById('tab-hasselblad');
  let hasselbladClicks = 0;
  let hasselbladClickTimer = null;

  if (tabHasselblad) {
    tabHasselblad.style.cursor = 'pointer';
    tabHasselblad.addEventListener('click', (e) => {
      hasselbladClicks++;
      clearTimeout(hasselbladClickTimer);

      playSecretTapSound(1.0 + hasselbladClicks * 0.25);
      tabHasselblad.classList.add('pf-tab-pulse');
      setTimeout(() => tabHasselblad.classList.remove('pf-tab-pulse'), 250);

      if (hasselbladClicks === 1) {
        hasselbladClickTimer = setTimeout(() => {
          hasselbladClicks = 0;
        }, 2200);
      } else if (hasselbladClicks === 2) {
        showToast('1 more tap to unlock Backgate...');
        hasselbladClickTimer = setTimeout(() => {
          hasselbladClicks = 0;
        }, 2200);
      } else if (hasselbladClicks >= 3) {
        hasselbladClicks = 0;
        clearTimeout(hasselbladClickTimer);
        playBackdoorUnlockSound();
        showToast('🔓 Hasselblad Secret Backgate Opened!');
        if (lutBackdoorModal) {
          lutBackdoorModal.open();
        }
      }
    });
  }

  // Secret Keyboard Shortcut: Ctrl+Shift+L or Alt+L
  window.addEventListener('keydown', (e) => {
    if (((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) ||
        (e.altKey && (e.key === 'L' || e.key === 'l'))) {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      e.preventDefault();
      if (lutBackdoorModal) {
        lutBackdoorModal.toggle();
      }
    }
  });
}

/**
 * Handle responsive canvas resizing smoothly
 */
function setupResizeObserver() {
  const canvasArea = document.getElementById('canvasArea');
  if (!canvasArea) return;
  let prevWidth = 0;
  let prevHeight = 0;
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) continue;
      if (Math.abs(width - prevWidth) > 8 || Math.abs(height - prevHeight) > 8) {
        prevWidth = width;
        prevHeight = height;
        if (canvasResizer && canvasResizer.isFitMode) {
          canvasResizer.fitToScreen();
        } else {
          updatePreview();
        }
      }
    }
  });
  resizeObserver.observe(canvasArea);
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
    }

    // Restore saved 3D LUT if present
    if (saved.lut && saved.lut.id) {
      try {
        const allLuts = lutManager.getAllLuts();
        const matched = allLuts.find(l => l.id === saved.lut.id);
        if (matched) {
          await lutManager.selectLut(matched, saved.lut.intensity ?? 1.0);
        }
      } catch (lutErr) {
        console.warn('Could not restore saved LUT:', lutErr);
      }
    }

    // Check if AI recommendation was applied from AI Photography Director
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
