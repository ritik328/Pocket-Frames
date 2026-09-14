/**
 * Pocket Frames - Mathematical Zoom & Fit/Fill Engine
 */
import { FRAME_GEOMETRY } from '../frame/frameGeometry.js';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5.0;

/**
 * Calculates FIT scale (entire image visible within aperture)
 * scale = min(apertureWidth / imageWidth, apertureHeight / imageHeight)
 */
export function calculateFitScale(imageWidth, imageHeight) {
  if (!imageWidth || !imageHeight) return 1.0;
  const { width: apW, height: apH } = FRAME_GEOMETRY.aperture;
  return Math.min(apW / imageWidth, apH / imageHeight);
}

/**
 * Calculates FILL scale (aperture completely covered)
 * scale = max(apertureWidth / imageWidth, apertureHeight / imageHeight)
 */
export function calculateFillScale(imageWidth, imageHeight) {
  if (!imageWidth || !imageHeight) return 1.0;
  const { width: apW, height: apH } = FRAME_GEOMETRY.aperture;
  return Math.max(apW / imageWidth, apH / imageHeight);
}

/**
 * Clamp zoom to supported boundaries
 */
export function clampZoom(scale) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
}
