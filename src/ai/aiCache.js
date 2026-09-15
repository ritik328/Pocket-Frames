/**
 * Pocket Frames - Client-Side AI Response Cache
 * Caches structured Gemini responses for the active image session.
 */

const clientCache = new Map();

export function getCachedAnalysis(cacheKey) {
  if (!cacheKey) return null;
  return clientCache.get(cacheKey) || null;
}

export function setCachedAnalysis(cacheKey, data) {
  if (!cacheKey || !data) return;
  clientCache.set(cacheKey, data);
  // Cap at 30 items
  if (clientCache.size > 30) {
    const oldest = clientCache.keys().next().value;
    clientCache.delete(oldest);
  }
}

export function clearAiCache() {
  clientCache.clear();
}

export function generateClientCacheKey(imageState, dayNumber, operation = 'create_post') {
  if (!imageState) return null;
  const id = imageState.filename || `${imageState.width}x${imageState.height}`;
  return `${id}_d${dayNumber}_${operation}`;
}
