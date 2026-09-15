/**
 * Pocket Frames - Frontend Gemini Client Bridge
 * Handles 1024px analysis downscaling, AbortController request cancellation,
 * caching, and server communication.
 */

import { getCachedAnalysis, setCachedAnalysis, generateClientCacheKey } from './aiCache.js';

let activeAbortController = null;

/**
 * Cancel any ongoing in-flight AI request
 */
export function cancelActiveAiRequest() {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
}

/**
 * Fetch server-side Gemini service status (Connected / Demo Mode)
 */
export async function fetchAiStatus() {
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) return { configured: false, status: 'not_configured' };
    return await res.json();
  } catch (err) {
    return { configured: false, status: 'network_error' };
  }
}

/**
 * Request "Create Post" structured post package from Gemini backend
 */
export async function requestCreatePost({ imageState, dayNumber, campaign, metadata, userNotes }) {
  // 1. Cancel previous in-flight request
  cancelActiveAiRequest();
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;

  // 2. Check client cache
  const cacheKey = generateClientCacheKey(imageState, dayNumber, 'create_post');
  const cached = getCachedAnalysis(cacheKey);
  if (cached) {
    return { success: true, data: cached, cached: true, isDemo: false };
  }

  // 3. Prepare 1024px analysis copy (original photo remains untouched for export)
  const analysisImage = await create1024pxAnalysisCopy(imageState.element);

  const payload = {
    image: analysisImage,
    day_number: dayNumber || 18,
    campaign: campaign || '47 DAYS / 47 FRAMES',
    device: metadata?.device || 'OPPO Find X9',
    metadata: {
      device: metadata?.device,
      focalLength: metadata?.focalLength,
      aperture: metadata?.aperture,
      shutter: metadata?.shutter,
      iso: metadata?.iso
    },
    user_notes: userNotes || ''
  };

  try {
    const response = await fetch('/api/ai/create-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const message = errorJson.error?.message || `Server returned error (${response.status})`;
      return {
        success: false,
        error: { code: errorJson.error?.code || 'SERVER_ERROR', message }
      };
    }

    const result = await response.json();

    if (result.success && result.data) {
      setCachedAnalysis(cacheKey, result.data);
    }

    return result;

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, cancelled: true };
    }
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Unable to connect to AI server. Please check connection.' }
    };
  } finally {
    activeAbortController = null;
  }
}

/**
 * Creates a lightweight <=1024px longest-edge JPEG copy purely for visual analysis.
 * Preserves the original high-res image intact for final master rendering.
 * 
 * @param {HTMLImageElement|HTMLCanvasElement} imgElement
 * @returns {Promise<{ mimeType: string, data: string, width: number, height: number }>}
 */
export async function create1024pxAnalysisCopy(imgElement) {
  const origW = imgElement.naturalWidth || imgElement.width || 1024;
  const origH = imgElement.naturalHeight || imgElement.height || 1024;

  const maxDimension = 1024;
  let targetW = origW;
  let targetH = origH;

  if (origW > maxDimension || origH > maxDimension) {
    if (origW >= origH) {
      targetW = maxDimension;
      targetH = Math.round((origH * maxDimension) / origW);
    } else {
      targetH = maxDimension;
      targetW = Math.round((origW * maxDimension) / origH);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imgElement, 0, 0, targetW, targetH);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const base64Data = dataUrl.split(',')[1] || '';

  return {
    mimeType: 'image/jpeg',
    data: base64Data,
    width: targetW,
    height: targetH
  };
}
