/**
 * Pocket Frames - Image Loader & Safety Guards
 */
import { extractExif } from './exif.js';
import { normalizeImageOrientation } from './orientation.js';

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB safe limit
export const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Validates and loads an uploaded file into a high-res oriented image element
 * @param {File|Blob} file 
 * @returns {Promise<Object>}
 */
export async function loadUserImage(file) {
  // Check file presence
  if (!file) {
    throw new Error('No file provided.');
  }

  // Check size safeguard
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Image is too large to process safely (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please use an image under 100MB.`);
  }

  // Check MIME type if available
  if (file.type && !SUPPORTED_MIME_TYPES.includes(file.type.toLowerCase())) {
    // Check extension fallback
    const name = file.name || '';
    const ext = name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      throw new Error(`Unsupported image format. Please upload a JPG, JPEG, PNG, or WebP image.`);
    }
  }

  // 1. Extract EXIF & orientation
  const { orientation, extracted: extractedExif, raw: rawExif } = await extractExif(file);

  // 2. Decode image natively at full resolution
  const objectUrl = URL.createObjectURL(file);
  const rawImg = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Browser was unable to decode this image file. It may be corrupt or an unsupported format.'));
    };
    img.src = objectUrl;
  });

  // Clean up object URL after decode
  URL.revokeObjectURL(objectUrl);

  // 3. Normalize orientation if needed
  const normalized = await normalizeImageOrientation(rawImg, orientation);

  return {
    element: normalized.element,
    width: normalized.width,
    height: normalized.height,
    orientation,
    extractedExif,
    rawExif,
    file,
    filename: file.name || 'photograph.jpg'
  };
}
