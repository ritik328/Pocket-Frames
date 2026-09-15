/**
 * Pocket Frames - Structured AI Response Schema Validator
 */

import { SCHEMA_VERSION } from '../prompts/photographyDirector.v1.js';

export function validateAiResponse(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'AI response is not an object' };
  }

  // Schema version check
  if (data.schema_version && data.schema_version !== SCHEMA_VERSION) {
    console.warn(`[AI Schema] Version mismatch: received ${data.schema_version}, expected ${SCHEMA_VERSION}`);
  }

  // Required core fields
  const requiredKeys = ['photo_title', 'caption_options', 'recommended_caption', 'hashtags', 'composition', 'portfolio_potential'];
  for (const key of requiredKeys) {
    if (data[key] === undefined || data[key] === null) {
      return { valid: false, error: `Missing required field: "${key}"` };
    }
  }

  // Validate composition coordinates
  const comp = data.composition;
  if (typeof comp !== 'object') {
    return { valid: false, error: 'composition must be an object' };
  }

  if (comp.recommended_x !== undefined && (typeof comp.recommended_x !== 'number' || isNaN(comp.recommended_x))) {
    return { valid: false, error: 'recommended_x must be a valid number' };
  }

  if (comp.recommended_y !== undefined && (typeof comp.recommended_y !== 'number' || isNaN(comp.recommended_y))) {
    return { valid: false, error: 'recommended_y must be a valid number' };
  }

  if (comp.recommended_zoom !== undefined && (typeof comp.recommended_zoom !== 'number' || isNaN(comp.recommended_zoom))) {
    return { valid: false, error: 'recommended_zoom must be a valid number' };
  }

  // Validate captions
  if (!Array.isArray(data.caption_options) || data.caption_options.length === 0) {
    return { valid: false, error: 'caption_options must be a non-empty array' };
  }

  // Validate hashtags
  if (!Array.isArray(data.hashtags)) {
    return { valid: false, error: 'hashtags must be an array' };
  }

  return { valid: true };
}
