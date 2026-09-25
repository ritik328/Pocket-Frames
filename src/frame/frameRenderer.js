/**
 * Pocket Frames - Deterministic Frame Renderer
 * Canonical rendering engine for both interactive preview and high-res export.
 */
import { FRAME_GEOMETRY, MASTER_WIDTH, MASTER_HEIGHT } from './frameGeometry.js';
import { drawCenteredText, FONT_CONFIG } from './typography.js';
import { checkAlignment } from '../editor/alignment.js';

/**
 * Render the complete deterministic frame onto target canvas
 * @param {HTMLCanvasElement} canvas - Destination canvas
 * @param {object} state - Application state
 * @param {object} options - Rendering options
 * @param {boolean} options.isExport - True if rendering final export (no UI guides)
 * @param {number} options.targetWidth - Target canvas width (default MASTER_WIDTH)
 * @param {number} options.targetHeight - Target canvas height (default MASTER_HEIGHT)
 */
export function renderFrame(canvas, state, options = {}) {
  const {
    isExport = false,
    targetWidth = MASTER_WIDTH,
    targetHeight = MASTER_HEIGHT
  } = options;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const safeW = Math.max(100, Number.isFinite(targetWidth) ? Math.round(targetWidth) : MASTER_WIDTH);
  const safeH = Math.max(100, Number.isFinite(targetHeight) ? Math.round(targetHeight) : MASTER_HEIGHT);

  const scale = safeW / MASTER_WIDTH;
  if (!Number.isFinite(scale) || scale <= 0) return;

  // Set physical canvas pixel dimensions
  if (canvas.width !== safeW || canvas.height !== safeH) {
    canvas.width = safeW;
    canvas.height = safeH;
  }

  // Clear canvas
  ctx.clearRect(0, 0, safeW, safeH);

  // 1. Draw crisp Polaroid frame background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, safeW, safeH);

  // Subtle outer hairline frame border for tactile paper look in preview
  if (!isExport) {
    ctx.strokeStyle = '#EAEAEF';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, safeW - 1, safeH - 1);
  }

  const { aperture, topBranding, deviceName, exifLine1, exifLine2 } = FRAME_GEOMETRY;

  // Aperture in target canvas coordinates
  const apX = aperture.x * scale;
  const apY = aperture.y * scale;
  const apW = aperture.width * scale;
  const apH = aperture.height * scale;
  const apCenterX = aperture.centerX * scale;
  const apCenterY = aperture.centerY * scale;

  // 2. Render photograph inside clipped aperture
  ctx.save();
  ctx.beginPath();
  ctx.rect(apX, apY, apW, apH);
  ctx.clip();

  if (state.image && state.image.element) {
    // Fill aperture background with dark neutral tone for images with empty margins
    ctx.fillStyle = '#0F0F12';
    ctx.fillRect(apX, apY, apW, apH);

    // High quality smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const img = state.image.element;
    const imgW = state.image.width || img.naturalWidth || img.videoWidth || img.width || 0;
    const imgH = state.image.height || img.naturalHeight || img.videoHeight || img.height || 0;

    if (imgW > 0 && imgH > 0) {
      // Transformed dimensions in export space, then scaled to canvas
      const drawW = imgW * state.transform.scale * scale;
      const drawH = imgH * state.transform.scale * scale;

      // Position centered at aperture center + offset
      const drawX = apCenterX + (state.transform.x * scale) - (drawW / 2);
      const drawY = apCenterY + (state.transform.y * scale) - (drawH / 2);

      if (drawW > 0 && drawH > 0 && Number.isFinite(drawW) && Number.isFinite(drawH)) {
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }
    }

    // 3. Render alignment guides & grid if in editor preview mode
    if (!isExport && state.editor.gridVisible && !state.editor.cleanPreview) {
      renderAlignmentGuides(ctx, apX, apY, apW, apH, apCenterX, apCenterY, state);
    }
  } else {
    // Empty state placeholder inside aperture
    renderEmptyAperture(ctx, apX, apY, apW, apH, scale);
  }

  ctx.restore();

  // 4. Render top branding (H A S S E L B L A D)
  const brandingText = (state.metadata.brand || 'HASSELBLAD').toUpperCase();
  ctx.fillStyle = topBranding.color;
  drawCenteredText(
    ctx,
    brandingText,
    topBranding.centerX * scale,
    topBranding.baselineY * scale,
    topBranding.fontSize * scale,
    FONT_CONFIG.branding
  );

  // 5. Render device name (e.g. OPPO Find X9)
  const deviceText = state.metadata.device || '';
  ctx.fillStyle = deviceName.color;
  drawCenteredText(
    ctx,
    deviceText,
    deviceName.centerX * scale,
    deviceName.baselineY * scale,
    deviceName.fontSize * scale,
    FONT_CONFIG.device
  );

  // 6. Render EXIF Line 1: FL 146mm   Aperture f/2.6
  const flText = state.metadata.focalLength ? `FL ${state.metadata.focalLength}` : '';
  const apText = state.metadata.aperture ? `Aperture ${state.metadata.aperture}` : '';
  const line1 = [flText, apText].filter(Boolean).join('    ');

  ctx.fillStyle = exifLine1.color;
  drawCenteredText(
    ctx,
    line1,
    exifLine1.centerX * scale,
    exifLine1.baselineY * scale,
    exifLine1.fontSize * scale,
    FONT_CONFIG.exif
  );

  // 7. Render EXIF Line 2: Shutter 1/25   ISO 1600
  const shutterText = state.metadata.shutter ? `Shutter ${state.metadata.shutter}` : '';
  const isoText = state.metadata.iso ? `ISO ${state.metadata.iso}` : '';
  const line2 = [shutterText, isoText].filter(Boolean).join('    ');

  ctx.fillStyle = exifLine2.color;
  drawCenteredText(
    ctx,
    line2,
    exifLine2.centerX * scale,
    exifLine2.baselineY * scale,
    exifLine2.fontSize * scale,
    FONT_CONFIG.exif
  );
}

