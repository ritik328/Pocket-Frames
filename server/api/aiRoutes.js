/**
 * Pocket Frames - Server-Side AI Route Handler
 * Dispatches AI operations, enforces rate limiting and payload validation,
 * and returns clean, structured responses.
 */

import { checkRateLimit, validateImageTransport } from '../utils/rateLimit.js';
import { getServiceStatus, createPost, analyzePhoto, getCompositionRecommendation, getCritique } from '../services/geminiService.js';

export async function handleAiRequest(req, res, next) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname;

  // Support Vercel dynamic route params (e.g., api/ai/[action].js or query params)
  if (!pathname.startsWith('/api/ai/') && req.query) {
    const action = req.query.action || (Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path);
    if (action) {
      pathname = `/api/ai/${action}`;
    }
  }

  // Status check endpoint
  if ((pathname === '/api/ai/status' || pathname.endsWith('/status')) && req.method === 'GET') {
    const status = getServiceStatus();
    return sendJson(res, 200, { success: true, ...status });
  }

  // Only handle /api/ai/* routes
  if (!pathname.startsWith('/api/ai/')) {
    if (typeof next === 'function') return next();
    return sendJson(res, 404, { success: false, error: 'Not Found' });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  // Rate Limiting Check
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || '127.0.0.1';
  const rateLimitResult = checkRateLimit(clientIp);

  if (!rateLimitResult.allowed) {
    return sendJson(res, 429, {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Please try again in ${rateLimitResult.retryAfter} seconds.`
      }
    });
  }

  // Read request body (handles both Node stream and Vercel pre-parsed body)
  let body;
  try {
    if (req.body && typeof req.body === 'object') {
      body = req.body;
    } else if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      body = await parseJsonBody(req);
    }
  } catch (err) {
    return sendJson(res, 400, {
      success: false,
      error: { code: 'INVALID_JSON_BODY', message: 'Malformed JSON in request body' }
    });
  }

  // Payload Validation
  const imageValidation = validateImageTransport(body.image);
  if (!imageValidation.valid) {
    return sendJson(res, 400, {
      success: false,
      error: { code: 'INVALID_IMAGE_TRANSPORT', message: imageValidation.error }
    });
  }

  try {
    let result;

    switch (pathname) {
      case '/api/ai/create-post':
        result = await createPost(body);
        break;

      case '/api/ai/analyze-photo':
        result = await analyzePhoto(body);
        break;

      case '/api/ai/composition':
        result = await getCompositionRecommendation(body);
        break;

      case '/api/ai/critique':
        result = await getCritique(body);
        break;

      default:
        return sendJson(res, 404, {
          success: false,
          error: { code: 'UNKNOWN_AI_ENDPOINT', message: `No endpoint matching ${pathname}` }
        });
    }

    if (!result.success) {
      return sendJson(res, 502, result);
    }

    return sendJson(res, 200, result);

  } catch (err) {
    console.error(`[AIRoutes] Unhandled server error in ${pathname}:`, err);
    return sendJson(res, 500, {
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred processing the request.' }
    });
  }
}

/**
 * Helper to stream and parse JSON request body
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      // Guard against excessive size (> 10MB)
      if (raw.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Helper to write JSON HTTP response
 */
function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.end(JSON.stringify(data));
}
