/**
 * Pocket Frames - Server-Side Rate Limiter & Payload Guard
 * Protects Gemini quota from accidental or abusive volume.
 *
 * RATE LIMITING STRATEGY
 * ──────────────────────
 * On Vercel serverless, each cold-start creates a fresh process, so a pure
 * in-memory Map would be reset on every invocation — providing zero real
 * protection in production.
 *
 * Strategy:
 *   1. If VERCEL_KV_REST_API_URL + VERCEL_KV_REST_API_TOKEN are set →
 *      use Vercel KV (Redis INCR/EXPIRE) for persistent cross-invocation limits.
 *   2. Otherwise (local dev, preview deploys without KV) →
 *      fall back to in-memory Map with a visible warning on first call.
 *
 * To configure Vercel KV:
 *   vercel storage connect → select or create a KV store → link to project.
 *   Vercel auto-injects VERCEL_KV_REST_API_URL and VERCEL_KV_REST_API_TOKEN.
 */

const WINDOW_MS = 60 * 1000;           // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;    // 20 requests per minute per IP (tighter than before)
const MAX_PAYLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// ── Vercel KV client (lazy-loaded only when env vars are present) ─────────────
let _kvClient = null;
let _kvWarned = false;

async function getKvClient() {
  if (_kvClient) return _kvClient;
  const kvUrl = process.env.VERCEL_KV_REST_API_URL;
  const kvToken = process.env.VERCEL_KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return null;
  try {
    const { createClient } = await import('@vercel/kv');
    _kvClient = createClient({ url: kvUrl, token: kvToken });
    return _kvClient;
  } catch {
    return null;
  }
}

// ── Fallback: in-memory Map (local dev only) ──────────────────────────────────
const ipRequestMap = new Map();

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
 * Check if incoming request exceeds rate limits.
 * Uses Vercel KV in production, in-memory Map in local dev.
 */
export async function checkRateLimit(ip = '127.0.0.1') {
  const kv = await getKvClient();

  if (kv) {
    // ── Vercel KV path (production) ───────────────────────────────────────────
    try {
      const key = `rl:${ip}`;
      const count = await kv.incr(key);
      if (count === 1) {
        // First request in this window — set expiry
        await kv.expire(key, Math.ceil(WINDOW_MS / 1000));
      }
      if (count > MAX_REQUESTS_PER_WINDOW) {
        const ttl = await kv.ttl(key);
        return { allowed: false, remaining: 0, retryAfter: ttl > 0 ? ttl : 60 };
      }
      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - count };
    } catch (kvErr) {
      // KV temporarily unavailable — fail open (allow request) but log it
      console.warn('[RateLimit] Vercel KV error, failing open:', kvErr.message);
      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW };
    }
  }

  // ── In-memory fallback (local dev / no KV configured) ────────────────────
  if (!_kvWarned) {
    console.warn('[RateLimit] No Vercel KV configured — using in-memory rate limiter. This resets on every cold start. Configure Vercel KV for production-grade limiting.');
    _kvWarned = true;
  }
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
