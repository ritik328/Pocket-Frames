/**
 * Pocket Frames - Mathematical AI Composition Applier
 * Converts Gemini's normalized subject center (recommended_x, recommended_y)
 * and zoom multiplier into canonical export-space transform offsets.
 */

import { FRAME_GEOMETRY } from '../frame/frameGeometry.js';
import { calculateFillScale, clampZoom, MIN_ZOOM, MAX_ZOOM } from '../editor/zoomManager.js';

/**
 * Calculate canvas transform from AI composition recommendation
 * 
 * @param {Object} recommendation - { recommended_x, recommended_y, recommended_zoom, confidence }
 * @param {Object} image - { width, height }
 * @returns {Object} { x, y, scale } in Pocket Frames canonical export space
 */
export function calculateTransformFromAi(recommendation, image) {
  if (!recommendation || !image || !image.width || !image.height) {
    return { x: 0, y: 0, scale: 1.0 };
  }

  const { width: imgW, height: imgH } = image;
  const apW = FRAME_GEOMETRY.aperture.width;   // 1960
  const apH = FRAME_GEOMETRY.aperture.height;  // 1720

  // 1. Calculate Base Scale (Fill scale ensures aperture coverage)
  const baseScale = calculateFillScale(imgW, imgH);

  // 2. Apply Recommended Zoom (clamped to [MIN_ZOOM, MAX_ZOOM])
  const zoomMultiplier = typeof recommendation.recommended_zoom === 'number' 
    ? recommendation.recommended_zoom 
    : 1.0;
  
  const targetScale = clampZoom(baseScale * zoomMultiplier);

  // 3. Subject Center Normalized Coordinates:
  // (0.5, 0.5) is the exact center of the photograph.
  // If the subject is at recommended_x > 0.5, we pan left (negative x) to center it.
  const normX = Math.max(0.0, Math.min(1.0, typeof recommendation.recommended_x === 'number' ? recommendation.recommended_x : 0.5));
  const normY = Math.max(0.0, Math.min(1.0, typeof recommendation.recommended_y === 'number' ? recommendation.recommended_y : 0.5));

  // Offset in export pixels
  const rawOffsetX = (0.5 - normX) * (imgW * targetScale);
  const rawOffsetY = (0.5 - normY) * (imgH * targetScale);

  // 4. Safe Boundary Clamping (prevents subject from being dragged completely out of frame)
  const maxSafeX = Math.max(200, (imgW * targetScale) / 2);
  const maxSafeY = Math.max(200, (imgH * targetScale) / 2);

  const clampedX = Math.max(-maxSafeX, Math.min(maxSafeX, Math.round(rawOffsetX)));
  const clampedY = Math.max(-maxSafeY, Math.min(maxSafeY, Math.round(rawOffsetY)));

  return {
    x: clampedX,
    y: clampedY,
    scale: parseFloat(targetScale.toFixed(3))
  };
}

/**
 * Apply AI recommendation to the active state store with undo history
 */
export function applyAiComposition(store, recommendation) {
  const state = store.getState();
  if (!state.image) return false;

  const targetTransform = calculateTransformFromAi(recommendation, state.image);
  
  // Push state to undo stack before updating
  store.pushHistory();
  store.setTransform(targetTransform, true);
  return true;
}
