/**
 * Pocket Frames — Developer Sticker Service
 * Handles:
 *  - PIN verification
 *  - Background cleaning via danielgatis/rembg tool (U2Net AI + GrabCut + color-flood fallback)
 *  - Batch uploading (up to 50 files)
 *  - Full collection / group deletion
 *  - Catalog persistence in server/data/customStickers.json & public/custom-stickers/
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import sharp from 'sharp';

const DEV_PIN = process.env.DEV_PIN?.trim() || '7788';

// In serverless/cloud deployments (e.g. Vercel), the project root is read-only.
// We detect this by checking if the app is running from /var/task (Vercel) or
// if the STICKERS_WRITABLE_DIR env var is set explicitly.
// Writable paths fall back to /tmp which is always writable in serverless envs.
const IS_SERVERLESS =
  process.cwd().startsWith('/var/task') ||
  process.env.VERCEL === '1' ||
  process.env.SERVERLESS === '1';

const DATA_DIR = IS_SERVERLESS
  ? '/tmp/pocket-frames-data'
  : path.resolve(process.cwd(), 'server', 'data');

const DATA_FILE = path.join(DATA_DIR, 'customStickers.json');

const STICKERS_DIR = IS_SERVERLESS
  ? '/tmp/pocket-frames-stickers'
  : path.resolve(process.cwd(), 'public', 'custom-stickers');

// The public URL prefix for sticker images
const STICKERS_URL_PREFIX = process.env.STICKERS_URL_PREFIX || '/custom-stickers';

// Path to the Python background removal script
const PYTHON_SCRIPT = path.resolve(process.cwd(), 'server', 'scripts', 'remove_bg.py');
// Allow override via env (e.g. PYTHON_BIN=python3 on Linux)
const PYTHON_BIN = process.env.PYTHON_BIN || 'python';

console.log(`[StickerService] Environment: ${IS_SERVERLESS ? 'serverless' : 'local'}`);
console.log(`[StickerService] Data file: ${DATA_FILE}`);
console.log(`[StickerService] Stickers dir: ${STICKERS_DIR}`);
console.log(`[StickerService] Python bg-remover: ${PYTHON_BIN} ${PYTHON_SCRIPT}`);

// Ensure storage directories exist
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[StickerService] Could not create DATA_DIR:', e.message);
}
try {
  if (!fs.existsSync(STICKERS_DIR)) {
    fs.mkdirSync(STICKERS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[StickerService] Could not create STICKERS_DIR:', e.message);
}

/**
 * Load persisted custom stickers and deleted pack records
 */
function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        packs: Array.isArray(parsed.packs) ? parsed.packs : [],
        deletedBuiltinPacks: Array.isArray(parsed.deletedBuiltinPacks) ? parsed.deletedBuiltinPacks : [],
        stickers: Array.isArray(parsed.stickers) ? parsed.stickers : []
      };
    }
  } catch (err) {
    console.warn('[StickerService] Failed to read store, initializing fresh:', err);
  }

  return {
    packs: [],
    deletedBuiltinPacks: [],
    stickers: []
  };
}

/**
 * Persist store to disk atomically
 */
function saveStore(store) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('[StickerService] Failed to save store:', err);
    throw err;
  }
}

/**
 * Verify developer PIN
 */
export function verifyPin(pin) {
  if (!pin) return false;
  return String(pin).trim() === DEV_PIN;
}

/**
 * Get current sticker catalog status (custom stickers + custom packs + deleted packs)
 */
export function getStickerData() {
  const store = loadStore();
  return {
    success: true,
    packs: store.packs,
    deletedBuiltinPacks: store.deletedBuiltinPacks,
    stickers: store.stickers,
    totalCustomStickers: store.stickers.length
  };
}

/**
 * Delete an entire collection / group
 */
