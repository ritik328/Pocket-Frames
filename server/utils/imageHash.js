import crypto from 'node:crypto';

/**
 * Compute SHA-256 hash for cache key identification.
 * Combines image base64 data, EXIF metadata, operation, model, and prompt version.
 */
export function computeImageHash(imageData, extraContext = {}) {
  const hash = crypto.createHash('sha256');
  if (typeof imageData === 'string') {
    // If base64, hash the first 16KB + length + sample to stay fast on large images
    hash.update(imageData.substring(0, 16384));
    hash.update(imageData.length.toString());
  } else if (Buffer.isBuffer(imageData)) {
    hash.update(imageData);
  }
  hash.update(JSON.stringify(extraContext));
  return hash.digest('hex').substring(0, 16);
}
