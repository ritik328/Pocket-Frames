/**
 * Pocket Frames — Liquid Glass Canvas Resizer
 * Provides fluid, interactive canvas resizing via:
 *   - Liquid glass toggle presets (S, M, L, XL, Fit)
 *   - Liquid glass slider and - / + precision buttons
 *   - Corner drag handle on the Polaroid/Studio canvas
 * Supports both Hasselblad page and Studio Frame page.
 */

const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 260;

export class CanvasResizer {
  constructor(canvasElement, containerElement, onResizeCallback, options = {}) {
    this.canvas = canvasElement;
    this.container = containerElement;
    this.options = options;
    this.onResize = onResizeCallback || (() => {});
    this.canvasArea = options.canvasArea || document.getElementById(options.canvasAreaId || 'canvasArea');
    this.overlayEl = options.overlayEl || null;
    this.aspectRatio = options.aspectRatio || (5 / 4); // height / width
    this.storageKey = options.storageKey || 'pocketframes-canvas-width';
    this.defaultWidth = options.defaultWidth || DEFAULT_WIDTH;

    const p = options.prefix || '';

    this.dock = document.getElementById(options.dockId || (p ? `${p}CanvasLiquidDock` : 'canvasLiquidDock'));
    this.toggleGroup = document.getElementById(options.toggleGroupId || (p ? `${p}LiquidToggleGroup` : 'liquidToggleGroup'));
    this.toggleBtns = this.toggleGroup
      ? this.toggleGroup.querySelectorAll('.liquid-toggle-btn')
      : document.querySelectorAll(options.toggleBtnSelector || '.liquid-toggle-btn');
    this.togglePill = document.getElementById(options.togglePillId || (p ? `${p}LiquidTogglePill` : 'liquidTogglePill'));
    this.slider = document.getElementById(options.sliderId || (p ? `${p}CanvasSizeSlider` : 'canvasSizeSlider'));
    this.badge = document.getElementById(options.badgeId || (p ? `${p}CanvasSizeBadge` : 'canvasSizeBadge'));
    this.btnZoomIn = document.getElementById(options.btnZoomInId || (p ? `${p}BtnCanvasZoomIn` : 'btnCanvasZoomIn'));
    this.btnZoomOut = document.getElementById(options.btnZoomOutId || (p ? `${p}BtnCanvasZoomOut` : 'btnCanvasZoomOut'));
    this.btnReset = document.getElementById(options.btnResetId || (p ? `${p}BtnCanvasResetSize` : 'btnCanvasResetSize'));
    this.dragHandle = document.getElementById(options.dragHandleId || (p ? `${p}CanvasResizeHandle` : 'canvasResizeHandle'));

    // State
    this.currentWidth = this.defaultWidth;
    this.isDraggingHandle = false;
    this.dragStartData = null;
    this.isFitMode = options.defaultFit !== undefined ? options.defaultFit : false;

    this.init();
  }

  getMaxWidth() {
    const areaW = (this.canvasArea ? this.canvasArea.clientWidth : window.innerWidth) - 48;
    return Math.min(720, Math.max(480, areaW));
  }

  init() {
    // Restore saved width if valid
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        if (saved === 'fit') {
          this.isFitMode = true;
        } else {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= 800) {
            this.currentWidth = parsed;
            this.isFitMode = false;
          }
        }
      }
    } catch (e) {}

    // Setup Event Listeners
    this.setupTogglePresets();
    this.setupSlider();
    this.setupStepButtons();
    this.setupDragHandle();
    this.setupWindowResize();

    // Apply initial width / fit
    if (this.isFitMode) {
      requestAnimationFrame(() => {
        this.fitToScreen();
      });
    } else {
      this.applyWidth(this.currentWidth, false);
      requestAnimationFrame(() => {
        this.updatePillPosition();
      });
    }
  }

  applyWidth(width, animate = true) {
    const maxW = this.getMaxWidth();
    const clamped = Math.max(MIN_WIDTH, Math.min(width, maxW));
    this.currentWidth = clamped;
    const height = Math.round(clamped * this.aspectRatio);

    if (this.canvas) {
      if (!animate) {
        this.canvas.classList.add('is-resizing');
      } else {
        this.canvas.classList.remove('is-resizing');
      }
      this.canvas.style.width = `${clamped}px`;
      if (this.options.setHeight) {
        this.canvas.style.height = `${height}px`;
      }
    }

    if (this.container) {
      this.container.style.width = `${clamped}px`;
      if (this.options.setHeight) {
        this.container.style.height = `${height}px`;
      }
    }

    if (this.overlayEl) {
      this.overlayEl.style.width = `${clamped}px`;
      this.overlayEl.style.height = `${height}px`;
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
      localStorage.setItem(this.storageKey, this.isFitMode ? 'fit' : String(clamped));
    } catch (e) {}

    // Trigger re-render
    if (this.onResize) {
      this.onResize(clamped, height);
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
    const padding = this.options.fitPaddingBottom || 110;
    const availH = Math.max(300, this.canvasArea.clientHeight - padding);
    const availW = Math.max(260, this.canvasArea.clientWidth - 48);
    let fitW = Math.round(availH / this.aspectRatio);
    if (fitW > availW) fitW = availW;

    this.applyWidth(fitW, true);

    // Highlight fit button
    this.toggleBtns.forEach(b => {
      b.classList.toggle('is-active', b.dataset.size === 'fit');
    });
    this.updatePillPosition();
  }

  updateActivePreset() {
    if (this.isFitMode) {
      this.toggleBtns.forEach(b => {
        b.classList.toggle('is-active', b.dataset.size === 'fit');
      });
      this.updatePillPosition();
      return;
    }

    let matchedBtn = null;

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
        if (this.options.defaultFit) {
          this.fitToScreen();
        } else {
          this.isFitMode = false;
          this.applyWidth(this.defaultWidth, true);
        }
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
      const dy = (e.clientY - this.dragStartData.startY) / this.aspectRatio;
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