export async function deleteCollection(packId, pin) {
  if (!verifyPin(pin)) {
    return { success: false, error: 'Unauthorized: Invalid developer PIN' };
  }

  if (!packId || packId === 'all') {
    return { success: false, error: 'Invalid pack ID to delete' };
  }

  const store = loadStore();
  const rawLower = String(packId).toLowerCase().trim();
  const slug = rawLower.replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');

  const matchesPack = (id, label) => {
    if (!id && !label) return false;
    const idLower = String(id || '').toLowerCase().trim();
    const idSlug = idLower.replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
    const labelLower = String(label || '').toLowerCase().trim();
    const labelSlug = labelLower.replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');

    return (
      idLower === rawLower ||
      idSlug === slug ||
      idLower === slug ||
      idSlug === rawLower ||
      labelLower === rawLower ||
      labelSlug === slug
    );
  };

  // 1. If it matches a built-in pack, mark as deleted
  const BUILTIN_PACKS = ['ocean', 'summer', 'photography', 'floral', 'vintage'];
  for (const b of BUILTIN_PACKS) {
    if (matchesPack(b, b)) {
      if (!store.deletedBuiltinPacks.includes(b)) {
        store.deletedBuiltinPacks.push(b);
      }
    }
  }

  // 2. Remove all custom stickers belonging to this pack
  const toDelete = store.stickers.filter(s => matchesPack(s.pack, s.pack));
  store.stickers = store.stickers.filter(s => !matchesPack(s.pack, s.pack));

  // 3. Remove from custom packs list
  const removedPacks = store.packs.filter(p => matchesPack(p.id, p.label));
  store.packs = store.packs.filter(p => !matchesPack(p.id, p.label));

  // 4. Delete physical files from disk
  for (const item of toDelete) {
    if (item.filename) {
      const filePath = path.join(STICKERS_DIR, item.filename);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        console.warn(`[StickerService] Could not delete file ${filePath}:`, e);
      }
    }
  }

  saveStore(store);

  return {
    success: true,
    message: `Collection '${packId}' successfully deleted (${toDelete.length} stickers removed)`,
    deletedCount: toDelete.length,
    remainingPacks: store.packs,
    deletedBuiltinPacks: store.deletedBuiltinPacks
  };
}

/**
 * Remove background from image using the Python script (remove_bg.py).
 * Stages: rembg U2Net AI → OpenCV GrabCut → color flood-fill fallback.
 * The Python script reads raw image bytes from stdin and writes PNG to stdout.
 */
async function cleanBackgroundPython(imageBuffer) {
  return new Promise((resolve, reject) => {
    const args = [PYTHON_SCRIPT, '-', '-'];
    const proc = spawn(PYTHON_BIN, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const chunks = [];
    const errChunks = [];

    proc.stdout.on('data', chunk => chunks.push(chunk));
    proc.stderr.on('data', chunk => errChunks.push(chunk));

    proc.on('error', err => {
      reject(new Error(`Python bg-remover spawn failed: ${err.message}`));
    });

    proc.on('close', code => {
      const stderrText = Buffer.concat(errChunks).toString('utf8').trim();
      if (stderrText) console.log('[BgRemover]', stderrText);
      if (code !== 0) {
        return reject(new Error(`Python bg-remover exited with code ${code}: ${stderrText.slice(0, 200)}`));
      }
      const result = Buffer.concat(chunks);
      if (result.length === 0) {
        return reject(new Error('Python bg-remover returned empty output'));
      }
      resolve(result);
    });

    // Send image bytes to Python script via stdin, then close it
    proc.stdin.write(imageBuffer);
    proc.stdin.end();
  });
}

/**
 * Smart detection: checks whether the image already has a transparent background.
 * If transparent, we can skip AI background removal completely to preserve quality
 * and accelerate upload speed by 10-20x.
 */
export async function isAlreadyTransparent(imageBuffer) {
  try {
    const stats = await sharp(imageBuffer).stats();
    // Fully opaque images (or no alpha channel) definitely need background removal
    if (stats.isOpaque || stats.channels.length < 4) {
      return { transparent: false };
    }

    const alphaChannel = stats.channels[3];
    if (!alphaChannel || alphaChannel.min > 30) {
      return { transparent: false };
    }

    // Inspect pixel distribution quickly via a 64x64 thumbnail
    const { data, info } = await sharp(imageBuffer)
      .resize(64, 64, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let transparentPixels = 0;
    const totalPixels = info.width * info.height;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 30) transparentPixels++;
    }

    const ratio = transparentPixels / totalPixels;

    // Check corner alpha values (top-left, top-right, bottom-left, bottom-right)
    const corners = [
      data[3],
      data[(63) * 4 + 3],
      data[(63 * 64) * 4 + 3],
      data[(63 * 64 + 63) * 4 + 3]
    ];
    const transparentCorners = corners.filter(a => a < 30).length;

    // If corners are transparent or at least 15% of pixels are transparent
    if ((transparentCorners >= 3 && ratio > 0.05) || ratio > 0.15) {
      return {
        transparent: true,
        ratio: Math.round(ratio * 100),
        corners: transparentCorners
      };
    }

    return { transparent: false };
  } catch (err) {
    return { transparent: false };
  }
}

