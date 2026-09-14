/**
 * Pocket Frames - Alignment & Magnetic Snapping Engine
 * Calculates rendered image bounds/center relative to the aperture center in canonical export space.
 */
import { FRAME_GEOMETRY } from '../frame/frameGeometry.js';

export function checkAlignment(transform, tolerance = FRAME_GEOMETRY.alignmentTolerance) {
  // transform.x is offset from apertureCenterX (0 = perfectly centered horizontally)
  // transform.y is offset from apertureCenterY (0 = perfectly centered vertically)
  const isXAligned = Math.abs(transform.x) <= tolerance;
  const isYAligned = Math.abs(transform.y) <= tolerance;

  return {
    isXAligned,          // Controls vertical center guide (X-axis alignment)
    isYAligned,          // Controls horizontal center guide (Y-axis alignment)
    isFullyAligned: isXAligned && isYAligned,
    deltaX: transform.x,
    deltaY: transform.y
  };
}

/**
 * Apply magnetic snapping to proposed offset in export space
 * @param {number} x - Proposed transform.x in export space
 * @param {number} y - Proposed transform.y in export space
 * @param {boolean} snapEnabled 
 * @param {number} threshold 
 */
export function applyMagneticSnap(x, y, snapEnabled = true, threshold = FRAME_GEOMETRY.snapThreshold) {
  if (!snapEnabled) {
    return { x, y, snappedX: false, snappedY: false };
  }

  let finalX = x;
  let finalY = y;
  let snappedX = false;
  let snappedY = false;

  if (Math.abs(x) <= threshold) {
    finalX = 0;
    snappedX = true;
  }

  if (Math.abs(y) <= threshold) {
    finalY = 0;
    snappedY = true;
  }

  return {
    x: finalX,
    y: finalY,
    snappedX,
    snappedY
  };
}
