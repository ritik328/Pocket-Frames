/**
 * Pocket Frames V2 — Overlay Interaction Controller
 *
 * Manages a thin transparent DOM div that sits over the canvas.
 * Handles element selection, drag, rotate, and scale.
 * All coordinates are stored in logical (2160×2700) space — DOM positions
 * are derived from logical coords × scale. State changes always go through
 * the SceneStore — DOM is never the source of truth.
 */

import { sceneStore } from './scene.js';

const HANDLE_SIZE = 14;      // px in viewport space
const MIN_SIZE    = 40;      // minimum element size in logical pixels
const ROTATE_DIST = 28;      // px from element top-center to rotation handle

export class OverlayController {
  constructor(overlayEl, canvasEl, getScale) {
    this._overlay   = overlayEl;   // the transparent div on top of canvas
    this._canvas    = canvasEl;
    this._getScale  = getScale;    // () => current scale factor

    this._selectedId  = null;
    this._mode        = 'idle';    // idle | drag | rotate | scale
    this._startPtr    = null;
    this._startEl     = null;      // snapshot of element at pointer-down

    this._selBox      = null;      // the .v2-selection div
    this._onChangeCallbacks = new Set();

    this._buildSelectionBox();
    this._bindEvents();
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  get selectedId() { return this._selectedId; }

  selectElement(id) {
    this._selectedId = id;
    this._updateSelectionBox();
    this._onChangeCallbacks.forEach(fn => fn(id));
  }

  deselect() {
    this._selectedId = null;
    if (this._selBox) this._selBox.style.display = 'none';
    this._onChangeCallbacks.forEach(fn => fn(null));
  }

  onSelectionChange(fn) {
    this._onChangeCallbacks.add(fn);
    return () => this._onChangeCallbacks.delete(fn);
  }

  /** Call whenever the canvas scale changes (resize, zoom) */
  refresh() {
    this._updateSelectionBox();
  }

  onScaleChange() {
    this.refresh();
  }

  // ── Selection box DOM ───────────────────────────────────────────────────────
  _buildSelectionBox() {
    const box = document.createElement('div');
    box.className = 'v2-sel';
    box.innerHTML = `
      <div class="v2-sel__rotate"  data-handle="rotate"></div>
      <div class="v2-sel__scale"   data-handle="scale"></div>
      <div class="v2-sel__toolbar">
        <button class="v2-sel__btn" data-action="duplicate" title="Duplicate (⌘D)">⧉</button>
        <button class="v2-sel__btn" data-action="bringFront" title="Bring front">↑</button>
        <button class="v2-sel__btn" data-action="sendBack" title="Send back">↓</button>
        <button class="v2-sel__btn" data-action="flipX" title="Flip H">⇆</button>
        <button class="v2-sel__btn" data-action="shadow" title="Toggle shadow">◐</button>
        <button class="v2-sel__btn v2-sel__btn--del" data-action="delete" title="Delete (Del)">✕</button>
      </div>
    `;
    box.style.display = 'none';
    this._overlay.appendChild(box);
    this._selBox = box;

    // Toolbar button actions
    box.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('pointerdown', e => { e.stopPropagation(); });
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._handleAction(btn.dataset.action);
      });
    });
  }

  _handleAction(action) {
    const id = this._selectedId;
    if (!id) return;

    switch (action) {
      case 'delete':
        this.deselect();
        sceneStore.deleteElement(id);
        break;
      case 'duplicate': {
        const clone = sceneStore.duplicateElement(id);
        if (clone) this.selectElement(clone.id);
        break;
      }
      case 'bringFront': sceneStore.reorderElement(id, 'front'); break;
      case 'sendBack':   sceneStore.reorderElement(id, 'back');  break;
      case 'flipX': {
        const el = sceneStore.scene.elements.find(e => e.id === id);
        if (el) sceneStore.updateElementWithHistory(id, { flipX: !el.flipX });
        break;
      }
      case 'shadow': {
        const el = sceneStore.scene.elements.find(e => e.id === id);
        if (el) sceneStore.updateElementWithHistory(id, { shadow: !el.shadow });
        break;
      }
    }
  }

  _updateSelectionBox() {
    if (!this._selectedId || !this._selBox) return;

    const el = sceneStore.scene.elements.find(e => e.id === this._selectedId);
    if (!el) { this.deselect(); return; }

    const scale = this._getScale();
    const vx    = el.x * scale;
    const vy    = el.y * scale;
    const vw    = el.w * scale;
    const vh    = el.h * scale;

    this._selBox.style.cssText = `
      display: block;
      position: absolute;
      left:   ${vx}px;
      top:    ${vy}px;
      width:  ${vw}px;
      height: ${vh}px;
      transform-origin: center center;
      transform: rotate(${el.rotation || 0}deg);
      pointer-events: auto;
    `;
  }

  // ── Pointer events ──────────────────────────────────────────────────────────
  _bindEvents() {
    // Overlay backdrop — click to deselect / select element
    this._overlay.addEventListener('pointerdown', e => {
      if (e.target === this._overlay) {
        this.deselect();
        return;
      }

      const handle = e.target.closest('[data-handle]');
      if (handle) {
        e.preventDefault();
        this._startInteraction(handle.dataset.handle, e);
        return;
      }

      const selBox = e.target.closest('.v2-sel');
      if (selBox && this._selectedId) {
        e.preventDefault();
        this._startInteraction('drag', e);
      }
    });

    this._overlay.addEventListener('pointermove',   e => this._onPointerMove(e));
    this._overlay.addEventListener('pointerup',     e => this._onPointerUp(e));
    this._overlay.addEventListener('pointercancel', e => this._onPointerUp(e));

    // Keyboard shortcuts for selected element
    document.addEventListener('keydown', e => this._onKeyDown(e));
  }

  _startInteraction(mode, e) {
    const el = sceneStore.scene.elements.find(el => el.id === this._selectedId);
    if (!el) return;

    this._mode     = mode;
    this._startPtr = { x: e.clientX, y: e.clientY };
    this._startEl  = JSON.parse(JSON.stringify(el));  // snapshot

    this._overlay.setPointerCapture(e.pointerId);
    sceneStore._pushHistory();

    if (mode === 'rotate') {
      // Pre-compute element center in viewport for angle calc
      const scale = this._getScale();
      const rect  = this._canvas.getBoundingClientRect();
      this._rotCenter = {
        x: rect.left + (el.x + el.w / 2) * scale,
        y: rect.top  + (el.y + el.h / 2) * scale
      };
    }
  }

  _onPointerMove(e) {
    if (this._mode === 'idle' || !this._selectedId) return;
    e.preventDefault();

    const scale = this._getScale();
    const dx    = (e.clientX - this._startPtr.x) / scale;
    const dy    = (e.clientY - this._startPtr.y) / scale;

    const id    = this._selectedId;
    const snap  = this._startEl;

    switch (this._mode) {
      case 'drag':
        sceneStore.updateElement(id, {
          x: snap.x + dx,
          y: snap.y + dy
        });
        break;

      case 'scale': {
        const newW = Math.max(MIN_SIZE, snap.w + dx * 2);
        const newH = Math.max(MIN_SIZE, snap.h + dy * 2);
        // Proportional scale
        const ratio = newW / snap.w;
        sceneStore.updateElement(id, {
          w: newW,
          h: snap.h * ratio
        });
        break;
      }

      case 'rotate': {
        const rc  = this._rotCenter;
        const ang = Math.atan2(e.clientY - rc.y, e.clientX - rc.x);
        // Snap to 15° increments if Shift held
        let deg = (ang * 180) / Math.PI + 90;
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        sceneStore.updateElement(id, { rotation: deg });
        break;
      }
    }

    this._updateSelectionBox();
  }

  _onPointerUp(e) {
    this._mode     = 'idle';
    this._startPtr = null;
    this._startEl  = null;
    try { this._overlay.releasePointerCapture(e.pointerId); } catch {}
  }

  _onKeyDown(e) {
    const id = this._selectedId;
    if (!id) return;

    const el = sceneStore.scene.elements.find(el => el.id === id);
    if (!el) return;

    const nudge  = e.shiftKey ? 20 : 2;
    let handled  = true;

    switch (e.key) {
      case 'Delete': case 'Backspace':
        if (document.activeElement?.tagName !== 'INPUT' &&
            document.activeElement?.tagName !== 'TEXTAREA') {
          this.deselect();
          sceneStore.deleteElement(id);
        } else { handled = false; }
        break;
      case 'ArrowLeft':  sceneStore.updateElement(id, { x: el.x - nudge }); break;
      case 'ArrowRight': sceneStore.updateElement(id, { x: el.x + nudge }); break;
      case 'ArrowUp':    sceneStore.updateElement(id, { y: el.y - nudge }); break;
      case 'ArrowDown':  sceneStore.updateElement(id, { y: el.y + nudge }); break;
      case '[': sceneStore.updateElement(id, { rotation: (el.rotation || 0) - 5 }); break;
      case ']': sceneStore.updateElement(id, { rotation: (el.rotation || 0) + 5 }); break;
      case 'd': case 'D':
        if (e.ctrlKey || e.metaKey) {
          const clone = sceneStore.duplicateElement(id);
          if (clone) this.selectElement(clone.id);
        } else { handled = false; }
        break;
      default: handled = false;
    }

    if (handled) {
      e.preventDefault();
      this._updateSelectionBox();
    }
  }

  // ── Hit testing — click on canvas to select element ─────────────────────────
  hitTestCanvas(clientX, clientY) {
    const rect  = this._canvas.getBoundingClientRect();
    const scale = this._getScale();

    // Logical coords of click
    const lx = (clientX - rect.left)  / scale;
    const ly = (clientY - rect.top)   / scale;

    // Test elements in reverse z-order (topmost first)
    const sorted = [...sceneStore.scene.elements]
      .filter(e => e.visible && !e.locked)
      .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

    for (const el of sorted) {
      if (this._pointInElement(lx, ly, el)) {
        this.selectElement(el.id);
        this._startInteraction('drag', { clientX, clientY, pointerId: -1 });
        try { this._overlay.setPointerCapture(-1); } catch {}
        return el.id;
      }
    }

    this.deselect();
    return null;
  }

  _pointInElement(lx, ly, el) {
    // Translate to element-local space accounting for rotation
    const cx    = el.x + el.w / 2;
    const cy    = el.y + el.h / 2;
    const angle = (-(el.rotation || 0) * Math.PI) / 180;
    const dx    = lx - cx;
    const dy    = ly - cy;
    const rx    = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ry    = dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(rx) <= el.w / 2 && Math.abs(ry) <= el.h / 2;
  }
}
