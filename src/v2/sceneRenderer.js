/**
 * Pocket Frames V2 — Unified Scene Renderer
 *
 * Single render path for both editor preview and high-resolution export.
 * renderScene(ctx, scene, assets, options) is the only public API.
 *
 * Coordinate system: logical 2160 × 2700.
 * scale = targetWidth / LOGICAL_W
 */

import { getFrameById } from './frameDefinitions.js';
import { LOGICAL_W, LOGICAL_H } from './scene.js';

// ─── Font config ──────────────────────────────────────────────────────────────
const FONTS = {
  sans:     "'Inter', 'Helvetica Neue', Arial, sans-serif",
  serif:    "'Instrument Serif', 'Georgia', serif",
  mono:     "'JetBrains Mono', 'Courier New', monospace",
  hand:     "'Caveat', cursive",
  typer:    "'Special Elite', cursive",
};

// ─── Main render entry ─────────────────────────────────────────────────────────
/**
 * Render a complete scene to a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} scene  — canonical scene from SceneStore
 * @param {Map}    assets — assetId → { img, w, h }
 * @param {object} options
 * @param {number} options.targetWidth  — canvas pixel width
 * @param {number} options.targetHeight — canvas pixel height
 * @param {boolean} options.isExport    — hide editor UI artifacts
 * @param {object}  options.editorState — { selectedId, gridVisible, guidesVisible }
 */
