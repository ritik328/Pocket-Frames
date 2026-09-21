/**
 * Pocket Frames - Sticker Developer Backdoor API Routes
 * Dispatches sticker catalog retrieval, developer PIN verification,
 * batch upload (up to 50 files) with Gemini background cleaning,
 * and collection deletion.
 */

import {
  getStickerData,
  verifyPin,
  batchUploadStickers,
  deleteCollection,
  renameCollection,
  getStickerImageBuffer
} from '../services/stickerService.js';

export async function handleStickerRequest(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const action = url.searchParams.get('action') || segments[segments.length - 1] || 'list';

    // GET: List all custom stickers and packs
    if (req.method === 'GET' && (action === 'stickers' || action === 'list' || pathname.endsWith('/api/stickers') || pathname.endsWith('/api/stickers/'))) {
      const data = getStickerData();
      return sendJson(res, 200, data);
    }

    // Parse Body for POST / DELETE
    let body = {};
    try {
      if (req.body && typeof req.body === 'object') {
        body = req.body;
      } else if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = await parseJsonBody(req);
      }
    } catch (err) {
      return sendJson(res, 400, { success: false, error: 'Malformed JSON in request body' });
    }

    // Action: Verify PIN
    if (action === 'verify-pin' || pathname.endsWith('/verify-pin')) {
      const isValid = verifyPin(body.pin);
      if (isValid) {
        return sendJson(res, 200, { success: true, message: 'Developer access granted' });
      } else {
        return sendJson(res, 401, { success: false, error: 'Invalid developer PIN' });
      }
    }

    // Action: Delete Entire Collection
    if (action === 'delete-group' || action === 'delete-collection' || (req.method === 'DELETE' && action === 'group') || pathname.endsWith('/delete-group')) {
      const packId = body.packId || body.pack || url.searchParams.get('packId');
      const pin = body.pin || req.headers['authorization']?.replace('Bearer ', '');
      const result = await deleteCollection(packId, pin);
      const status = result.success ? 200 : (result.error?.includes('Unauthorized') ? 401 : 400);
      return sendJson(res, status, result);
    }

    // Action: Rename Collection
    if (action === 'rename-group' || action === 'rename-collection' || pathname.endsWith('/rename-group') || pathname.endsWith('/rename-collection')) {
      const packId = body.packId || body.pack || url.searchParams.get('packId');
      const newLabel = body.newLabel || body.label || body.name || url.searchParams.get('newLabel');
      const pin = body.pin || req.headers['authorization']?.replace('Bearer ', '');
      const result = await renameCollection(packId, newLabel, pin);
      const status = result.success ? 200 : (result.error?.includes('Unauthorized') ? 401 : 400);
      return sendJson(res, status, result);
    }

    // Action: Batch Upload
    if (action === 'upload' || action === 'upload-batch' || pathname.endsWith('/upload') || pathname.endsWith('/upload-batch')) {
      const pin = body.pin || req.headers['authorization']?.replace('Bearer ', '');
      const files = body.files || [];
      const targetGroup = body.targetGroup || body.group || '';
      const autoCategorize = body.autoCategorize !== false;
      const removeBackground = body.removeBackground !== false;

      const result = await batchUploadStickers(files, {
        pin,
        targetGroup,
        autoCategorize,
        removeBackground
      });

      const status = result.success ? 200 : (result.error?.includes('Unauthorized') ? 401 : 400);
      return sendJson(res, status, result);
    }

    // Action: Serve Sticker Image (serverless mode: images stored in /tmp)
    if (req.method === 'GET' && action === 'image') {
      const stickerId = url.searchParams.get('id');
      if (!stickerId) {
        return sendJson(res, 400, { success: false, error: 'Missing sticker id' });
      }
      const imgBuffer = getStickerImageBuffer(stickerId);
      if (!imgBuffer) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ success: false, error: 'Sticker image not found' }));
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(imgBuffer);
    }

    return sendJson(res, 404, { success: false, error: `Unknown sticker action: ${action}` });
  } catch (outerErr) {
    console.error('[StickerRoutes] Unhandled request error:', outerErr);
    return sendJson(res, 500, { success: false, error: outerErr.message || 'Server error processing sticker request' });
  }
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      // Allow up to 60MB for batch of 50 base64 images
      if (raw.length > 60 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
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
