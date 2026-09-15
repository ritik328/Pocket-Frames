/**
 * Generate a unique request identifier for AI tracing and diagnostics.
 * Format: req_<timestamp>_<randomHex>
 */
export function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}