export function renderScene(ctx, scene, assets, options = {}) {
  const {
    targetWidth  = LOGICAL_W,
    targetHeight = LOGICAL_H,
    isExport     = false,
    editorState  = {}
  } = options;

  const scale = targetWidth / LOGICAL_W;

  // Resize canvas if needed
  if (ctx.canvas.width !== targetWidth || ctx.canvas.height !== targetHeight) {
    ctx.canvas.width  = targetWidth;
    ctx.canvas.height = targetHeight;
  }

  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const frameDef = getFrameById(scene.frame?.id || 'classic-white') || getFrameById('classic-white');

  // 1. Canvas background
  renderBackground(ctx, scene, frameDef, scale);

  // 2. Frame decorations (tape, borders, etc.) — behind photo
  renderFrameDecorations(ctx, frameDef, scale, 'behind');

  // 3. Photo apertures
  renderApertures(ctx, scene, frameDef, assets, scale, isExport, editorState);

  // 4. Frame decorations — in front of photo
  renderFrameDecorations(ctx, frameDef, scale, 'front');

  // 5. Metadata text block
  if (frameDef.metadata?.visible !== false) {
    renderMetadata(ctx, scene, frameDef, scale);
  }

  // 6. Scene elements (stickers, text, tape, paper) — sorted by zIndex
  const sorted = [...(scene.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  for (const el of sorted) {
    if (!el.visible) continue;
    renderElement(ctx, el, assets, scale);
  }

  // 7. Editor overlays (grid / guides) — editor only
  if (!isExport && editorState.gridVisible) {
    renderGrid(ctx, frameDef, scale);
  }
}

// ─── Background ───────────────────────────────────────────────────────────────
function renderBackground(ctx, scene, frameDef, scale) {
  ctx.save();
  ctx.fillStyle = frameDef.background || '#FFFFFF';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Paper texture noise for vintage frames
  if (frameDef.id === 'vintage-cream') {
    addNoiseTexture(ctx, scale, 0.03);
  }

  ctx.restore();
}

// ─── Apertures (photo slots) ──────────────────────────────────────────────────
function renderApertures(ctx, scene, frameDef, assets, scale, isExport, editorState) {
  const ap = frameDef.apertures || [];

  ap.forEach((aperture, idx) => {
    const ax = aperture.x * scale;
    const ay = aperture.y * scale;
    const aw = aperture.w * scale;
    const ah = aperture.h * scale;

    ctx.save();
    ctx.beginPath();
    if (aperture.shape === 'rounded' && aperture.radius) {
      ctx.roundRect(ax, ay, aw, ah, aperture.radius * scale);
    } else {
      ctx.rect(ax, ay, aw, ah);
    }
    ctx.clip();

    const photo = scene.photos?.[idx];
    if (photo && assets.get(photo.assetId)) {
      renderPhoto(ctx, photo, assets, aperture, scale, isExport, editorState);
    } else {
      renderEmptyAperture(ctx, ax, ay, aw, ah, aperture, scale, idx);
    }

    ctx.restore();

    // Aperture border
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.rect(ax, ay, aw, ah);
    ctx.stroke();
    ctx.restore();
  });
}

// ─── Photo rendering ──────────────────────────────────────────────────────────
function renderPhoto(ctx, photo, assets, aperture, scale, isExport, editorState) {
  const asset = assets.get(photo.assetId);
  if (!asset?.img) return;

  const ax = aperture.x * scale;
  const ay = aperture.y * scale;
  const aw = aperture.w * scale;
  const ah = aperture.h * scale;
  const acx = ax + aw / 2;
  const acy = ay + ah / 2;

  ctx.fillStyle = '#0F0F12';
  ctx.fillRect(ax, ay, aw, ah);

  const img    = asset.img;
  const imgW   = asset.w;
  const imgH   = asset.h;

  const drawW  = imgW * (photo.scale || 1) * scale;
  const drawH  = imgH * (photo.scale || 1) * scale;
  const drawX  = acx + (photo.x || 0) * scale - drawW / 2;
  const drawY  = acy + (photo.y || 0) * scale - drawH / 2;

  ctx.save();
  if (photo.rotation) {
    ctx.translate(acx, acy);
    ctx.rotate((photo.rotation * Math.PI) / 180);
    ctx.translate(-acx, -acy);
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();

  // Editor guides
  if (!isExport && editorState.guidesVisible) {
    renderPhotoGuides(ctx, ax, ay, aw, ah, acx, acy, photo, scale);
  }
}

// ─── Empty aperture placeholder ───────────────────────────────────────────────
function renderEmptyAperture(ctx, ax, ay, aw, ah, aperture, scale, idx) {
  ctx.fillStyle = aperture.emptyFill || '#F0F0F0';
  ctx.fillRect(ax, ay, aw, ah);

  const cx = ax + aw / 2;
  const cy = ay + ah / 2;
  const iconS = Math.min(aw, ah) * 0.12;

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1.5 * scale;
  ctx.setLineDash([8 * scale, 6 * scale]);
  ctx.strokeRect(ax + 2, ay + 2, aw - 4, ah - 4);
  ctx.setLineDash([]);

  // Camera icon
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2 * scale;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(cx - iconS, cy - iconS * 0.7, iconS * 2, iconS * 1.4, 4 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, iconS * 0.4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.font = `500 ${Math.round(18 * scale)}px ${FONTS.sans}`;
  const label = idx === 0 ? 'Drop photo here' : `Photo ${idx + 1}`;
  ctx.fillText(label, cx, cy + iconS * 1.3);
  ctx.restore();
}

// ─── Photo alignment guides ───────────────────────────────────────────────────
function renderPhotoGuides(ctx, ax, ay, aw, ah, acx, acy, photo, scale) {
  // Rule of thirds
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.8 * scale;
  ctx.setLineDash([4 * scale, 4 * scale]);
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(ax + aw * i / 3, ay); ctx.lineTo(ax + aw * i / 3, ay + ah); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, ay + ah * i / 3); ctx.lineTo(ax + aw, ay + ah * i / 3); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // Center crosshair
  const nearX = Math.abs((photo.x || 0)) < 15;
  const nearY = Math.abs((photo.y || 0)) < 15;
  ctx.save();
  ctx.strokeStyle = nearX ? '#FF4444' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = (nearX ? 2 : 1) * scale;
  ctx.beginPath(); ctx.moveTo(acx, ay); ctx.lineTo(acx, ay + ah); ctx.stroke();
  ctx.strokeStyle = nearY ? '#FF4444' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = (nearY ? 2 : 1) * scale;
  ctx.beginPath(); ctx.moveTo(ax, acy); ctx.lineTo(ax + aw, acy); ctx.stroke();
  ctx.restore();
}

// ─── Frame decorations ────────────────────────────────────────────────────────
function renderFrameDecorations(ctx, frameDef, scale, layer) {
  const decs = frameDef.decorations || [];
  for (const dec of decs) {
    const p = dec.params || {};
    switch (dec.type) {
      case 'tape':         if (layer === 'front') renderTape(ctx, p, scale);        break;
      case 'heart':        if (layer === 'front') renderHeart(ctx, p, scale);       break;
      case 'bow':          if (layer === 'front') renderBow(ctx, p, scale);         break;
      case 'envelope':     if (layer === 'front') renderEnvelope(ctx, p, scale);    break;
      case 'corner-tab':   if (layer === 'behind') renderCornerTabs(ctx, frameDef, p, scale); break;
      case 'line':         if (layer === 'front') renderHLine(ctx, p, scale);       break;
    }
  }
}

// ─── Decoration renderers ─────────────────────────────────────────────────────
function renderTape(ctx, p, scale) {
  ctx.save();
  ctx.translate(p.x * scale, p.y * scale);
  ctx.rotate((p.angle * Math.PI) / 180);
  const w = (p.w || 280) * scale;
  const h = 52 * scale;
  ctx.fillStyle = p.color || 'rgba(220,210,180,0.7)';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  // Texture stripes
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  for (let x = -w / 2; x < w / 2; x += 8 * scale) {
    ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); ctx.stroke();
  }
  ctx.restore();
}

function renderHeart(ctx, p, scale) {
  const x = p.x * scale, y = p.y * scale, s = (p.size || 40) * scale;
  ctx.save();
  ctx.fillStyle = p.color || '#E84040';
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.65, x, y + s * 0.9, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.9, x + s * 0.5, y + s * 0.65, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.fill();
  ctx.restore();
}

function renderBow(ctx, p, scale) {
  const x = p.x * scale, y = p.y * scale, s = (p.size || 100) * scale;
  ctx.save();
  ctx.fillStyle = p.color || '#E8A0A0';
  ctx.strokeStyle = 'rgba(180,80,80,0.5)';
  ctx.lineWidth = 1 * scale;
  // Left loop
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x - s * 0.6, y - s * 0.5, x - s * 0.8, y - s * 0.1, x - s * 0.4, y + s * 0.1);
  ctx.bezierCurveTo(x - s * 0.6, y + s * 0.3, x - s * 0.2, y + s * 0.2, x, y);
  ctx.fill(); ctx.stroke();
  // Right loop
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.5, x + s * 0.8, y - s * 0.1, x + s * 0.4, y + s * 0.1);
  ctx.bezierCurveTo(x + s * 0.6, y + s * 0.3, x + s * 0.2, y + s * 0.2, x, y);
  ctx.fill(); ctx.stroke();
  // Center knot
  ctx.fillStyle = 'rgba(200,120,120,0.9)';
  ctx.beginPath(); ctx.ellipse(x, y, s * 0.1, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function renderEnvelope(ctx, p, scale) {
  const x = p.x * scale, y = p.y * scale, s = (p.size || 140) * scale;
  ctx.save();
  ctx.fillStyle = p.color || '#F5EBE0';
  ctx.strokeStyle = 'rgba(180,140,100,0.5)';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.rect(x - s / 2, y - s * 0.36, s, s * 0.7);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - s / 2, y - s * 0.36); ctx.lineTo(x, y - s * 0.04); ctx.lineTo(x + s / 2, y - s * 0.36); ctx.stroke();
  // Wax seal
  ctx.fillStyle = p.waxColor || '#C45C5C';
  ctx.beginPath(); ctx.arc(x, y + s * 0.05, s * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function renderCornerTabs(ctx, frameDef, p, scale) {
  const color = p.color || '#B8965A';
  const size  = (p.size || 60) * scale;
  const ap    = frameDef.apertures[0];
  const ax    = ap.x * scale, ay = ap.y * scale;
  const aw    = ap.w * scale, ah = ap.h * scale;

  const corners = [
    [ax, ay],             // TL
    [ax + aw, ay],        // TR
    [ax, ay + ah],        // BL
    [ax + aw, ay + ah]    // BR
  ];
  const angles  = [Math.PI * 0.75, Math.PI * 0.25, -Math.PI * 0.25, -Math.PI * 0.75];

  corners.forEach(([cx, cy], i) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angles[i]);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, -size * 0.1);
    ctx.lineTo(size * 0.5, -size * 0.1);
    ctx.lineTo(0, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function renderHLine(ctx, p, scale) {
  ctx.save();
  ctx.strokeStyle = p.color || '#999';
  ctx.lineWidth   = (p.thickness || 1) * scale;
  ctx.beginPath();
  ctx.moveTo(0, p.y * scale);
  ctx.lineTo(ctx.canvas.width, p.y * scale);
  ctx.stroke();
  ctx.restore();
}

// ─── Metadata text block ──────────────────────────────────────────────────────
function renderMetadata(ctx, scene, frameDef, scale) {
  const m   = scene.metadata || {};
  const md  = frameDef.metadata || {};
  const cx  = (LOGICAL_W / 2) * scale;

  const brandFont = md.brandFont || FONTS.sans;

  // Brand
  if (m.brand) {
    ctx.save();
    ctx.fillStyle = md.brandColor || '#1A1A1A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `${md.brandStyle || 'italic'} ${md.brandWeight || '500'} ${Math.round((md.brandSize || 42) * scale)}px ${brandFont}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(0.32 * (md.brandSize || 42) * scale * 0.1)}px`;
    ctx.fillText(m.brand.toUpperCase(), cx, (md.brandY || 230) * scale);
    ctx.restore();
  }

  // Device
  if (m.device) {
    ctx.save();
    ctx.fillStyle = md.deviceColor || '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 ${Math.round((md.deviceSize || 52) * scale)}px ${FONTS.sans}`;
    ctx.fillText(m.device, cx, (md.deviceY || 2270) * scale);
    ctx.restore();
  }

  // EXIF line 1
  const exifParts1 = [
    m.focalLength ? `FL ${m.focalLength}` : '',
    m.aperture    ? `Aperture ${m.aperture}` : ''
  ].filter(Boolean);
  if (exifParts1.length) {
    ctx.save();
    ctx.fillStyle = md.exifColor || '#4A4A4A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `400 ${Math.round((md.exifSize || 36) * scale)}px ${FONTS.sans}`;
    ctx.fillText(exifParts1.join('    '), cx, (md.exif1Y || 2390) * scale);
    ctx.restore();
  }

  // EXIF line 2
  const exifParts2 = [
    m.shutter ? `Shutter ${m.shutter}` : '',
    m.iso     ? `ISO ${m.iso}` : ''
  ].filter(Boolean);
  if (exifParts2.length) {
    ctx.save();
    ctx.fillStyle = md.exifColor || '#4A4A4A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `400 ${Math.round((md.exifSize || 36) * scale)}px ${FONTS.sans}`;
    ctx.fillText(exifParts2.join('    '), cx, (md.exif2Y || 2480) * scale);
    ctx.restore();
  }

  // Caption
  if (m.caption) {
    ctx.save();
    ctx.fillStyle = md.captionColor || '#666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `400 ${Math.round((md.captionSize || 52) * scale)}px ${FONTS.hand}`;
    ctx.fillText(m.caption, cx, (md.captionY || 2500) * scale);
    ctx.restore();
  }

  // Location
  if (m.location) {
    ctx.save();
    ctx.fillStyle = md.exifColor || '#4A4A4A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `400 italic ${Math.round((md.exifSize || 36) * scale)}px ${FONTS.sans}`;
    ctx.fillText(m.location, cx, (md.captionY ? md.captionY + 80 : 2580) * scale);
    ctx.restore();
  }
}

// ─── Scene element renderer ───────────────────────────────────────────────────
function renderElement(ctx, el, assets, scale) {
  ctx.save();

  const cx = (el.x + el.w / 2) * scale;
  const cy = (el.y + el.h / 2) * scale;

  // Apply transform from center
  ctx.translate(cx, cy);
  if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);
  if (el.flipX || el.flipY) ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
  ctx.globalAlpha = el.opacity ?? 1;

  if (el.shadow) {
    ctx.shadowColor   = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur    = 16 * scale;
    ctx.shadowOffsetX = 4 * scale;
    ctx.shadowOffsetY = 6 * scale;
  }

  const hw = (el.w / 2) * scale;
  const hh = (el.h / 2) * scale;

  switch (el.type) {
    case 'sticker': renderStickerEl(ctx, el, assets, scale, hw, hh); break;
    case 'text':    renderTextEl(ctx, el, scale, hw, hh);            break;
    case 'tape':    renderTapeEl(ctx, el, scale, hw, hh);            break;
  }

  ctx.restore();
}

function renderStickerEl(ctx, el, assets, scale, hw, hh) {
  const asset = assets.get(el.assetId);
  if (asset?.img) {
    ctx.drawImage(asset.img, -hw, -hh, hw * 2, hh * 2);
  } else {
    // Fallback placeholder
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
  }
}

function renderTextEl(ctx, el, scale, hw, hh) {
  const style = el.style || {};
  const fontSize = (style.fontSize || 96) * scale;
  const font = style.fontFamily || 'Caveat';

  ctx.fillStyle = style.color || '#1a1a1a';
  ctx.textAlign = style.align || 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${style.fontWeight || '600'} ${Math.round(fontSize)}px '${font}', cursive, sans-serif`;

  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${(style.letterSpacing || 0) * scale}px`;
  }

  const lines = (el.text || '').split('\n');
  const lineH = fontSize * (style.lineHeight || 1.2);
  const totalH = lines.length * lineH;
  let startY = -totalH / 2 + lineH / 2;

  for (const line of lines) {
    ctx.fillText(line, style.align === 'center' ? 0 : style.align === 'right' ? hw : -hw, startY);
    startY += lineH;
  }
}

function renderTapeEl(ctx, el, scale, hw, hh) {
  const style = el.style || {};
  ctx.fillStyle = style.color || 'rgba(220,210,180,0.75)';
  ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 0.5;
  for (let x = -hw; x < hw; x += 6 * scale) {
    ctx.beginPath(); ctx.moveTo(x, -hh); ctx.lineTo(x, hh); ctx.stroke();
  }
}

// ─── Grid overlay ─────────────────────────────────────────────────────────────
function renderGrid(ctx, frameDef, scale) {
  const ap = frameDef.apertures?.[0];
  if (!ap) return;

  ctx.save();
  ctx.strokeStyle = 'rgba(100, 140, 255, 0.12)';
  ctx.lineWidth = 0.5;

  const gridSize = 120 * scale;
  const ax = ap.x * scale, ay = ap.y * scale;
  const aw = ap.w * scale, ah = ap.h * scale;

  for (let x = ax; x <= ax + aw; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, ay); ctx.lineTo(x, ay + ah); ctx.stroke();
  }
  for (let y = ay; y <= ay + ah; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(ax + aw, y); ctx.stroke();
  }
  ctx.restore();
}

// ─── Noise texture ────────────────────────────────────────────────────────────
function addNoiseTexture(ctx, scale, alpha) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const step = Math.max(2, Math.round(2 * scale));
  ctx.save();
  ctx.globalAlpha = alpha;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const v = Math.random() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, step, step);
    }
  }
  ctx.restore();
}

// ─── Frame thumbnail renderer ─────────────────────────────────────────────────
/**
 * Render a quick frame thumbnail for the frame picker.
 * Reuses the full renderer with a minimal mock scene.
 */
export function renderFrameThumbnail(canvas, frameId) {
  const frameDef = getFrameById(frameId);
  if (!frameDef) return;

  const W = 180, H = 225;
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  const mockScene = {
    frame: { id: frameId },
    photos: [],
    elements: [],
    metadata: {
      brand: 'POCKET',
      device: frameDef.name.toUpperCase(),
      focalLength: '', aperture: '', shutter: '', iso: '', caption: ''
    },
    settings: {}
  };

  renderScene(ctx, mockScene, new Map(), {
    targetWidth: W, targetHeight: H,
    isExport: true,
    editorState: {}
  });
}
