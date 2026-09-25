/**
 * Pocket Frames - Adobe .CUBE 3D & 1D LUT Parser
 * Supports standard DaVinci Resolve / Adobe / Hasselblad .cube format
 */

export class CubeLut {
  constructor(options = {}) {
    this.id = options.id || `lut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.title = options.title || 'Custom LUT';
    this.filename = options.filename || 'custom.cube';
    this.type = options.type || '3D'; // '3D' or '1D'
    this.size = options.size || 0;
    this.domainMin = options.domainMin || [0.0, 0.0, 0.0];
    this.domainMax = options.domainMax || [1.0, 1.0, 1.0];
    this.rgbData = options.rgbData; // Float32Array of RGB
    this.rgbaData = options.rgbaData; // Float32Array of RGBA for WebGL
    this.uint8Rgba = options.uint8Rgba; // Uint8Array for universal WebGL texture upload
    this.totalPoints = options.totalPoints || 0;
    this.rawText = options.rawText || '';
    this.isBuiltin = Boolean(options.isBuiltin);
    this.createdAt = options.createdAt || Date.now();
  }
}

/**
 * Parses raw .cube file text into structured CubeLut object
 * @param {string} cubeText - Raw text content of .cube file
 * @param {string} filename - Original filename
 * @returns {CubeLut}
 */
export function parseCubeLut(cubeText, filename = 'custom.cube') {
  if (typeof cubeText !== 'string' || !cubeText.trim()) {
    throw new Error('Empty or invalid .cube file content.');
  }

  const lines = cubeText.split(/\r?\n/);
  let title = filename.replace(/\.cube$/i, '').replace(/[-_]/g, ' ');
  let type = '3D';
  let size = 0;
  let domainMin = [0.0, 0.0, 0.0];
  let domainMax = [1.0, 1.0, 1.0];
  const points = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Remove comments
    const commentIdx = rawLine.indexOf('#');
    const line = (commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine).trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    const keyword = parts[0].toUpperCase();

    if (keyword === 'TITLE') {
      const match = line.match(/TITLE\s+["']?([^"']+)["']?/i);
      if (match && match[1]) {
        title = match[1].trim();
      }
    } else if (keyword === 'LUT_3D_SIZE') {
      type = '3D';
      size = parseInt(parts[1], 10);
    } else if (keyword === 'LUT_1D_SIZE') {
      type = '1D';
      size = parseInt(parts[1], 10);
    } else if (keyword === 'DOMAIN_MIN') {
      domainMin = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
    } else if (keyword === 'DOMAIN_MAX') {
      domainMax = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
    } else {
      // Must be numeric RGB line
      if (parts.length >= 3) {
        const r = parseFloat(parts[0]);
        const g = parseFloat(parts[1]);
        const b = parseFloat(parts[2]);
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
          points.push(r, g, b);
        }
      }
    }
  }

  // If size not explicitly specified in header, infer it
  const numPoints = Math.floor(points.length / 3);
  if (size <= 0) {
    if (type === '3D') {
      const cubeRoot = Math.round(Math.cbrt(numPoints));
      if (cubeRoot * cubeRoot * cubeRoot === numPoints && cubeRoot >= 2) {
        size = cubeRoot;
      } else {
        throw new Error(`Invalid 3D LUT: Contains ${numPoints} points, not a valid cubic dimension (N³).`);
      }
    } else {
      size = numPoints;
    }
  }

  const expectedPoints = type === '3D' ? size * size * size : size;
  if (numPoints < expectedPoints) {
    throw new Error(`Incomplete .cube file: Expected ${expectedPoints} points (${size}³), but only found ${numPoints}.`);
  }

  // Domain normalization ranges
  const rangeR = (domainMax[0] - domainMin[0]) || 1.0;
  const rangeG = (domainMax[1] - domainMin[1]) || 1.0;
  const rangeB = (domainMax[2] - domainMin[2]) || 1.0;
  const minR = domainMin[0];
  const minG = domainMin[1];
  const minB = domainMin[2];

  // Allocate typed arrays
  const rgbData = new Float32Array(expectedPoints * 3);
  const rgbaData = new Float32Array(expectedPoints * 4);
  const uint8Rgba = new Uint8Array(expectedPoints * 4);

  for (let i = 0; i < expectedPoints; i++) {
    const src = i * 3;
    const r = Math.min(1.0, Math.max(0.0, (points[src] - minR) / rangeR));
    const g = Math.min(1.0, Math.max(0.0, (points[src + 1] - minG) / rangeG));
    const b = Math.min(1.0, Math.max(0.0, (points[src + 2] - minB) / rangeB));

    rgbData[src] = r;
    rgbData[src + 1] = g;
    rgbData[src + 2] = b;

    const dst4 = i * 4;
    rgbaData[dst4] = r;
    rgbaData[dst4 + 1] = g;
    rgbaData[dst4 + 2] = b;
    rgbaData[dst4 + 3] = 1.0;

    uint8Rgba[dst4] = Math.round(r * 255);
    uint8Rgba[dst4 + 1] = Math.round(g * 255);
    uint8Rgba[dst4 + 2] = Math.round(b * 255);
    uint8Rgba[dst4 + 3] = 255;
  }

  return new CubeLut({
    title,
    filename,
    type,
    size,
    domainMin,
    domainMax,
    rgbData,
    rgbaData,
    uint8Rgba,
    totalPoints: expectedPoints,
    rawText: cubeText
  });
}

/**
 * Serialize a CubeLut back to standard .cube string for download/export
 */
export function exportCubeLutToString(lut) {
  const lines = [
    `# Pocket Frames Hasselblad Color Lab Export`,
    `TITLE "${lut.title}"`,
    `LUT_3D_SIZE ${lut.size}`,
    `DOMAIN_MIN 0.0 0.0 0.0`,
    `DOMAIN_MAX 1.0 1.0 1.0`
  ];

  const rgb = lut.rgbData;
  const count = lut.totalPoints;
  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const r = rgb[idx].toFixed(6);
    const g = rgb[idx + 1].toFixed(6);
    const b = rgb[idx + 2].toFixed(6);
    lines.push(`${r} ${g} ${b}`);
  }

  return lines.join('\n');
}
