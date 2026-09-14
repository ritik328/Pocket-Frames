/**
 * Pocket Frames - Mathematical Frame Geometry
 * All coordinates, baselines, and dimensions are strictly defined
 * in 2160 x 2700 export-space pixels (4:5 Instagram Master).
 */

export const MASTER_WIDTH = 2160;
export const MASTER_HEIGHT = 2700;

export const FRAME_GEOMETRY = {
  // Outer frame dimensions
  width: MASTER_WIDTH,
  height: MASTER_HEIGHT,
  aspectRatio: 4 / 5,

  // Photo aperture window
  aperture: {
    x: 100,
    y: 360,
    width: 1960,
    height: 1720,
    get centerX() { return this.x + this.width / 2; }, // 1080
    get centerY() { return this.y + this.height / 2; }  // 1220
  },

  // Top branding (HASSELBLAD)
  topBranding: {
    centerX: 1080,
    baselineY: 235,
    fontSize: 44,
    fontStyle: 'italic',
    fontWeight: '500',
    letterSpacing: 0.32, // em
    color: '#1A1A1A'
  },

  // Bottom device name (e.g. OPPO Find X9)
  deviceName: {
    centerX: 1080,
    baselineY: 2270,
    fontSize: 54,
    fontWeight: '600',
    letterSpacing: 0.08, // em
    color: '#111111'
  },

  // EXIF line 1 (FL ... Aperture ...)
  exifLine1: {
    centerX: 1080,
    baselineY: 2380,
    fontSize: 38,
    fontWeight: '400',
    letterSpacing: 0.06, // em
    color: '#4A4A4A'
  },

  // EXIF line 2 (Shutter ... ISO ...)
  exifLine2: {
    centerX: 1080,
    baselineY: 2470,
    fontSize: 38,
    fontWeight: '400',
    letterSpacing: 0.06, // em
    color: '#4A4A4A'
  },

  // Alignment tolerances in canonical export space
  alignmentTolerance: 14, // px in 2160x2700 space
  snapThreshold: 18        // px in 2160x2700 space
};

/**
 * Get scaled geometry for preview viewport
 * @param {number} viewportWidth - Current preview canvas display width
 */
export function getScaledGeometry(viewportWidth) {
  const scale = viewportWidth / MASTER_WIDTH;
  const g = FRAME_GEOMETRY;

  return {
    scale,
    width: viewportWidth,
    height: MASTER_HEIGHT * scale,
    aperture: {
      x: g.aperture.x * scale,
      y: g.aperture.y * scale,
      width: g.aperture.width * scale,
      height: g.aperture.height * scale,
      centerX: g.aperture.centerX * scale,
      centerY: g.aperture.centerY * scale
    },
    topBranding: {
      ...g.topBranding,
      centerX: g.topBranding.centerX * scale,
      baselineY: g.topBranding.baselineY * scale,
      fontSize: g.topBranding.fontSize * scale
    },
    deviceName: {
      ...g.deviceName,
      centerX: g.deviceName.centerX * scale,
      baselineY: g.deviceName.baselineY * scale,
      fontSize: g.deviceName.fontSize * scale
    },
    exifLine1: {
      ...g.exifLine1,
      centerX: g.exifLine1.centerX * scale,
      baselineY: g.exifLine1.baselineY * scale,
      fontSize: g.exifLine1.fontSize * scale
    },
    exifLine2: {
      ...g.exifLine2,
      centerX: g.exifLine2.centerX * scale,
      baselineY: g.exifLine2.baselineY * scale,
      fontSize: g.exifLine2.fontSize * scale
    },
    alignmentTolerance: g.alignmentTolerance * scale,
    snapThreshold: g.snapThreshold * scale
  };
}
