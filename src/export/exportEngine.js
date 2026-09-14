/**
 * Pocket Frames - Master High-Resolution Export Engine
 */
import { renderFrame } from '../frame/frameRenderer.js';
import { ensureFontsReady } from '../frame/typography.js';
import { checkAlignment } from '../editor/alignment.js';

export const EXPORT_PRESETS = {
  '1080x1350': {
    name: 'Instagram Portrait (1×)',
    width: 1080,
    height: 1350,
    aspect: '4:5'
  },
  '2160x2700': {
    name: 'High Quality Master (2×)',
    width: 2160,
    height: 2700,
    aspect: '4:5'
  },
  '3240x4050': {
    name: 'Ultra Resolution (3×)',
    width: 3240,
    height: 4050,
    aspect: '4:5'
  }
};

/**
 * Sanitize string for clean OS filenames
 */
export function sanitizeFilenamePart(str) {
  if (!str) return 'Photograph';
  return str
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

/**
 * Generate standard dynamic filename
 * PocketFrames_[DEVICE]_[RESOLUTION].[EXT]
 */
export function generateExportFilename(state) {
  const devicePart = sanitizeFilenamePart(state.metadata.device || 'Frame');
  const resolutionKey = state.export.resolution || '2160x2700';
  const ext = state.export.format === 'image/png' ? 'png' : 'jpg';

  return `PocketFrames_${devicePart}_${resolutionKey}.${ext}`;
}

/**
 * Perform pre-flight sanity checks before download
 */
export function getPreflightSummary(state) {
  const preset = EXPORT_PRESETS[state.export.resolution] || EXPORT_PRESETS['2160x2700'];
  const alignment = checkAlignment(state.transform);
  const hasImage = Boolean(state.image && state.image.element);

  return {
    resolutionLabel: `${preset.width} × ${preset.height}`,
    formatLabel: state.export.format === 'image/png' ? 'PNG (Lossless)' : `JPEG (${Math.round(state.export.quality * 100)}%)`,
    aspectLabel: '4:5 Portrait',
    hasImage,
    isXAligned: alignment.isXAligned,
    isYAligned: alignment.isYAligned,
    isFullyAligned: alignment.isFullyAligned,
    filename: generateExportFilename(state)
  };
}

/**
 * Render and download master frame
 * @param {object} state 
 * @param {function} onProgress - Optional callback
 */
export async function downloadFrame(state, onProgress = null) {
  if (onProgress) onProgress('Preparing high-resolution typography...');
  await ensureFontsReady();

  const preset = EXPORT_PRESETS[state.export.resolution] || EXPORT_PRESETS['2160x2700'];
  const exportCanvas = document.createElement('canvas');

  if (onProgress) onProgress(`Rendering ${preset.width} × ${preset.height} master canvas...`);

  renderFrame(exportCanvas, state, {
    isExport: true,
    targetWidth: preset.width,
    targetHeight: preset.height
  });

  const mimeType = state.export.format || 'image/jpeg';
  const quality = mimeType === 'image/jpeg' ? (state.export.quality || 0.99) : undefined;
  const filename = generateExportFilename(state);

  if (onProgress) onProgress('Encoding high-fidelity output...');

  return new Promise((resolve, reject) => {
    exportCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas encoding failed. The image may exceed browser memory limits.'));
          return;
        }

        // Trigger native browser download
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          // Free canvas memory
          exportCanvas.width = 1;
          exportCanvas.height = 1;
        }, 1000);

        if (onProgress) onProgress('Complete');
        resolve({ blob, filename });
      },
      mimeType,
      quality
    );
  });
}
