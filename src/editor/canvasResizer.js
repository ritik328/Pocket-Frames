/**
 * Pocket Frames — Liquid Glass Canvas Resizer
 * Provides fluid, interactive canvas resizing via:
 *   - Liquid glass toggle presets (S, M, L, XL, Fit)
 *   - Liquid glass slider and - / + precision buttons
 *   - Corner drag handle on the Polaroid canvas
 * Synchronizes with renderFrame and positionManager seamlessly.
 */

const STORAGE_KEY = 'pocketframes-canvas-width';
const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 260;

export class CanvasResizer {
  constructor(canvasElement, containerElement, onResizeCallback) {
    this.canvas = canvasElement;
    this.container = containerElement;
    this.canvasArea = document.getElementById('canvasArea');
    this.onResize = onResizeCallback || (() => {});

    // Elements
    this.dock = document.getElementById('canvasLiquidDock');
    this.toggleGroup = document.getElementById('liquidToggleGroup');
    this.toggleBtns = document.querySelectorAll('.liquid-toggle-btn');
    this.togglePill = document.getElementById('liquidTogglePill');
    this.slider = document.getElementById('canvasSizeSlider');
    this.badge = document.getElementById('canvasSizeBadge');
    this.btnZoomIn = document.getElementById('btnCanvasZoomIn');
    this.btnZoomOut = document.getElementById('btnCanvasZoomOut');
    this.btnReset = document.getElementById('btnCanvasResetSize');
    this.dragHandle = document.getElementById('canvasResizeHandle');

    // State
    this.currentWidth = DEFAULT_WIDTH;
    this.isDraggingHandle = false;
    this.dragStartData = null;
    this.isFitMode = false;

    this.init();
  }

  getMaxWidth() {
    const areaW = (this.canvasArea ? this.canvasArea.clientWidth : window.innerWidth) - 48;
    return Math.min(680, Math.max(480, areaW));
  }