/**
 * Render dynamic alignment guides and rule-of-thirds grid
 */
function renderAlignmentGuides(ctx, x, y, w, h, centerX, centerY, state) {
  const alignment = checkAlignment(state.transform);

  // A. Rule of thirds grid (subtle pastel)
  if (state.editor.ruleOfThirds) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Vertical thirds
    ctx.beginPath();
    ctx.moveTo(x + w / 3, y);
    ctx.lineTo(x + w / 3, y + h);
    ctx.moveTo(x + (2 * w) / 3, y);
    ctx.lineTo(x + (2 * w) / 3, y + h);

    // Horizontal thirds
    ctx.moveTo(x, y + h / 3);
    ctx.lineTo(x + w, y + h / 3);
    ctx.moveTo(x, y + (2 * h) / 3);
    ctx.lineTo(x + w, y + (2 * h) / 3);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // B. Vertical center guide (X-axis alignment)
  // When image center X ≈ frame center X -> Red guide!
  ctx.save();
  if (alignment.isXAligned) {
    ctx.strokeStyle = '#E53935';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(229, 57, 53, 0.5)';
    ctx.shadowBlur = 6;
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 0;
  }
  ctx.beginPath();
  ctx.moveTo(centerX, y);
  ctx.lineTo(centerX, y + h);
  ctx.stroke();
  ctx.restore();

  // C. Horizontal center guide (Y-axis alignment)
  // When image center Y ≈ frame center Y -> Red guide!
  ctx.save();
  if (alignment.isYAligned) {
    ctx.strokeStyle = '#E53935';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(229, 57, 53, 0.5)';
    ctx.shadowBlur = 6;
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 0;
  }
  ctx.beginPath();
  ctx.moveTo(x, centerY);
  ctx.lineTo(x + w, centerY);
  ctx.stroke();
  ctx.restore();

  // D. Center intersection crosshair / indicator
  if (state.editor.crosshair) {
    ctx.save();
    if (alignment.isFullyAligned) {
      ctx.strokeStyle = '#E53935';
      ctx.fillStyle = '#E53935';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * Render empty aperture state when no image is loaded
 */
function renderEmptyAperture(ctx, x, y, w, h, scale) {
  if (w <= 0 || h <= 0 || !Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(scale) || scale <= 0) return;

  // Soft gallery background
  ctx.fillStyle = '#F5F5F7';
  ctx.fillRect(x, y, w, h);

  // Subtle dashed perimeter
  ctx.strokeStyle = '#D1D1D6';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([Math.max(1, 8 * scale), Math.max(1, 6 * scale)]);
  ctx.strokeRect(x + 2, y + 2, Math.max(1, w - 4), Math.max(1, h - 4));
  ctx.setLineDash([]);

  const centerX = x + w / 2;
  const centerY = y + h / 2;

  // Minimal camera icon
  ctx.save();
  ctx.strokeStyle = '#8E8E93';
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const iconSize = Math.max(4, 40 * scale);
  const iconY = centerY - 32 * scale;
  const radius = Math.max(1, 6 * scale);

  // Camera body
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(centerX - iconSize, iconY - iconSize * 0.7, iconSize * 2, iconSize * 1.4, radius);
  } else {
    ctx.rect(centerX - iconSize, iconY - iconSize * 0.7, iconSize * 2, iconSize * 1.4);
  }
  ctx.stroke();

  // Camera lens
  ctx.beginPath();
  ctx.arc(centerX, iconY, Math.max(1, iconSize * 0.45), 0, Math.PI * 2);
  ctx.stroke();

  // Lens center dot
  ctx.beginPath();
  ctx.arc(centerX, iconY, Math.max(1, 2 * scale), 0, Math.PI * 2);
  ctx.fillStyle = '#8E8E93';
  ctx.fill();

  // Top flash bump
  ctx.beginPath();
  ctx.moveTo(centerX - iconSize * 0.4, iconY - iconSize * 0.7);
  ctx.lineTo(centerX - iconSize * 0.25, iconY - iconSize * 0.95);
  ctx.lineTo(centerX + iconSize * 0.25, iconY - iconSize * 0.95);
  ctx.lineTo(centerX + iconSize * 0.4, iconY - iconSize * 0.7);
  ctx.stroke();

  // Typography
  ctx.font = `500 ${Math.max(8, Math.round(20 * scale))}px 'Inter', sans-serif`;
  ctx.fillStyle = '#1C1C1E';
  ctx.textAlign = 'center';
  ctx.fillText('Upload a photograph to begin', centerX, centerY + 30 * scale);

  ctx.font = `400 ${Math.max(6, Math.round(14 * scale))}px 'Inter', sans-serif`;
  ctx.fillStyle = '#8E8E93';
  ctx.fillText('Click or drag & drop (JPG, PNG, WebP)', centerX, centerY + 54 * scale);

  ctx.restore();
}
