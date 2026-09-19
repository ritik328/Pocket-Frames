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

  // 5. Metadata text block (only if enabled by frame)
  if (frameDef.capabilities?.metadata === true || (frameDef.metadata && frameDef.metadata.visible !== false)) {
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

  // 1. Base Fill or Gradient
  if (frameDef.pattern === 'citrus-gradient') {
    const grad = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    grad.addColorStop(0, '#FFF7ED');
    grad.addColorStop(0.45, '#FDE5BE');
    grad.addColorStop(1, '#F6C9A3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  } else {
    ctx.fillStyle = frameDef.background || '#FFFFFF';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // 2. Pattern Variations
  switch (frameDef.pattern) {
    case 'ticket-stub':
      renderTicketStubPattern(ctx, frameDef, scale);
      break;
    case 'dots':
    case 'dots-dense':
      renderDotsPattern(ctx, frameDef, scale);
      break;
    case 'gingham':
      renderGinghamPattern(ctx, frameDef, scale);
      break;
    case 'weave':
      renderWeavePattern(ctx, frameDef, scale);
      break;
    case 'grid':
      renderGridPattern(ctx, frameDef, scale);
      break;
    case 'playing-card':
      renderPlayingCardPattern(ctx, frameDef, scale);
      break;
    case 'camera-cutout':
      renderCameraCutoutPattern(ctx, frameDef, scale);
      break;
    case 'sprockets':
      renderFilmSprocketsPattern(ctx, frameDef, scale);
      break;
    case 'digicam':
      renderDigicamPattern(ctx, frameDef, scale);
      break;
    case 'editor-toolbar':
      renderEditorToolbarPattern(ctx, frameDef, scale);
      break;
  }

  // 3. Inner Card Layer (if specified in frame definition)
  if (frameDef.innerFrame) {
    renderInnerFrame(ctx, frameDef.innerFrame, scale);
  }

  // Paper texture noise for vintage styles
  if (frameDef.id === 'vintage-lace' || frameDef.id === 'postcard' || frameDef.id === 'ticket-stub') {
    addNoiseTexture(ctx, scale, 0.025);
  }

  ctx.restore();
}

function renderTicketStubPattern(ctx, frameDef, scale) {
  const cx = ctx.canvas.width / 2;
  const nr = 60 * scale;

  // Notch cutouts at top and bottom center
  ctx.fillStyle = '#E9E2D2';
  ctx.beginPath(); ctx.arc(cx, 0, nr, 0, Math.PI); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, ctx.canvas.height, nr, Math.PI, 0); ctx.fill();

  // Subtle perforation dashed line across bottom section
  ctx.strokeStyle = 'rgba(244,227,200,0.22)';
  ctx.lineWidth = 2 * scale;
  ctx.setLineDash([8 * scale, 8 * scale]);
  ctx.beginPath();
  ctx.moveTo(80 * scale, 2300 * scale);
  ctx.lineTo(ctx.canvas.width - 80 * scale, 2300 * scale);
  ctx.stroke();
  ctx.setLineDash([]);

  // Barcode in bottom left
  const bx = 160 * scale, by = 2360 * scale, bw = 460 * scale, bh = 140 * scale;
  ctx.fillStyle = '#F4E3C8';
  const bars = [3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 4, 2, 1, 2, 3, 1, 4, 2, 2, 1, 3, 1, 2, 4, 1];
  let curX = bx;
  for (let i = 0; i < bars.length; i++) {
    const w = bars[i] * 3.2 * scale;
    if (i % 2 === 0) {
      ctx.fillRect(curX, by, w, bh);
    }
    curX += w + 2.5 * scale;
    if (curX > bx + bw) break;
  }
}

function renderDotsPattern(ctx, frameDef, scale) {
  const isDense = frameDef.pattern === 'dots-dense';
  const step = (isDense ? 48 : 80) * scale;
  const rad  = (isDense ? 3 : 5) * scale;
  ctx.fillStyle = frameDef.patColor || 'rgba(0,0,0,0.08)';
  for (let y = step / 2; y < ctx.canvas.height; y += step) {
    for (let x = step / 2; x < ctx.canvas.width; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function renderGinghamPattern(ctx, frameDef, scale) {
  const gStep = 64 * scale;
  ctx.fillStyle = frameDef.patColor || 'rgba(230,170,180,0.3)';
  for (let x = 0; x < ctx.canvas.width; x += gStep * 2) {
    ctx.fillRect(x, 0, gStep, ctx.canvas.height);
  }
  for (let y = 0; y < ctx.canvas.height; y += gStep * 2) {
    ctx.fillRect(0, y, ctx.canvas.width, gStep);
  }
}

function renderWeavePattern(ctx, frameDef, scale) {
  ctx.strokeStyle = frameDef.patColor || 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1 * scale;
  const wStep = 24 * scale;
  for (let x = 0; x < ctx.canvas.width; x += wStep) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ctx.canvas.height); ctx.stroke();
  }
  for (let y = 0; y < ctx.canvas.height; y += wStep) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ctx.canvas.width, y); ctx.stroke();
  }
}