  init() {
    // Restore saved width if valid
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= 720) {
          this.currentWidth = parsed;
        }
      }
    } catch (e) {}

    // Apply initial width
    this.applyWidth(this.currentWidth, false);

    // Setup Event Listeners
    this.setupTogglePresets();
    this.setupSlider();
    this.setupStepButtons();
    this.setupDragHandle();
    this.setupWindowResize();

    // Initial pill position after layout pass
    requestAnimationFrame(() => {
      this.updatePillPosition();
    });
  }

  applyWidth(width, animate = true) {
    const maxW = this.getMaxWidth();
    const clamped = Math.max(MIN_WIDTH, Math.min(width, maxW));
    this.currentWidth = clamped;

    if (this.canvas) {
      if (!animate) {
        this.canvas.classList.add('is-resizing');
      } else {
        this.canvas.classList.remove('is-resizing');
      }
      this.canvas.style.width = `${clamped}px`;
    }

    if (this.container) {
      this.container.style.width = `${clamped}px`;
    }

    // Update slider without re-triggering input event
    if (this.slider && Number(this.slider.value) !== clamped) {
      this.slider.max = String(maxW);
      this.slider.value = String(clamped);
    }

    // Update badge: e.g. "400px"
    if (this.badge) {
      this.badge.textContent = `${clamped}px`;
    }

    // Update preset toggle buttons active status
    this.updateActivePreset();

    // Persist
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch (e) {}

    // Trigger re-render
    if (this.onResize) {
      this.onResize(clamped);
    }
  }

  setupTogglePresets() {
    if (!this.toggleBtns) return;

    this.toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sizeAttr = btn.dataset.size;
        if (sizeAttr === 'fit') {
          this.fitToScreen();
        } else {
          this.isFitMode = false;
          const targetW = parseInt(sizeAttr, 10);
          if (!isNaN(targetW)) {
            this.applyWidth(targetW, true);
          }
        }
      });
    });
  }

  fitToScreen() {
    this.isFitMode = true;
    if (!this.canvasArea) return;
    // Available height in canvas area minus dock height and padding
    const availH = Math.max(320, this.canvasArea.clientHeight - 130);
    // 4:5 aspect ratio -> width = height * 0.8
    const fitW = Math.round(availH * 0.8);
    this.applyWidth(fitW, true);

    // Highlight fit button
    this.toggleBtns.forEach(b => {
      b.classList.toggle('is-active', b.dataset.size === 'fit');
    });
    this.updatePillPosition();
  }

  updateActivePreset() {
    if (this.isFitMode) return;

    let matchedBtn = null;
    const presets = [300, 400, 480, 560];

    this.toggleBtns.forEach(btn => {
      const val = parseInt(btn.dataset.size, 10);
      if (val === this.currentWidth) {
        matchedBtn = btn;
      }
    });

    this.toggleBtns.forEach(btn => {
      btn.classList.toggle('is-active', btn === matchedBtn);
    });

    this.updatePillPosition();
  }

  updatePillPosition() {
    if (!this.togglePill || !this.toggleGroup) return;

    const activeBtn = this.toggleGroup.querySelector('.liquid-toggle-btn.is-active');
    if (activeBtn) {
      const left = activeBtn.offsetLeft;
      const width = activeBtn.offsetWidth;
      this.togglePill.style.transform = `translateX(${left}px)`;
      this.togglePill.style.width = `${width}px`;
      this.togglePill.style.opacity = '1';
    } else {
      this.togglePill.style.opacity = '0';
    }
  }

  setupSlider() {
    if (!this.slider) return;

    this.slider.addEventListener('input', e => {
      this.isFitMode = false;
      const val = parseInt(e.target.value, 10);
      this.applyWidth(val, false);
    });

    this.slider.addEventListener('change', () => {
      if (this.canvas) {
        this.canvas.classList.remove('is-resizing');
      }
      this.applyWidth(this.currentWidth, true);
    });
  }

  setupStepButtons() {
    if (this.btnZoomIn) {
      this.btnZoomIn.addEventListener('click', () => {
        this.isFitMode = false;
        this.applyWidth(this.currentWidth + 25, true);
      });
    }

    if (this.btnZoomOut) {
      this.btnZoomOut.addEventListener('click', () => {
        this.isFitMode = false;
        this.applyWidth(this.currentWidth - 25, true);
      });
    }

    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => {
        this.isFitMode = false;
        this.applyWidth(DEFAULT_WIDTH, true);
      });
    }
  }

  setupDragHandle() {
    if (!this.dragHandle) return;

    const onPointerDown = e => {
      e.preventDefault();
      e.stopPropagation();

      this.isDraggingHandle = true;
      this.isFitMode = false;
      this.dragStartData = {
        startX: e.clientX,
        startY: e.clientY,
        startW: this.currentWidth
      };

      this.dragHandle.setPointerCapture(e.pointerId);
      document.body.classList.add('is-resizing-canvas');
      if (this.canvas) this.canvas.classList.add('is-resizing');
    };

    const onPointerMove = e => {
      if (!this.isDraggingHandle || !this.dragStartData) return;

      const dx = e.clientX - this.dragStartData.startX;
      const dy = (e.clientY - this.dragStartData.startY) * 0.8; // diagonal aspect-ratio tracking
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      const targetW = Math.round(this.dragStartData.startW + delta);

      this.applyWidth(targetW, false);
    };

    const onPointerUp = e => {
      if (!this.isDraggingHandle) return;
      this.isDraggingHandle = false;
      this.dragStartData = null;

      try {
        this.dragHandle.releasePointerCapture(e.pointerId);
      } catch (err) {}

      document.body.classList.remove('is-resizing-canvas');
      if (this.canvas) this.canvas.classList.remove('is-resizing');
      this.applyWidth(this.currentWidth, true);
    };

    this.dragHandle.addEventListener('pointerdown', onPointerDown);
    this.dragHandle.addEventListener('pointermove', onPointerMove);
    this.dragHandle.addEventListener('pointerup', onPointerUp);
    this.dragHandle.addEventListener('pointercancel', onPointerUp);
  }

  setupWindowResize() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const maxW = this.getMaxWidth();
        if (this.slider) this.slider.max = String(maxW);
        if (this.isFitMode) {
          this.fitToScreen();
        } else if (this.currentWidth > maxW) {
          this.applyWidth(maxW, false);
        } else {
          this.updatePillPosition();
        }
      }, 80);
    });
  }
}
