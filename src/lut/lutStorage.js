/**
 * Pocket Frames - IndexedDB Storage for User-Uploaded .CUBE LUTs
 */
import { parseCubeLut } from './lutParser.js';

const DB_NAME = 'PocketFrames_LUT_Vault';
const DB_VERSION = 1;
const STORE_NAME = 'custom_luts';

function openLutDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save custom LUT into IndexedDB
 */
export async function saveCustomLut(lut) {
  try {
    const db = await openLutDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        id: lut.id,
        title: lut.title,
        filename: lut.filename,
        rawText: lut.rawText,
        type: lut.type,
        size: lut.size,
        createdAt: lut.createdAt || Date.now()
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[LutStorage] Failed to save custom LUT:', err);
    return false;
  }
}

/**
 * Load all custom LUTs from IndexedDB and re-parse them
 */
export async function loadAllCustomLuts() {
  try {
    const db = await openLutDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = req.result || [];
        const parsedLuts = [];
        for (const rec of records) {
          try {
            const lut = parseCubeLut(rec.rawText, rec.filename);
            lut.id = rec.id;
            lut.title = rec.title || lut.title;
            lut.isBuiltin = false;
            lut.createdAt = rec.createdAt;
            parsedLuts.push(lut);
          } catch (e) {
            console.warn('[LutStorage] Failed to parse stored LUT:', rec.filename, e);
          }
        }
        resolve(parsedLuts);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[LutStorage] Failed to load custom LUTs:', err);
    return [];
  }
}

/**
 * Delete a custom LUT from IndexedDB
 */
export async function deleteCustomLut(id) {
  try {
    const db = await openLutDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[LutStorage] Failed to delete custom LUT:', err);
    return false;
  }
}
