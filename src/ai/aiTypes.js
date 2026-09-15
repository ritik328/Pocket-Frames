/**
 * Pocket Frames - AI Types and Constants
 */

export const AI_SCHEMA_VERSION = 'pocket-frames-ai-v1';

export const AI_STATUS = {
  IDLE: 'IDLE',
  ANALYZING: 'ANALYZING',
  SUCCESS: 'SUCCESS',
  DEMO_MODE: 'DEMO_MODE',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE'
};

export const CAPTION_STYLES = [
  { id: 'minimal', label: 'Minimal', hint: 'Subtle, restrained, quiet observation' },
  { id: 'cinematic', label: 'Cinematic', hint: 'Atmosphere, tone, visual mood' },
  { id: 'documentary', label: 'Documentary', hint: 'Realist street & human context' },
  { id: 'personal', label: 'Personal', hint: 'First-person photographic reflection' },
  { id: 'photography_focused', label: 'Photography', hint: 'Optics, light balance & focal depth' }
];

export const DEFAULT_CAMPAIGN = '47 DAYS / 47 FRAMES';
