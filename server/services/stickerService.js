/**
 * Pocket Frames — Developer Sticker Service
 * Handles:
 *  - PIN verification
 *  - Background cleaning via Gemini Flash 2.5 Image API + sharp alpha-matting
 *  - Intelligent AI categorization into groups (floral, mirrors, ocean, summer vibes, etc.)
 *  - Batch uploading (up to 50 files)
 *  - Full collection / group deletion
 *  - Catalog persistence in server/data/customStickers.json & public/custom-stickers/
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const DEV_PIN = process.env.DEV_PIN?.trim() || '7788';
const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const DATA_FILE = path.join(DATA_DIR, 'customStickers.json');
const STICKERS_DIR = path.resolve(process.cwd(), 'public', 'custom-stickers');

// Ensure storage directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(STICKERS_DIR)) {
  fs.mkdirSync(STICKERS_DIR, { recursive: true });
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
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
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
  const normalizedId = packId.toLowerCase().trim();

  // 1. If it's a built-in pack, mark as deleted
  const BUILTIN_PACKS = ['ocean', 'summer', 'photography', 'floral', 'vintage'];
  if (BUILTIN_PACKS.includes(normalizedId)) {
    if (!store.deletedBuiltinPacks.includes(normalizedId)) {
      store.deletedBuiltinPacks.push(normalizedId);
    }
  }

  // 2. Remove all custom stickers belonging to this pack
  const toDelete = store.stickers.filter(s => s.pack === normalizedId);
  store.stickers = store.stickers.filter(s => s.pack !== normalizedId);

  // 3. Remove from custom packs list
  store.packs = store.packs.filter(p => p.id !== normalizedId);

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
 * Clean image background using sharp high-fidelity alpha matting
 * Converts solid backgrounds (white, light-gray, black, checkerboards) into clean transparent PNGs
 */
export async function cleanBackgroundLocal(imageBuffer) {
  // Load image with sharp and extract raw RGBA pixels
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  const width = metadata.width || 512;
  const height = metadata.height || 512;

  // Convert to RGBA raw buffer
  const raw = await image
    .ensureAlpha()
    .raw()
    .toBuffer();

  const pixelCount = width * height;
  const data = new Uint8Array(raw);

  // Sample corner pixels to detect background color
  // Corners: top-left, top-right, bottom-left, bottom-right
  const cornerIndices = [
    0, // (0,0)
    (width - 1) * 4, // (w-1, 0)
    (width * (height - 1)) * 4, // (0, h-1)
    (width * height - 1) * 4 // (w-1, h-1)
  ];

  let totalR = 0, totalG = 0, totalB = 0;
  for (const idx of cornerIndices) {
    totalR += data[idx];
    totalG += data[idx + 1];
    totalB += data[idx + 2];
  }
  const bgR = Math.round(totalR / 4);
  const bgG = Math.round(totalG / 4);
  const bgB = Math.round(totalB / 4);

  // Determine if background is solid white/near-white, solid black, or solid color
  const isWhiteBg = bgR >= 235 && bgG >= 235 && bgB >= 235;
  const isBlackBg = bgR <= 20 && bgG <= 20 && bgB <= 20;

  // Color distance threshold with soft feathering
  const threshold = isWhiteBg ? 30 : isBlackBg ? 25 : 35;
  const featherRange = 15;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];

    if (a === 0) continue; // already transparent

    // Euclidean color distance from background
    const dist = Math.sqrt(
      (r - bgR) * (r - bgR) +
      (g - bgG) * (g - bgG) +
      (b - bgB) * (b - bgB)
    );

    if (dist <= threshold) {
      // Complete background transparency
      data[offset + 3] = 0;
    } else if (dist < threshold + featherRange) {
      // Soft edge antialiasing
      const alphaFactor = (dist - threshold) / featherRange;
      data[offset + 3] = Math.round(a * alphaFactor);
    }
  }

  // Re-encode back to PNG with trimmed transparent borders and safe padding
  const cleanedBuffer = await sharp(data, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .trim({ threshold: 10 })
    .resize(512, 512, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .png({ quality: 95, compressionLevel: 8 })
    .toBuffer();

  return cleanedBuffer;
}

/**
 * Call Gemini Flash 2.5 Image API for background cleaning / object isolation
 */
export async function callGeminiFlashImageCleaning(imageBase64, mimeType = 'image/png') {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64
            }
          },
          {
            text: 'Isolate the main foreground subject in this sticker image. Remove all background completely so that the returned image has a pure transparent alpha background. Output only the isolated sticker.'
          }
        ]
      }
    ]
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Flash 2.5 Image API error ${response.status}: ${errorText.substring(0, 150)}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];

  // Look for inline image data in response
  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }

  throw new Error('No image returned by Gemini 2.5 Flash Image');
}

/**
 * Intelligent AI Categorization with Gemini
 * Classifies stickers into groups like 'floral', 'mirrors', 'ocean', 'summer vibes', etc.
 */