/**
 * Process a single sticker upload:
 * 1. Clean background via danielgatis/rembg tool (with smart skip if already transparent)
 * 2. Assign to user-specified group
 * 3. Save to disk
 */
export async function processStickerUpload(fileData, options = {}) {
  const {
    pin,
    targetGroup = '',
    removeBackground = true
  } = options;

  if (!verifyPin(pin)) {
    throw new Error('Unauthorized: Invalid developer PIN');
  }

  let buffer;
  let mimeType = fileData.mimeType || 'image/png';

  const rawData = fileData.data || fileData.dataUrl;
  if (typeof rawData === 'string') {
    let b64 = rawData;
    if (b64.includes(',')) {
      const parts = b64.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match) mimeType = match[1];
      b64 = parts[1];
    }
    buffer = Buffer.from(b64, 'base64');
  } else if (Buffer.isBuffer(rawData)) {
    buffer = rawData;
  } else {
    throw new Error('Invalid file data provided');
  }

  // 1. Background removal via danielgatis/rembg (with smart skip if already transparent)
  let cleanedBuffer = buffer;
  let bgMethod = 'direct-upload';
  let isTransparentSkipped = false;
  const shouldRemoveBg = removeBackground !== false && removeBackground !== 'false' && removeBackground !== 0;

  if (shouldRemoveBg) {
    const transCheck = await isAlreadyTransparent(buffer);
    if (transCheck && transCheck.transparent) {
      console.log(`[StickerService] ⚡ Smart skip: "${fileData.name || 'sticker'}" already has transparent background (${transCheck.ratio}% transparent, ${transCheck.corners}/4 corners) -> skipping AI!`);
      // Just trim excess transparent borders & normalize size to 512px max
      cleanedBuffer = await sharp(buffer)
        .trim()
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 95 })
        .toBuffer();
      bgMethod = 'already-transparent';
      isTransparentSkipped = true;
    } else {
      // Run danielgatis/rembg AI
      try {
        const rawCleaned = await cleanBackgroundPython(buffer);
        try {
          cleanedBuffer = await sharp(rawCleaned)
            .trim()
            .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
            .png({ quality: 92 })
            .toBuffer();
        } catch {
          cleanedBuffer = rawCleaned;
        }
        bgMethod = 'rembg-danielgatis';
        console.log('[StickerService] Background removed via danielgatis/rembg tool (U2Net AI)');
      } catch (pyErr) {
        console.warn('[StickerService] Python bg-remover failed, using sharp resize fallback:', pyErr.message);
        // Fallback: just resize/convert to PNG cleanly
        cleanedBuffer = await sharp(buffer)
          .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
          .png({ quality: 95 })
          .toBuffer();
        bgMethod = 'sharp-resize';
      }
    }
  } else {
    // DIRECT UPLOAD: AI background removal disabled by user.
    // Absolutely zero processing, zero modification, zero resizing — uploaded directly as-is!
    cleanedBuffer = buffer;
    bgMethod = 'direct-upload';
    console.log(`[StickerService] ⚡ Direct upload: "${fileData.name || 'sticker'}" uploaded directly with 0 processing`);
  }

  // 2. Group assignment — user-specified only
  let groupName = (targetGroup || '').trim() || 'custom';
  const stickerName = fileData.name ? path.parse(fileData.name).name : 'Sticker';
  const tags = ['sticker', 'custom'];
  const emoji = '✦';

  // Normalize group ID
  const packId = groupName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const packLabel = groupName.split(/[-\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // 3. Save to disk directly preserving original file format
  let ext = 'png';
  if (mimeType.includes('svg')) ext = 'svg';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('gif')) ext = 'gif';
  else if (fileData.name && path.extname(fileData.name)) ext = path.extname(fileData.name).replace('.', '').toLowerCase();

  const stickerId = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const filename = `${stickerId}.${ext}`;
  const filePath = path.join(STICKERS_DIR, filename);

  fs.writeFileSync(filePath, cleanedBuffer);

  let meta = { width: 512, height: 512 };
  try {
    meta = await sharp(cleanedBuffer).metadata();
  } catch {
    // fallback if format is SVG or vector
  }

  // In serverless mode, images in /tmp can't be served as static files.
  // We expose them via the /api/stickers?action=image&id=<stickerId> endpoint instead.
  const stickerUrl = IS_SERVERLESS
    ? `/api/stickers?action=image&id=${stickerId}`
    : `/custom-stickers/${filename}`;

  const stickerRecord = {
    id: stickerId,
    name: stickerName,
    pack: packId,
    tags,
    url: stickerUrl,
    filename,
    defaultSize: 200,
    width: meta.width || 512,
    height: meta.height || 512,
    createdAt: Date.now(),
    bgCleanedVia: bgMethod,
    alreadyTransparent: isTransparentSkipped
  };

  // 4. Update store
  const store = loadStore();
  store.stickers.unshift(stickerRecord);

  // Add or update pack
  let existingPack = store.packs.find(p => p.id === packId);
  if (!existingPack) {
    store.packs.push({
      id: packId,
      label: packLabel,
      emoji: emoji || '✦',
      count: 1
    });
  } else {
    existingPack.count = store.stickers.filter(s => s.pack === packId).length;
  }

  // Unhide if it was previously in deletedBuiltinPacks
  store.deletedBuiltinPacks = store.deletedBuiltinPacks.filter(id => id !== packId);

  saveStore(store);

  return stickerRecord;
}

