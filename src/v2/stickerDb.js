/**
 * Pocket Frames - Persistent Sticker Database (IndexedDB)
 * Replaces restrictive 5MB localStorage with high-capacity IndexedDB (Gigabytes quota).
 * Ensures stickers, images, data URLs, and collections persist permanently across
 * page refreshes, browser restarts, and serverless cold shutdowns.
 */

const DB_NAME = 'PocketFramesStickersDB';
const DB_VERSION = 1;
const STICKERS_STORE = 'stickers';
const PACKS_STORE = 'packs';

let _dbPromise = null;

function getDb() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('[StickerDB] IndexedDB is not supported in this environment');
      return resolve(null);
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STICKERS_STORE)) {
        const sStore = db.createObjectStore(STICKERS_STORE, { keyPath: 'id' });
        sStore.createIndex('pack', 'pack', { unique: false });
        sStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(PACKS_STORE)) {
        db.createObjectStore(PACKS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('[StickerDB] Failed to open IndexedDB:', request.error);
      resolve(null); // Resolve null to gracefully fallback
    };
  });

  return _dbPromise;
}

/**
 * Save a single sticker record to IndexedDB
 */
export async function saveStickerToDb(sticker) {
  if (!sticker || !sticker.id) return false;
  try {
    const db = await getDb();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STICKERS_STORE, 'readwrite');
      const store = tx.objectStore(STICKERS_STORE);
      store.put(sticker);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.warn('[StickerDB] Error saving sticker to DB:', tx.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[StickerDB] saveStickerToDb exception:', err);
    return false;
  }
}

/**
 * Save multiple stickers to IndexedDB in a single transaction
 */
export async function saveStickersToDb(stickers) {
  if (!Array.isArray(stickers) || stickers.length === 0) return true;
  try {
    const db = await getDb();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STICKERS_STORE, 'readwrite');
      const store = tx.objectStore(STICKERS_STORE);
      for (const s of stickers) {
        if (s && s.id) store.put(s);
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.warn('[StickerDB] Error bulk saving stickers:', tx.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[StickerDB] saveStickersToDb exception:', err);
    return false;
  }
}

/**
 * Get all stickers from IndexedDB
 */
export async function getAllStickersFromDb() {
  try {
    const db = await getDb();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction(STICKERS_STORE, 'readonly');
      const store = tx.objectStore(STICKERS_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        console.warn('[StickerDB] Error reading stickers from DB:', request.error);
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('[StickerDB] getAllStickersFromDb exception:', err);
    return [];
  }
}

/**
 * Save a pack definition to IndexedDB
 */
export async function savePackToDb(pack) {
  if (!pack || !pack.id) return false;
  try {
    const db = await getDb();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(PACKS_STORE, 'readwrite');
      const store = tx.objectStore(PACKS_STORE);
      store.put(pack);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    return false;
  }
}

/**
 * Save multiple packs to IndexedDB
 */
export async function savePacksToDb(packs) {
  if (!Array.isArray(packs) || packs.length === 0) return true;
  try {
    const db = await getDb();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(PACKS_STORE, 'readwrite');
      const store = tx.objectStore(PACKS_STORE);
      for (const p of packs) {
        if (p && p.id) store.put(p);
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    return false;
  }
}

/**
 * Get all packs from IndexedDB
 */
export async function getAllPacksFromDb() {
  try {
    const db = await getDb();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction(PACKS_STORE, 'readonly');
      const store = tx.objectStore(PACKS_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

/**
 * Delete a pack and all its stickers from IndexedDB
 */
export async function deletePackFromDb(packId) {
  if (!packId) return false;
  try {
    const db = await getDb();
    if (!db) return false;

    const rawLower = String(packId).toLowerCase().trim();
    const slug = rawLower.replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');

    const stickers = await getAllStickersFromDb();
    const stickersToDelete = stickers.filter(s => {
      const sPack = String(s.pack || '').toLowerCase().trim();
      const sSlug = sPack.replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
      return sPack === rawLower || sSlug === slug || sPack === packId;
    });

    return new Promise((resolve) => {
      const tx = db.transaction([STICKERS_STORE, PACKS_STORE], 'readwrite');
      const sStore = tx.objectStore(STICKERS_STORE);
      const pStore = tx.objectStore(PACKS_STORE);

      pStore.delete(packId);
      if (rawLower !== packId) pStore.delete(rawLower);
      if (slug !== packId) pStore.delete(slug);

      for (const s of stickersToDelete) {
        sStore.delete(s.id);
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[StickerDB] deletePackFromDb exception:', err);
    return false;
  }
}

/**
 * Rename a pack in IndexedDB
 */
export async function renamePackInDb(packId, newLabel) {
  if (!packId || !newLabel) return false;
  try {
    const db = await getDb();
    if (!db) return false;

    const rawLower = String(packId).toLowerCase().trim();
    const slug = rawLower.replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');

    const packs = await getAllPacksFromDb();
    const targetPack = packs.find(p => {
      const pId = String(p.id || '').toLowerCase().trim();
      const pSlug = pId.replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
      return p.id === packId || pId === rawLower || pSlug === slug;
    });

    if (targetPack) {
      targetPack.label = newLabel;
      await savePackToDb(targetPack);
    } else {
      await savePackToDb({ id: packId, label: newLabel, emoji: '✦' });
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Migrate any existing stickers from localStorage to IndexedDB
 * Also frees up localStorage space to avoid QuotaExceededError.
 */
export async function migrateFromLocalStorage() {
  try {
    const raw = localStorage.getItem('pocketframes_custom_stickers_v2');
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.stickers) && parsed.stickers.length > 0) {
      await saveStickersToDb(parsed.stickers);
      console.log(`[StickerDB] Migrated ${parsed.stickers.length} stickers from localStorage to IndexedDB`);
    }
    if (Array.isArray(parsed.packs) && parsed.packs.length > 0) {
      await savePacksToDb(parsed.packs);
    }

    // Keep lightweight metadata in localStorage without large base64 dataUrls
    const lightStickers = (parsed.stickers || []).map(s => ({
      ...s,
      dataUrl: undefined // Remove heavy base64 from localStorage to stay far below 5MB limit
    }));
    try {
      localStorage.setItem('pocketframes_custom_stickers_v2', JSON.stringify({
        packs: parsed.packs || [],
        stickers: lightStickers
      }));
    } catch {
      // If even light fails, clear it completely since IndexedDB has everything
      localStorage.removeItem('pocketframes_custom_stickers_v2');
    }
  } catch (err) {
    console.warn('[StickerDB] Migration from localStorage skipped:', err);
  }
}

/**
 * Export all custom stickers and packs as a backup JSON object
 */
export async function exportStickersBackup() {
  const stickers = await getAllStickersFromDb();
  const packs = await getAllPacksFromDb();
  return {
    version: 1,
    exportedAt: Date.now(),
    packs,
    stickers
  };
}

/**
 * Import a backup JSON object into IndexedDB
 */
export async function importStickersBackup(backupData) {
  if (!backupData || typeof backupData !== 'object') {
    throw new Error('Invalid backup file format');
  }
  const stickers = Array.isArray(backupData.stickers) ? backupData.stickers : [];
  const packs = Array.isArray(backupData.packs) ? backupData.packs : [];

  if (stickers.length > 0) {
    await saveStickersToDb(stickers);
  }
  if (packs.length > 0) {
    await savePacksToDb(packs);
  }

  return {
    success: true,
    stickersCount: stickers.length,
    packsCount: packs.length
  };
}

