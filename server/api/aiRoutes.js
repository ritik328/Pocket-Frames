/**
 * Pocket Frames - Server-Side AI Route Handler
 * Dispatches AI operations, enforces rate limiting and payload validation,
 * and returns clean, structured responses.
 */

import { checkRateLimit, validateImageTransport } from '../utils/rateLimit.js';
import { getServiceStatus, createPost, analyzePhoto, getCompositionRecommendation, getCritique } from '../services/geminiService.js';

export async function handleAiRequest(req, res, next) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Handle CORS Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] || '';
  const action = req.query?.action || lastSegment || 'status';

  // Status check endpoint (GET or action=status)
  if (action === 'status' || pathname.endsWith('/status')) {
    const status = getServiceStatus();
    return sendJson(res, 200, { success: true, ...status });
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

    switch (action) {
      case 'create-post':
        result = await createPost(body);
        break;

      case 'analyze-photo':
        result = await analyzePhoto(body);
        break;

      case 'composition':
        result = await getCompositionRecommendation(body);
        break;

      case 'critique':
        result = await getCritique(body);
        break;

      default:
        // Try pathname matching as fallback
        if (pathname.includes('create-post')) {
          result = await createPost(body);
        } else if (pathname.includes('analyze-photo')) {
          result = await analyzePhoto(body);
        } else if (pathname.includes('composition')) {
          result = await getCompositionRecommendation(body);
        } else if (pathname.includes('critique')) {
          result = await getCritique(body);
        } else {
          return sendJson(res, 404, {
            success: false,
            error: { code: 'UNKNOWN_AI_ENDPOINT', message: `No endpoint matching action: ${action}` }
          });
        }
    }

    if (!result.success) {
      return sendJson(res, 502, result);
    }

    return sendJson(res, 200, result);

  } catch (err) {
    console.error(`[AIRoutes] Unhandled server error in ${action}:`, err);
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
