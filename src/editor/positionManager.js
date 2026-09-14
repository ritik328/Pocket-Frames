/**
 * Pocket Frames - Position, Drag, Pinch, and Wheel Interaction Manager
 */
import { store } from '../state.js';
import { applyMagneticSnap } from './alignment.js';
import { calculateAnchoredZoom } from './gestures.js';
import { FRAME_GEOMETRY } from '../frame/frameGeometry.js';
import { loadUserImage } from '../image/imageLoader.js';

export class PositionManager {
  constructor(canvasElement, containerElement) {
    this.canvas = canvasElement;
    this.container = containerElement;

    this.activePointers = new Map();
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.transformStart = { x: 0, y: 0, scale: 1 };
    this.initialPinchDistance = 0;
    this.initialPinchScale = 1;
    this.initialPinchMidpoint = { x: 0, y: 0 };
    this.wheelDebounceTimer = null;

    this.init();
  }

  init() {
    // Touch & Mouse Pointer Events
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));
    window.addEventListener('pointercancel', this.onPointerUp.bind(this));

    // Mouse Wheel Zoom
    this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

    // Drag & Drop Upload directly onto preview
    this.setupDragAndDrop();
  }

  getPreviewScale() {
    const rect = this.canvas.getBoundingClientRect();
    return rect.width / FRAME_GEOMETRY.width;
  }

  onPointerDown(e) {
    const state = store.getState();
    if (!state.image) return;

    this.canvas.setPointerCapture(e.pointerId);
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 1) {
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.transformStart = { ...state.transform };
      this.canvas.style.cursor = 'grabbing';
    } else if (this.activePointers.size === 2) {
      // Begin pinch
      this.isDragging = false;
      const [p1, p2] = Array.from(this.activePointers.values());
      this.initialPinchDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      this.initialPinchScale = state.transform.scale;
      this.initialPinchMidpoint = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      };
      this.transformStart = { ...state.transform };
    }
  }

  onPointerMove(e) {
    if (!this.activePointers.has(e.pointerId)) return;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const state = store.getState();
    if (!state.image) return;

    const previewScale = this.getPreviewScale();
    if (previewScale <= 0) return;

    if (this.activePointers.size === 1 && this.isDragging) {
      // Single finger / mouse pan
      const deltaX = (e.clientX - this.dragStart.x) / previewScale;
      const deltaY = (e.clientY - this.dragStart.y) / previewScale;

      const proposedX = this.transformStart.x + deltaX;
      const proposedY = this.transformStart.y + deltaY;

      const snapped = applyMagneticSnap(
        proposedX,
        proposedY,
        state.editor.snapEnabled
      );

      store.setTransform({
        x: snapped.x,
        y: snapped.y
      }, false);
    } else if (this.activePointers.size === 2) {
      // Two fingers pinch-to-zoom anchored at midpoint
      const [p1, p2] = Array.from(this.activePointers.values());
      const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (this.initialPinchDistance <= 0) return;

      const zoomFactor = currentDistance / this.initialPinchDistance;
      const proposedScale = this.initialPinchScale * zoomFactor;

      const currentMidpoint = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      };

      const canvasRect = this.canvas.getBoundingClientRect();
      const updatedTransform = calculateAnchoredZoom({
        anchorViewportX: currentMidpoint.x,
        anchorViewportY: currentMidpoint.y,
        canvasRect,
        previewScale,
        currentScale: state.transform.scale,
        newScale: proposedScale,
        currentX: state.transform.x,
        currentY: state.transform.y
      });

      store.setTransform(updatedTransform, false);
    }
  }

  onPointerUp(e) {
    if (!this.activePointers.has(e.pointerId)) return;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}

    this.activePointers.delete(e.pointerId);

    if (this.activePointers.size === 0) {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
        // Commit to undo history
        store.pushHistory();
      }
    } else if (this.activePointers.size === 1) {
      // Reset drag start for remaining pointer
      const remaining = Array.from(this.activePointers.values())[0];
      this.dragStart = { x: remaining.x, y: remaining.y };
      this.transformStart = { ...store.getState().transform };
      this.isDragging = true;
    }
  }

  onWheel(e) {
    e.preventDefault();
    const state = store.getState();
    if (!state.image) return;

    const zoomStep = e.deltaY < 0 ? 1.08 : 0.92;
    const proposedScale = state.transform.scale * zoomStep;

    const canvasRect = this.canvas.getBoundingClientRect();
    const previewScale = this.getPreviewScale();

    const updatedTransform = calculateAnchoredZoom({
      anchorViewportX: e.clientX,
      anchorViewportY: e.clientY,
      canvasRect,
      previewScale,
      currentScale: state.transform.scale,
      newScale: proposedScale,
      currentX: state.transform.x,
      currentY: state.transform.y
    });

    store.setTransform(updatedTransform, false);

    // Debounce history snapshot on wheel stop
    clearTimeout(this.wheelDebounceTimer);
    this.wheelDebounceTimer = setTimeout(() => {
      store.pushHistory();
    }, 400);
  }

  setupDragAndDrop() {
    const handleDragOver = (e) => {
      e.preventDefault();
      this.container.classList.add('drag-active');
    };
    const handleDragLeave = (e) => {
      e.preventDefault();
      this.container.classList.remove('drag-active');
    };
    const handleDrop = async (e) => {
      e.preventDefault();
      this.container.classList.remove('drag-active');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        try {
          const loaded = await loadUserImage(files[0]);
          store.setImage(loaded);
        } catch (err) {
          alert(err.message || 'Error loading dropped image.');
        }
      }
    };

    this.container.addEventListener('dragover', handleDragOver);
    this.container.addEventListener('dragleave', handleDragLeave);
    this.container.addEventListener('drop', handleDrop);
  }
}
