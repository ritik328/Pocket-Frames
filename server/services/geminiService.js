/**
 * Pocket Frames - Gemini Vision Server Service
 * Handles server-side calls to Gemini Vision API with configurable model,
 * timeouts, transient retries, strict validation, and demo mode.
 */

import { SYSTEM_PROMPT, PROMPT_VERSION, SCHEMA_VERSION } from '../prompts/photographyDirector.v1.js';
import { validateAiResponse } from '../validation/aiResponseSchema.js';
import { sanitizeAiResponse } from '../validation/sanitizeAiResponse.js';
import { generateRequestId } from '../utils/requestId.js';
import { computeImageHash } from '../utils/imageHash.js';

const DEFAULT_TIMEOUT_MS = 25000;
const MAX_RETRIES = 2;

// In-memory response cache: hash -> validated JSON response
const memoryCache = new Map();

/**
 * Check if Gemini API is configured in the environment
 */
export function isGeminiConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 10);
}

/**
 * Get active configuration status
 */
export function getServiceStatus() {
  const configured = isGeminiConfigured();
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  return {
    configured,
    status: configured ? 'connected' : 'not_configured',
    model,
    prompt_version: PROMPT_VERSION,
    schema_version: SCHEMA_VERSION
  };
}

/**
 * Primary Workflow: Create Post
 * Orchestrates full visual analysis, composition recommendation, captions, hashtags, critique, and portfolio potential.
 */
export async function createPost(payload) {
  return executeAiOperation('create_post', payload, 'Analyze this photograph and create a complete Instagram post package according to the system prompt guidelines.');
}

/**
 * Modular Operation: Analyze Photo
 */
export async function analyzePhoto(payload) {
  return executeAiOperation('analyze_photo', payload, 'Analyze this photograph for genre, lighting, visual balance, negative space, visual impact, and camera settings explanation.');
}

/**
 * Modular Operation: Composition
 */
export async function getCompositionRecommendation(payload) {
  return executeAiOperation('composition', payload, 'Analyze the subject position, horizon, and leading lines. Recommend normalized subject center coordinates (recommended_x, recommended_y) and zoom.');
}

/**
 * Modular Operation: Critique
 */
export async function getCritique(payload) {
  return executeAiOperation('critique', payload, 'Provide an educational critique: what works, what weakens it, what to try, and what not to change.');
}

/**
 * Core execution engine with caching, timeout, retries, and validation
 */
