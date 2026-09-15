/**
 * Pocket Frames - Server-Side Rate Limiter & Payload Guard
 * Protects Gemini quota from accidental or abusive volume.
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute per IP
const MAX_PAYLOAD_BYTES = 6 * 1024 * 1024; // 6MB max payload size
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const ipRequestMap = new Map();

// Periodic cleanup of expired rate limit windows (unref'd to prevent keeping process alive)
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipRequestMap.entries()) {
    if (now - data.windowStart > WINDOW_MS * 2) {
      ipRequestMap.delete(ip);
    }
  }
}, WINDOW_MS);

if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

/**
 * Check if incoming request exceeds rate limits
 */
export function checkRateLimit(ip = '127.0.0.1') {
  const now = Date.now();
  let record = ipRequestMap.get(ip);

  if (!record || now - record.windowStart > WINDOW_MS) {
    record = { windowStart: now, count: 1 };
    ipRequestMap.set(ip, record);
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((record.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  record.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - record.count };
}

/**
 * Validate image MIME type and size
 */
export function validateImageTransport(imageObj) {
  if (!imageObj || typeof imageObj !== 'object') {
    return { valid: false, error: 'Missing image transport object' };
  }

  const mimeType = imageObj.mimeType || imageObj.mime_type;
  const data = imageObj.data;
  const width = imageObj.width;
  const height = imageObj.height;

  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return { 
      valid: false, 
      error: `Invalid or unsupported image MIME type: "${mimeType}". Allowed: JPEG, PNG, WebP.` 
    };
  }

  if (!data || typeof data !== 'string' || data.length < 100) {
    return { valid: false, error: 'Missing or malformed base64 image data' };
  }

  // Calculate approximate decoded byte size: (base64 length * 3/4)
  const estimatedBytes = (data.length * 3) / 4;
  if (estimatedBytes > MAX_PAYLOAD_BYTES) {
    return { 
      valid: false, 
      error: `Image payload exceeds maximum allowed size of 6MB (estimated: ${(estimatedBytes / (1024 * 1024)).toFixed(1)}MB)` 
    };
  }

  return { valid: true };
}
