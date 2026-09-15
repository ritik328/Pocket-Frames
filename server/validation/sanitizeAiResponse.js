/**
 * Pocket Frames - AI Output Sanitizer and Normalizer
 * Clamps coordinates to safe bounds, formats hashtags, and guards against malformed values.
 */

import { SCHEMA_VERSION } from '../prompts/photographyDirector.v1.js';

export function sanitizeAiResponse(raw, fallbackContext = {}) {
  const result = { ...raw };

  result.schema_version = SCHEMA_VERSION;
  result.day_number = typeof raw.day_number === 'number' ? raw.day_number : (fallbackContext.day_number || 18);
  result.photo_title = (raw.photo_title || fallbackContext.defaultTitle || 'Untitled Study').trim();

  // Genre Sanitization
  result.genre = {
    primary: raw.genre?.primary || 'Fine Art Mobile Photography',
    secondary: Array.isArray(raw.genre?.secondary) ? raw.genre.secondary.slice(0, 3) : ['Contemporary'],
    confidence: clampNumber(raw.genre?.confidence, 0.5, 1.0, 0.85)
  };

  // Caption Options Sanitization
  if (Array.isArray(raw.caption_options) && raw.caption_options.length > 0) {
    result.caption_options = raw.caption_options.map(c => ({
      style: (c.style || 'minimal').toLowerCase().replace(/\s+/g, '_'),
      text: (c.text || '').trim()
    })).filter(c => c.text.length > 0);
  } else {
    result.caption_options = [
      { style: 'minimal', text: 'A quiet study in natural light and geometry.' },
      { style: 'cinematic', text: 'The atmosphere of a fleeting moment, preserved.' }
    ];
  }

  result.recommended_caption = (raw.recommended_caption || result.caption_options[0]?.text || '').trim();

  // Hashtags Sanitization (3 to 6 valid hashtags)
  if (Array.isArray(raw.hashtags)) {
    result.hashtags = raw.hashtags
      .map(tag => {
        let clean = tag.trim();
        if (!clean.startsWith('#')) clean = `#${clean}`;
        return clean.replace(/[^\w#]/g, '');
      })
      .filter(tag => tag.length > 1)
      .slice(0, 6);
  } else {
    result.hashtags = ['#ShotOnOPPO', '#MobilePhotography', '#StreetPhotography'];
  }

  // Alt text and Story text
  result.alt_text = (raw.alt_text || 'Photographic print captured on mobile camera with intentional framing.').trim();
  result.story_text = (raw.story_text || `DAY ${String(result.day_number).padStart(2, '0')}/47 — Shot on OPPO × Hasselblad`).trim();

  // Composition Normalization & Clamping
  const comp = raw.composition || {};
  result.composition = {
    score: clampNumber(comp.score, 1.0, 10.0, 8.2),
    strengths: Array.isArray(comp.strengths) ? comp.strengths.slice(0, 4) : ['Intentional subject placement'],
    weaknesses: Array.isArray(comp.weaknesses) ? comp.weaknesses.slice(0, 4) : [],
    recommended_x: clampNumber(comp.recommended_x, 0.0, 1.0, 0.50),
    recommended_y: clampNumber(comp.recommended_y, 0.0, 1.0, 0.50),
    recommended_zoom: clampNumber(comp.recommended_zoom, 0.1, 4.0, 1.0),
    confidence: clampNumber(comp.confidence, 0.1, 1.0, 0.80),
    reason: (comp.reason || 'Balances subject weight with negative space.').trim()
  };

  // Critique Normalization
  const crit = raw.critique || {};
  result.critique = {
    what_works: (crit.what_works || 'Clean tonal gradation and focused focal point.').trim(),
    what_weakens_it: (crit.what_weakens_it || 'Perimeter highlights can draw peripheral eye focus.').trim(),
    what_to_try: (crit.what_to_try || 'Consider applying the suggested crop to eliminate distracting edge light.').trim(),
    what_not_to_change: (crit.what_not_to_change || 'The natural contrast and shadow texture are already excellent.').trim()
  };

  // Scores Breakdown
  const scores = raw.scores || {};
  result.scores = {
    composition: clampNumber(scores.composition, 1.0, 10.0, result.composition.score),
    story: clampNumber(scores.story, 1.0, 10.0, 8.4),
    visual_impact: clampNumber(scores.visual_impact, 1.0, 10.0, 8.0),
    background: clampNumber(scores.background, 1.0, 10.0, 7.6)
  };

  // Portfolio Potential
  const port = raw.portfolio_potential || {};
  result.portfolio_potential = {
    rating: (['high', 'medium', 'low'].includes(port.rating?.toLowerCase()) ? port.rating.toLowerCase() : 'medium'),
    score: clampNumber(port.score, 1.0, 10.0, 8.5),
    reason: (port.reason || 'Demonstrates solid compositional discipline and storytelling.').trim()
  };

  // Mobile Photography Strength
  const mob = raw.mobile_photography_strength || {};
  result.mobile_photography_strength = {
    score: clampNumber(mob.score, 1.0, 10.0, 8.3),
    highlights: Array.isArray(mob.highlights) ? mob.highlights.slice(0, 3) : ['Accurate exposure handling', 'Natural depth of field']
  };

  // OPPO Relevance
  const oppo = raw.oppo_relevance || {};
  result.oppo_relevance = {
    rating: (['high', 'medium', 'low'].includes(oppo.rating?.toLowerCase()) ? oppo.rating.toLowerCase() : 'medium'),
    score: clampNumber(oppo.score, 1.0, 10.0, 8.0),
    reason: (oppo.reason || 'Authentic use of mobile camera technology.').trim()
  };

  result.camera_explanation = (raw.camera_explanation || '').trim();

  return result;
}

function clampNumber(val, min, max, defaultVal) {
  if (typeof val !== 'number' || isNaN(val)) return defaultVal;
  return Math.max(min, Math.min(max, parseFloat(val.toFixed(2))));
}