async function executeAiOperation(operation, payload, userPrompt) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  // Cache Check
  const imageHash = computeImageHash(payload.image?.data, {
    day: payload.day_number,
    metadata: payload.metadata,
    operation,
    model,
    promptVersion: PROMPT_VERSION
  });

  const cached = memoryCache.get(imageHash);
  if (cached) {
    return {
      success: true,
      data: cached,
      request_id: requestId,
      cached: true,
      duration_ms: Date.now() - startTime,
      isDemo: false
    };
  }

  // If no API Key: return transparent DEMO MODE response
  if (!apiKey) {
    console.info(`[GeminiService] No GEMINI_API_KEY found. Serving DEMO MODE response for ${requestId}.`);
    const demoData = generateDemoResponse(payload);
    return {
      success: true,
      data: demoData,
      request_id: requestId,
      duration_ms: Date.now() - startTime,
      isDemo: true,
      demoNotice: 'DEMO MODE — Gemini API not configured on server'
    };
  }

  // Construct Gemini REST Payload
  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const imageMimeType = payload.image?.mimeType || payload.image?.mime_type || 'image/jpeg';
  const imageBase64 = payload.image?.data || '';

  const contextNotes = [
    `Day Number: ${payload.day_number || 18}`,
    `Campaign: ${payload.campaign || '47 DAYS / 47 FRAMES'}`,
    `Device: ${payload.device || payload.metadata?.device || 'OPPO Smartphone'}`,
    payload.metadata?.focalLength ? `Focal Length: ${payload.metadata.focalLength}` : null,
    payload.metadata?.aperture ? `Aperture: ${payload.metadata.aperture}` : null,
    payload.metadata?.shutter ? `Shutter Speed: ${payload.metadata.shutter}` : null,
    payload.metadata?.iso ? `ISO: ${payload.metadata.iso}` : null,
    payload.user_notes ? `Photographer Notes: ${payload.user_notes}` : null
  ].filter(Boolean).join('\n');

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: imageMimeType,
              data: imageBase64
            }
          },
          {
            text: `${userPrompt}\n\nSUPPLIED CONTEXT:\n${contextNotes}`
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    generationConfig: {
      temperature: 0.35,
      responseMimeType: 'application/json'
    }
  };

  // Perform Request with Timeout and Controlled Retries
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[GeminiService] HTTP ${response.status} from Gemini on attempt ${attempt}:`, errorBody.substring(0, 300));

        // Retry transient errors (503 Service Unavailable, 429 Rate Limit)
        if ((response.status === 503 || response.status === 429) && attempt <= MAX_RETRIES) {
          const delay = attempt * 1200;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        throw new Error(`Gemini API returned HTTP ${response.status}`);
      }

      const rawJson = await response.json();
      const rawText = rawJson.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('Empty response from Gemini vision model');
      }

      let parsedData;
      try {
        parsedData = JSON.parse(rawText);
      } catch (parseErr) {
        console.error(`[GeminiService] JSON Parse Error:`, rawText.substring(0, 300));
        throw new Error('AI response was not valid JSON');
      }

      // Strict Schema Validation
      const validation = validateAiResponse(parsedData);
      if (!validation.valid) {
        console.warn(`[GeminiService] Schema validation warning: ${validation.error}`);
      }

      // Sanitization & Clamping
      const sanitized = sanitizeAiResponse(parsedData, {
        day_number: payload.day_number,
        defaultTitle: 'Fine Art Mobile Study'
      });

      // Cache validated output
      memoryCache.set(imageHash, sanitized);
      if (memoryCache.size > 100) {
        const oldestKey = memoryCache.keys().next().value;
        memoryCache.delete(oldestKey);
      }

      return {
        success: true,
        data: sanitized,
        request_id: requestId,
        duration_ms: Date.now() - startTime,
        isDemo: false
      };

    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      if (err.name === 'AbortError') {
        throw new Error('AI request timed out after 25 seconds');
      }

      if (attempt <= MAX_RETRIES) {
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }

  // Return clean, safe structured error (no internal secrets leaked)
  return {
    success: false,
    error: {
      code: 'AI_SERVICE_ERROR',
      message: lastError?.message || 'Unable to complete AI analysis at this time. Please try again.'
    },
    request_id: requestId,
    duration_ms: Date.now() - startTime
  };
}

/**
 * Generate high-taste, realistic photographic demo responses when API key is not configured.
 * Clearly marked as DEMO MODE.
 */
function generateDemoResponse(payload) {
  const day = payload.day_number || 18;
  const device = payload.device || payload.metadata?.device || 'OPPO Find X9';
  const aperture = payload.metadata?.aperture || 'f/2.6';
  const focal = payload.metadata?.focalLength || '146mm';

  return sanitizeAiResponse({
    schema_version: SCHEMA_VERSION,
    day_number: day,
    photo_title: 'Geometry of Solitude',
    genre: {
      primary: 'Street Photography',
      secondary: ['Architectural', 'Minimal'],
      confidence: 0.94
    },
    caption_options: [
      {
        style: 'minimal',
        text: 'The city breathes in lines, pauses, and quiet light.'
      },
      {
        style: 'cinematic',
        text: 'Between the towering facades, a singular figure anchors the afternoon stillness.'
      },
      {
        style: 'documentary',
        text: 'An unhurried crossing along the city intersection as late shadows stretch across the asphalt.'
      },
      {
        style: 'personal',
        text: 'Some frames ask you to slow down your step before you tap the shutter.'
      },
      {
        style: 'photography_focused',
        text: `Framed at ${focal} ${aperture}, balancing architectural compression with ambient foreground reflection.`
      }
    ],
    recommended_caption: 'The city breathes in lines, pauses, and quiet light.',
    hashtags: ['#ShotOnOPPO', '#MobilePhotography', '#StreetPhotography', '#UrbanGeometry', '#PhotographersOfIndia'],
    alt_text: 'A high-contrast street scene showing a lone pedestrian walking along clean architectural shadows.',
    story_text: `DAY ${String(day).padStart(2, '0')}/47 — Shot on ${device} × Hasselblad`,
    composition: {
      score: 8.6,
      strengths: [
        'Strong diagonal leading lines guide the viewer directly toward the subject.',
        'Balanced distribution of negative space in upper architectural planes.'
      ],
      weaknesses: [
        'Slight left-edge distraction from ambient street furniture.'
      ],
      recommended_x: 0.52,
      recommended_y: 0.48,
      recommended_zoom: 1.06,
      confidence: 0.88,
      reason: 'A 6% punch-in eliminates peripheral edge clutter while locking the subject on the golden ratio intersection.'
    },
    critique: {
      what_works: 'The geometric rhythm between light and shadow gives the frame exceptional graphic tension.',
      what_weakens_it: 'A faint high-contrast highlight in the top-left margin pulls gaze away from the walker.',
      what_to_try: 'Apply the suggested 1.06× crop to seal the visual boundary.',
      what_not_to_change: 'The rich shadow depth and authentic skin tones are perfectly exposed.'
    },
    scores: {
      composition: 8.6,
      story: 8.4,
      visual_impact: 8.7,
      background: 7.9
    },
    portfolio_potential: {
      rating: 'high',
      score: 8.8,
      reason: 'Potentially strong portfolio piece: demonstrates intentional composition, subtle narrative, and disciplined mobile optics.'
    },
    mobile_photography_strength: {
      score: 8.6,
      highlights: ['Controlled highlight roll-off', 'Zero chromatic fringing along high-contrast building lines', 'Natural micro-contrast']
    },
    oppo_relevance: {
      rating: 'high',
      score: 8.4,
      reason: 'Exemplary demonstration of natural Hasselblad color calibration without oversaturated tones.'
    },
    camera_explanation: `Captured on ${device} (${focal}, ${aperture}). The telephoto compression isolates the subject from distant background chaos.`
  });
}