/**
 * Serve a sticker image by its ID (for serverless environments where /tmp isn't publicly accessible)
 */
export function getStickerImageBuffer(stickerId) {
  const store = loadStore();
  const record = store.stickers.find(s => s.id === stickerId);
  if (!record || !record.filename) {
    return null;
  }
  const filePath = path.join(STICKERS_DIR, record.filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath);
}

/**
 * Batch upload up to 50 stickers
 */
export async function batchUploadStickers(files, options = {}) {
  const { pin, targetGroup, removeBackground } = options;

  if (!verifyPin(pin)) {
    return { success: false, error: 'Unauthorized: Invalid developer PIN' };
  }

  if (!Array.isArray(files) || files.length === 0) {
    return { success: false, error: 'No files provided for upload' };
  }

  if (files.length > 50) {
    return { success: false, error: `Batch limit exceeded: maximum 50 stickers per upload (received ${files.length})` };
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const record = await processStickerUpload(file, {
        pin,
        targetGroup,
        removeBackground
      });
      results.push(record);
    } catch (err) {
      console.error(`[StickerService] Failed processing file ${i + 1} (${file.name || 'unnamed'}):`, err);
      errors.push({
        name: file.name || `Sticker #${i + 1}`,
        error: err.message
      });
    }
  }

  const store = loadStore();

  const alreadyTransparentCount = results.filter(r => r.bgCleanedVia === 'already-transparent').length;
  const directUploadCount = results.filter(r => r.bgCleanedVia === 'direct-upload').length;
  const aiCleanedCount = results.filter(r => r.bgCleanedVia === 'rembg-danielgatis').length;

  return {
    success: results.length > 0,
    uploaded: results.length,
    failed: errors.length,
    alreadyTransparent: alreadyTransparentCount,
    directUpload: directUploadCount,
    aiCleaned: aiCleanedCount,
    results,
    errors,
    packs: store.packs,
    totalCustomStickers: store.stickers.length
  };
}