function renderGridPattern(ctx, frameDef, scale) {
  ctx.strokeStyle = frameDef.patColor || 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1 * scale;
  const gSize = 60 * scale;
  for (let x = 0; x < ctx.canvas.width; x += gSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ctx.canvas.height); ctx.stroke();
  }
  for (let y = 0; y < ctx.canvas.height; y += gSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ctx.canvas.width, y); ctx.stroke();
  }
}

function renderPlayingCardPattern(ctx, frameDef, scale) {
  const bw = 90 * scale;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, ctx.canvas.width, bw);
  ctx.fillRect(0, ctx.canvas.height - bw, ctx.canvas.width, bw);
  ctx.fillRect(0, 0, bw, ctx.canvas.height);
  ctx.fillRect(ctx.canvas.width - bw, 0, bw, ctx.canvas.height);

  // Red diagonal stripes in borders
  ctx.strokeStyle = '#B3273A';
  ctx.lineWidth = 14 * scale;
  for (let x = -ctx.canvas.height; x < ctx.canvas.width + ctx.canvas.height; x += 36 * scale) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + ctx.canvas.height, ctx.canvas.height);
    ctx.stroke();
  }
  ctx.restore();
}

function renderCameraCutoutPattern(ctx, frameDef, scale) {
  ctx.save();
  // Flash unit at top left
  const fx = 240 * scale, fy = 180 * scale, fw = 280 * scale, fh = 140 * scale;
  ctx.fillStyle = '#5A0F0F';
  ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, 12 * scale); ctx.fill();
  ctx.fillStyle = '#E6A83A';
  ctx.beginPath(); ctx.roundRect(fx + 20 * scale, fy + 20 * scale, fw - 40 * scale, fh - 40 * scale, 6 * scale); ctx.fill();

  // Camera lens assembly in center
  const lcx = ctx.canvas.width / 2, lcy = 280 * scale;
  ctx.fillStyle = '#4A0D0D';
  ctx.beginPath(); ctx.arc(lcx, lcy, 180 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#260606';
  ctx.beginPath(); ctx.arc(lcx, lcy, 130 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#110202';
  ctx.beginPath(); ctx.arc(lcx, lcy, 80 * scale, 0, Math.PI * 2); ctx.fill();
  // Blue/violet optical reflection arc
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
  ctx.lineWidth = 6 * scale;
  ctx.beginPath(); ctx.arc(lcx, lcy, 100 * scale, -Math.PI * 0.7, -Math.PI * 0.2); ctx.stroke();

  // Optical viewfinder at top right
  const vx = ctx.canvas.width - 240 * scale - fw, vy = 180 * scale;
  ctx.fillStyle = '#5A0F0F';
  ctx.beginPath(); ctx.roundRect(vx, vy, fw, fh, 12 * scale); ctx.fill();
  ctx.fillStyle = '#110202';
  ctx.beginPath(); ctx.roundRect(vx + 16 * scale, vy + 16 * scale, fw - 32 * scale, fh - 32 * scale, 6 * scale); ctx.fill();
  ctx.restore();
}

function renderFilmSprocketsPattern(ctx, frameDef, scale) {
  const sw = 80 * scale;
  const sh = 110 * scale;
  const sr = 18 * scale;
  const leftX = 70 * scale;
  const rightX = ctx.canvas.width - 70 * scale - sw;
  const step = 170 * scale;

  ctx.fillStyle = '#080808';
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1.5 * scale;

  let frameNum = 24;
  for (let y = 80 * scale; y < ctx.canvas.height - 100 * scale; y += step) {
    // Left sprocket
    ctx.beginPath();
    ctx.roundRect(leftX, y, sw, sh, sr);
    ctx.fill(); ctx.stroke();

    // Right sprocket
    ctx.beginPath();
    ctx.roundRect(rightX, y, sw, sh, sr);
    ctx.fill(); ctx.stroke();

    // Film edge markings in amber mono
    ctx.save();
    ctx.fillStyle = '#E8A83A';
    ctx.font = `600 ${Math.round(24 * scale)}px ${FONTS.mono}`;
    ctx.fillText(`${frameNum}A`, leftX + sw + 16 * scale, y + sh * 0.7);
    ctx.fillText(`KODAK 400`, rightX - 140 * scale, y + sh * 0.7);
    ctx.restore();
    frameNum++;
  }
}

function renderDigicamPattern(ctx, frameDef, scale) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `600 ${Math.round(36 * scale)}px ${FONTS.mono}`;

  // Rec dot
  ctx.fillStyle = '#FF3333';
  ctx.beginPath(); ctx.arc(100 * scale, 120 * scale, 12 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('REC', 130 * scale, 132 * scale);
  ctx.fillText('00:04:18', 250 * scale, 132 * scale);

  // Battery icon top right
  const bx = ctx.canvas.width - 240 * scale, by = 100 * scale;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3 * scale;
  ctx.strokeRect(bx, by, 70 * scale, 34 * scale);
  ctx.fillRect(bx + 72 * scale, by + 10 * scale, 6 * scale, 14 * scale);
  ctx.fillStyle = '#44FF44';
  ctx.fillRect(bx + 6 * scale, by + 6 * scale, 58 * scale, 22 * scale);

  // Bottom OSD
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('ISO 400   F2.8   1/125', 100 * scale, ctx.canvas.height - 100 * scale);
  ctx.fillText('[ 4:3 ]   RAW', ctx.canvas.width - 340 * scale, ctx.canvas.height - 100 * scale);
  ctx.restore();
}

function renderEditorToolbarPattern(ctx, frameDef, scale) {
  const pw = 300 * scale;
  ctx.fillStyle = '#EDE8DE';
  ctx.fillRect(0, 0, pw, ctx.canvas.height);
  ctx.strokeStyle = '#D5CEBF';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath(); ctx.moveTo(pw, 0); ctx.lineTo(pw, ctx.canvas.height); ctx.stroke();

  // Classic window dots
  ctx.fillStyle = '#FF5F56'; ctx.beginPath(); ctx.arc(40 * scale, 50 * scale, 10 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFBD2E'; ctx.beginPath(); ctx.arc(75 * scale, 50 * scale, 10 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#27C93F'; ctx.beginPath(); ctx.arc(110 * scale, 50 * scale, 10 * scale, 0, Math.PI * 2); ctx.fill();

  // Tool buttons
  const tools = ['↖', '▢', 'T', '✎', '⌕', '✂'];
  let ty = 110 * scale;
  for (const t of tools) {
    ctx.fillStyle = '#FAF7F0';
    ctx.fillRect(36 * scale, ty, 100 * scale, 100 * scale);
    ctx.strokeStyle = '#D0C7B6';
    ctx.strokeRect(36 * scale, ty, 100 * scale, 100 * scale);
    ctx.fillStyle = '#2A2A2A';
    ctx.font = `600 ${Math.round(44 * scale)}px ${FONTS.sans}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, 86 * scale, ty + 50 * scale);
    ty += 125 * scale;
  }
}

function renderInnerFrame(ctx, inf, scale) {
  ctx.save();
  if (inf.rotation) {
    const cx = (inf.x + inf.w / 2) * scale;
    const cy = (inf.y + inf.h / 2) * scale;
    ctx.translate(cx, cy);
    ctx.rotate((inf.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 24 * scale;
  ctx.shadowOffsetY = 8 * scale;
  ctx.fillStyle = inf.color || '#FFFFFF';
  ctx.beginPath();
  if (inf.radius) {
    ctx.roundRect(inf.x * scale, inf.y * scale, inf.w * scale, inf.h * scale, inf.radius * scale);
  } else {
    ctx.rect(inf.x * scale, inf.y * scale, inf.w * scale, inf.h * scale);
  }
  ctx.fill();
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
    case 'sticker':     renderStickerEl(ctx, el, assets, scale, hw, hh); break;
    case 'text':        renderTextEl(ctx, el, scale, hw, hh);            break;
    case 'tape':        renderTapeEl(ctx, el, scale, hw, hh);            break;
    case 'badge':       renderBadgeEl(ctx, el, scale, hw, hh);           break;
    case 'tag':         renderTagEl(ctx, el, scale, hw, hh);             break;
    case 'bow':         renderBowEl(ctx, el, scale, hw, hh);             break;
    case 'envelope':    renderEnvelopeEl(ctx, el, scale, hw, hh);        break;
    case 'clip':        renderClipEl(ctx, el, scale, hw, hh);            break;
    case 'seal':        renderSealEl(ctx, el, scale, hw, hh);            break;
    case 'stamp':       renderStampEl(ctx, el, scale, hw, hh);           break;
    case 'button-deco': renderButtonEl(ctx, el, scale, hw, hh);          break;
    case 'club-suit':   renderClubSuitEl(ctx, el, scale, hw, hh);        break;
    case 'controls':    renderControlsEl(ctx, el, scale, hw, hh);        break;
    case 'crosshair':   renderCrosshairEl(ctx, el, scale, hw, hh);       break;
    case 'vinyl':       renderVinylEl(ctx, el, scale, hw, hh);           break;
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
  ctx.font = `${style.fontStyle || ''} ${style.fontWeight || '600'} ${Math.round(fontSize)}px '${font}', cursive, sans-serif`.trim();

  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${(style.letterSpacing || 0) * scale}px`;
  }

  const lines = (el.text || '').split('\n');
  const lineH = fontSize * (style.lineHeight || 1.2);
  const totalH = lines.length * lineH;
  let startY = -totalH / 2 + lineH / 2;

  for (const line of lines) {
    const xPos = style.align === 'center' ? 0 : style.align === 'right' ? hw : -hw;
    ctx.fillText(line, xPos, startY);
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

function renderBadgeEl(ctx, el, scale, hw, hh) {
  ctx.fillStyle = el.bg || '#B3273A';
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, hw * 2, hh * 2, Math.min(hw, hh));
  ctx.fill();

  if (el.borderColor) {
    ctx.strokeStyle = el.borderColor;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
  }

  ctx.fillStyle = el.textColor || '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(hh * 0.95)}px ${FONTS.sans}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${3 * scale}px`;
  ctx.fillText((el.text || '').toUpperCase(), 0, 0);
}

function renderTagEl(ctx, el, scale, hw, hh) {
  if (el.bg) {
    ctx.fillStyle = el.bg;
    ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
  }
  if (el.borderColor) {
    ctx.strokeStyle = el.borderColor;
    ctx.lineWidth = 1.5 * scale;
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
  }

  ctx.fillStyle = el.color || '#333333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fSize = (el.fontSize || 48) * scale;
  const font = el.font === 'Caveat' ? FONTS.hand : FONTS.sans;
  ctx.font = `600 ${Math.round(fSize)}px ${font}`;

  if (el.vertical) {
    const chars = (el.text || '').split('');
    const chH = fSize * 1.05;
    let sy = -((chars.length - 1) * chH) / 2;
    for (const c of chars) {
      ctx.fillText(c, 0, sy);
      sy += chH;
    }
  } else {
    ctx.fillText(el.text || '', 0, 0);
  }
}

function renderBowEl(ctx, el, scale, hw, hh) {
  ctx.fillStyle = el.color || '#B3273A';
  ctx.strokeStyle = el.knotColor || '#7A1C26';
  ctx.lineWidth = 2 * scale;

  // Left loop
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-hw * 0.9, -hh * 0.9, -hw, hh * 0.1, -hw * 0.4, hh * 0.3);
  ctx.bezierCurveTo(-hw * 0.6, hh * 0.8, -hw * 0.2, hh * 0.6, 0, 0);
  ctx.fill(); ctx.stroke();

  // Right loop
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(hw * 0.9, -hh * 0.9, hw, hh * 0.1, hw * 0.4, hh * 0.3);
  ctx.bezierCurveTo(hw * 0.6, hh * 0.8, hw * 0.2, hh * 0.6, 0, 0);
  ctx.fill(); ctx.stroke();

  // Center knot
  ctx.fillStyle = el.knotColor || '#7A1C26';
  ctx.beginPath();
  ctx.ellipse(0, 0, hw * 0.22, hh * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}

function renderEnvelopeEl(ctx, el, scale, hw, hh) {
  ctx.fillStyle = el.color || '#F4E9D8';
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 2 * scale;
  ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
  ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);

  // Top triangular fold lines
  ctx.beginPath();
  ctx.moveTo(-hw, -hh);
  ctx.lineTo(0, hh * 0.2);
  ctx.lineTo(hw, -hh);
  ctx.stroke();

  // Wax seal on envelope
  ctx.fillStyle = el.waxColor || '#B3273A';
  ctx.beginPath();
  ctx.arc(0, hh * 0.2, Math.min(hw, hh) * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function renderClipEl(ctx, el, scale, hw, hh) {
  ctx.strokeStyle = el.color || '#C9A24A';
  ctx.lineWidth = 5 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-hw * 0.35, hh * 0.8);
  ctx.lineTo(-hw * 0.35, -hh * 0.6);
  ctx.arc(0, -hh * 0.6, hw * 0.35, Math.PI, 0);
  ctx.lineTo(hw * 0.35, hh * 0.5);
  ctx.arc(hw * 0.12, hh * 0.5, hw * 0.23, 0, Math.PI);
  ctx.lineTo(-hw * 0.1, -hh * 0.3);
  ctx.stroke();
}

function renderSealEl(ctx, el, scale, hw, hh) {
  const r = Math.min(hw, hh);
  ctx.fillStyle = el.color || '#8F1D1D';
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const ang = (i * Math.PI * 2) / 24;
    const curR = r * (i % 2 === 0 ? 1 : 0.88);
    const px = Math.cos(ang) * curR;
    const py = Math.sin(ang) * curR;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Inner ring
  ctx.fillStyle = el.innerColor || '#B3273A';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2); ctx.fill();

  // Star emblem
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${Math.round(r * 0.55)}px ${FONTS.serif}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('★', 0, 0);
}

function renderStampEl(ctx, el, scale, hw, hh) {
  ctx.fillStyle = el.bg || '#F4E9D8';
  ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
  ctx.strokeStyle = el.borderColor || '#B98A55';
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeRect(-hw + 6 * scale, -hh + 6 * scale, (hw - 6 * scale) * 2, (hh - 6 * scale) * 2);

  // Perforation dots
  ctx.fillStyle = '#0D0D0E';
  const nr = 4 * scale;
  for (let x = -hw + nr * 3; x < hw - nr * 2; x += nr * 4) {
    ctx.beginPath(); ctx.arc(x, -hh, nr, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, hh, nr, 0, Math.PI * 2); ctx.fill();
  }
  for (let y = -hh + nr * 3; y < hh - nr * 2; y += nr * 4) {
    ctx.beginPath(); ctx.arc(-hw, y, nr, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hw, y, nr, 0, Math.PI * 2); ctx.fill();
  }

  // Wavy cancellation line
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.arc(-hw * 0.2, 0, hw * 0.5, 0, Math.PI * 2);
  ctx.stroke();
}

function renderButtonEl(ctx, el, scale, hw, hh) {
  const r = Math.min(hw, hh);
  ctx.fillStyle = el.color || '#E6AAB4';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.stroke();

  const hr = r * 0.12;
  const d = r * 0.35;
  ctx.fillStyle = '#4A2A2E';
  const holes = [[-d, -d], [d, -d], [-d, d], [d, d]];
  for (const [hx, hy] of holes) {
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath(); ctx.moveTo(-d, -d); ctx.lineTo(d, d); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(d, -d); ctx.lineTo(-d, d); ctx.stroke();
}

function renderClubSuitEl(ctx, el, scale, hw, hh) {
  const s = Math.min(hw, hh);
  ctx.fillStyle = el.color || '#B3273A';

  const r = s * 0.36;
  ctx.beginPath(); ctx.arc(0, -s * 0.28, r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-s * 0.32, s * 0.15, r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.32, s * 0.15, r, 0, Math.PI * 2); ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-s * 0.12, s * 0.2);
  ctx.lineTo(-s * 0.25, s * 0.8);
  ctx.lineTo(s * 0.25, s * 0.8);
  ctx.lineTo(s * 0.12, s * 0.2);
  ctx.closePath();
  ctx.fill();
}

function renderControlsEl(ctx, el, scale, hw, hh) {
  const r = Math.min(hw, hh);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.strokeStyle = el.color || 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  ctx.fillStyle = el.color || 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = el.color || 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${Math.round(r * 0.3)}px ${FONTS.sans}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('▲', 0, -r * 0.65);
  ctx.fillText('▼', 0, r * 0.65);
  ctx.fillText('◀', -r * 0.65, 0);
  ctx.fillText('▶', r * 0.65, 0);
}

function renderCrosshairEl(ctx, el, scale, hw, hh) {
  const s = Math.min(hw, hh);
  ctx.strokeStyle = el.color || '#181818';
  ctx.lineWidth = 2 * scale;

  // Center cross
  ctx.beginPath(); ctx.moveTo(-s * 0.35, 0); ctx.lineTo(s * 0.35, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -s * 0.35); ctx.lineTo(0, s * 0.35); ctx.stroke();

  // Corner brackets
  const b = s * 0.75;
  const len = s * 0.22;
  ctx.beginPath(); ctx.moveTo(-b, -b + len); ctx.lineTo(-b, -b); ctx.lineTo(-b + len, -b); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(b - len, -b); ctx.lineTo(b, -b); ctx.lineTo(b, -b + len); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-b, b - len); ctx.lineTo(-b, b); ctx.lineTo(-b + len, b); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(b - len, b); ctx.lineTo(b, b); ctx.lineTo(b, b - len); ctx.stroke();
}

function renderVinylEl(ctx, el, scale, hw, hh) {
  const r = Math.min(hw, hh);
  ctx.fillStyle = '#111111';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

  // Grooves
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1 * scale;
  for (let gr = r * 0.45; gr < r * 0.95; gr += 8 * scale) {
    ctx.beginPath(); ctx.arc(0, 0, gr, 0, Math.PI * 2); ctx.stroke();
  }

  // Label
  ctx.fillStyle = '#E8A83A';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();

  // Center hole
  ctx.fillStyle = '#1C1C1C';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.08, 0, Math.PI * 2); ctx.fill();
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
    elements: (frameDef.defaultElements || []).map((el, idx) => ({
      ...JSON.parse(JSON.stringify(el)),
      id: `thumb-el-${idx}`,
      zIndex: idx + 1,
      visible: true
    })),
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
