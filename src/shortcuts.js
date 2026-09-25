/**
 * Pocket Frames - Global Keyboard Shortcuts
 */
import { store } from './state.js';
import { calculateFitScale, calculateFillScale, clampZoom } from './editor/zoomManager.js';
import { applyMagneticSnap } from './editor/alignment.js';
import { videoManager } from './video/videoManager.js';

export function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Ignore keyboard shortcuts when user is actively editing text inputs
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    const isInputActive = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

    // Allow Undo/Redo even in input fields if needed, or handle standard keys
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          // Redo
          e.preventDefault();
          store.redo();
          return;
        } else {
          // Undo
          e.preventDefault();
          store.undo();
          return;
        }
      }
      if (e.key === 'y' || e.key === 'Y') {
        // Redo
        e.preventDefault();
        store.redo();
        return;
      }
    }

    // From here down, don't trigger editor shortcuts if focused in an input field
    if (isInputActive) return;

    const state = store.getState();
    const hasImage = Boolean(state.image);

    // Escape: exit clean preview
    if (e.key === 'Escape') {
      if (state.editor.cleanPreview) {
        store.setEditor({ cleanPreview: false });
      }
      return;
    }

    // Space: toggle video playback if video is loaded, otherwise toggle clean preview mode
    if (e.code === 'Space') {
      e.preventDefault();
      if (state.image && (state.image.type === 'video' || state.image.isVideo)) {
        videoManager.togglePlay();
        return;
      }
      store.setEditor({ cleanPreview: !state.editor.cleanPreview });
      return;
    }

    // G: toggle grid
    if (e.key === 'g' || e.key === 'G') {
      e.preventDefault();
      store.setEditor({ gridVisible: !state.editor.gridVisible });
      return;
    }

    if (!hasImage) return;

    // R: reset position & zoom
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      const fillScale = calculateFillScale(state.image.width, state.image.height);
      store.setTransform({ x: 0, y: 0, scale: fillScale }, true);
      return;
    }

    // + or =: zoom in
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      const newScale = clampZoom(state.transform.scale * 1.05);
      store.setTransform({ scale: newScale }, true);
      return;
    }

    // - or _: zoom out
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      const newScale = clampZoom(state.transform.scale * 0.95);
      store.setTransform({ scale: newScale }, true);
      return;
    }

    // Arrow keys: nudge image in export space
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 40 : 8; // export pixels step

      let deltaX = 0;
      let deltaY = 0;

      if (e.key === 'ArrowLeft') deltaX = -step;
      if (e.key === 'ArrowRight') deltaX = step;
      if (e.key === 'ArrowUp') deltaY = -step;
      if (e.key === 'ArrowDown') deltaY = step;

      const proposedX = state.transform.x + deltaX;
      const proposedY = state.transform.y + deltaY;

      const snapped = applyMagneticSnap(proposedX, proposedY, state.editor.snapEnabled);
      store.setTransform({ x: snapped.x, y: snapped.y }, true);
    }
  });
}
