/**
 * Pocket Frames - Gesture Anchoring Calculations
 */
import { FRAME_GEOMETRY } from '../frame/frameGeometry.js';
import { clampZoom } from './zoomManager.js';

/**
 * Calculates new transform when zooming anchored to an arbitrary viewport coordinate
 * @param {number} anchorViewportX - Screen X of anchor (cursor or touch midpoint)
 * @param {number} anchorViewportY - Screen Y of anchor
 * @param {DOMRect} canvasRect - Preview canvas bounding client rect
 * @param {number} previewScale - Scale ratio (canvas display width / 2160)
 * @param {number} currentScale - Current transform.scale
 * @param {number} newScale - Proposed transform.scale
 * @param {number} currentX - Current transform.x in export space
 * @param {number} currentY - Current transform.y in export space
 */
export function calculateAnchoredZoom({
  anchorViewportX,
  anchorViewportY,
  canvasRect,
  previewScale,
  currentScale,
  newScale,
  currentX,
  currentY
}) {
  const boundedNewScale = clampZoom(newScale);
  if (Math.abs(boundedNewScale - currentScale) < 0.0001) {
    return { x: currentX, y: currentY, scale: currentScale };
  }

  // Convert anchor from viewport pixels to canvas pixels
  const canvasX = anchorViewportX - canvasRect.left;
  const canvasY = anchorViewportY - canvasRect.top;

  // Convert to export space
  const exportX = canvasX / previewScale;
  const exportY = canvasY / previewScale;

  // Center of the photo aperture in export space
  const apCenterX = FRAME_GEOMETRY.aperture.centerX;
  const apCenterY = FRAME_GEOMETRY.aperture.centerY;

  // Anchor relative to current rendered image center
  // Rendered center is at (apCenterX + currentX, apCenterY + currentY)
  const anchorFromCenterRelX = exportX - (apCenterX + currentX);
  const anchorFromCenterRelY = exportY - (apCenterY + currentY);

  // Ratio of zoom
  const ratio = boundedNewScale / currentScale;

  // In the new scale, the anchor should remain at the same export space coordinate:
  // newAnchorFromCenterRelX = anchorFromCenterRelX * ratio
  // exportX - (apCenterX + newX) = (exportX - (apCenterX + currentX)) * ratio
  // => newX = exportX - apCenterX - (exportX - apCenterX - currentX) * ratio
  const newX = exportX - apCenterX - (exportX - apCenterX - currentX) * ratio;
  const newY = exportY - apCenterY - (exportY - apCenterY - currentY) * ratio;

  return {
    x: newX,
    y: newY,
    scale: boundedNewScale
  };
}
