/**
 * Pocket Frames - Typography Management & Font Readiness
 */

export const FONT_CONFIG = {
  branding: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    style: "italic",
    weight: "500",
    letterSpacing: "0.32em"
  },
  device: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    style: "normal",
    weight: "600",
    letterSpacing: "0.08em"
  },
  exif: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    style: "normal",
    weight: "400",
    letterSpacing: "0.06em"
  }
};

/**
 * Ensure all fonts are loaded before canvas rendering
 */
export async function ensureFontsReady() {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (err) {
      console.warn('Font loading check error, proceeding with system fallbacks:', err);
    }
  }
}

/**
 * Helper to render centered text with letter-spacing
 * @param {CanvasRenderingContext2D} ctx 
 * @param {string} text 
 * @param {number} x - Center X
 * @param {number} y - Baseline Y
 * @param {number} fontSize - Font size in target pixels
 * @param {object} fontDef - Font definition
 */
export function drawCenteredText(ctx, text, x, y, fontSize, fontDef) {
  if (!text) return;
  
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${fontDef.style || 'normal'} ${fontDef.weight || '400'} ${Math.round(fontSize)}px ${fontDef.family}`;
  
  // Set letter spacing if supported
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = fontDef.letterSpacing || 'normal';
    ctx.fillText(text, x, y);
  } else {
    // Fallback: draw with spaced characters
    const spacingPx = fontSize * (parseFloat(fontDef.letterSpacing) || 0);
    const chars = Array.from(text);
    const charWidths = chars.map(c => ctx.measureText(c).width);
    const totalWidth = charWidths.reduce((a, b) => a + b, 0) + spacingPx * (chars.length - 1);
    
    let currentX = x - totalWidth / 2;
    ctx.textAlign = 'left';
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], currentX, y);
      currentX += charWidths[i] + spacingPx;
    }
  }
  
  ctx.restore();
}