export async function categorizeStickerWithAi(imageBase64, mimeType = 'image/png') {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  if (!apiKey) {
    return {
      name: 'Sticker',
      category: 'general',
      emoji: '✦',
      tags: ['sticker', 'custom']
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `Analyze this sticker / isolated visual design.
Return a JSON object with:
- "name": Concise clean title (e.g. "Vintage Mirror", "Cherry Blossom", "Summer Palm")
- "category": Concise group/pack name in lowercase (e.g. "floral" for flowers/botanicals, "mirrors" for mirrors, "ocean" for sea items, "summer vibes" for beach/summer items, "vintage" for retro items, "photography" for camera items, etc.)
- "emoji": A single matching emoji for this category (e.g. 🌸 for floral, 🪞 for mirrors, ☀️ for summer vibes, 🌊 for ocean)
- "tags": Array of 4-6 lowercase keyword tags

Output valid JSON only.`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: { mimeType, data: imageBase64 }
              },
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        return {
          name: parsed.name || 'Custom Sticker',
          category: (parsed.category || 'custom').toLowerCase().trim().replace(/[^a-z0-9\s_-]/g, ''),
          emoji: parsed.emoji || '✦',
          tags: Array.isArray(parsed.tags) ? parsed.tags.map(t => String(t).toLowerCase().trim()) : ['sticker']
        };
      }
    }
  } catch (err) {
    console.warn('[StickerService] AI categorization failed, using fallback:', err);
  }

  return {
    name: 'Custom Sticker',
    category: 'custom',
    emoji: '✦',
    tags: ['sticker', 'custom']
  };
}

/**
 * Process a single sticker upload:
 * 1. Clean background (Gemini Flash 2.5 Image with local alpha-matting fallback/polish)
 * 2. Categorize (Gemini AI or user group)
 * 3. Save to disk
 */
export async function processStickerUpload(fileData, options = {}) {
  const {
    pin,
    targetGroup = '',
    autoCategorize = true,
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

  // 1. Background removal
  let cleanedBuffer = buffer;
  let usedGeminiImage = false;

  if (removeBackground) {
    // Try Gemini Flash 2.5 Image API first
    try {
      const b64Input = buffer.toString('base64');
      cleanedBuffer = await callGeminiFlashImageCleaning(b64Input, mimeType);
      usedGeminiImage = true;
      console.log('[StickerService] Background removed via Gemini 2.5 Flash Image');
    } catch (geminiErr) {
      console.warn('[StickerService] Gemini image cleaning failed, using local alpha-matting fallback:', geminiErr.message);
      // Fall back smoothly to high-fidelity local alpha-matting
      try {
        cleanedBuffer = await cleanBackgroundLocal(buffer);
      } catch (localErr) {
        console.warn('[StickerService] Local alpha-matting also failed, using original image:', localErr.message);
        // Keep original buffer, just resize/convert to PNG
        cleanedBuffer = await sharp(buffer)
          .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
          .png({ quality: 90 })
          .toBuffer();
      }
    }
  } else {
    // Just ensure standard PNG sizing and clean edges
    cleanedBuffer = await sharp(buffer)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .png({ quality: 95 })
      .toBuffer();
  }

  // 2. Intelligent Categorization
  let groupName = (targetGroup || '').trim();
  let emoji = '✦';
  let stickerName = fileData.name ? path.parse(fileData.name).name : 'Sticker';
  let tags = ['custom'];

  if (autoCategorize || !groupName) {
    const aiMeta = await categorizeStickerWithAi(cleanedBuffer.toString('base64'), 'image/png');
    if (!groupName) {
      groupName = aiMeta.category || 'custom';
      emoji = aiMeta.emoji || '✦';
    }
    if (aiMeta.name && aiMeta.name !== 'Custom Sticker') {
      stickerName = aiMeta.name;
    }
    tags = aiMeta.tags || ['custom'];
  }

  // Normalize group ID
  const packId = groupName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const packLabel = groupName.split(/[-\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // 3. Save to disk
  const stickerId = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const filename = `${stickerId}.png`;
  const filePath = path.join(STICKERS_DIR, filename);

  fs.writeFileSync(filePath, cleanedBuffer);

  const meta = await sharp(cleanedBuffer).metadata();

  const stickerRecord = {
    id: stickerId,
    name: stickerName,
    pack: packId,
    tags,
    url: `/custom-stickers/${filename}`,
    filename,
    defaultSize: 200,
    width: meta.width || 512,
    height: meta.height || 512,
    createdAt: Date.now(),
    bgCleanedVia: usedGeminiImage ? 'gemini-2.5-flash-image' : 'smart-alpha-matting'
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
 * Batch upload up to 50 stickers
 */
export async function batchUploadStickers(files, options = {}) {
  const { pin, targetGroup, autoCategorize, removeBackground } = options;

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
        autoCategorize,
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

  return {
    success: results.length > 0,
    uploaded: results.length,
    failed: errors.length,
    results,
    errors,
    packs: store.packs,
    totalCustomStickers: store.stickers.length
  };
}
