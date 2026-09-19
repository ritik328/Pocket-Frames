/**
 * Pocket Frames V2 — Frame Definitions
 *
 * Declarative frame catalog. Each frame is a data definition; the shared
 * renderer reads these to produce pixel-perfect output at any resolution.
 *
 * Coordinate system: logical 2160 × 2700 (4:5 portrait master).
 *
 * Frame ≠ Layout. Frames define visual style (border, aperture style,
 * decorations). Layouts define how multiple frames are arranged. One frame
 * can be used with different layouts.
 */

export const LOGICAL_W = 2160;
export const LOGICAL_H = 2700;

/**
 * @typedef {Object} Aperture
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {'rect'|'rounded'} shape
 * @property {number} [radius]
 * @property {string} [emptyFill]  — background colour when no photo loaded
 */

/**
 * @typedef {Object} FrameDecoration
 * @property {'tape'|'heart'|'star'|'bow'|'corner-tab'|'sprocket'|'line'} type
 * @property {Object} [params]      — decoration-specific params
 */

/**
 * @typedef {Object} FrameDefinition
 * @property {string}   id
 * @property {string}   name
 * @property {string}   category    'classic'|'vintage'|'film'|'editorial'|'decorated'
 * @property {string}   background  CSS/hex colour for the frame body
 * @property {string}   borderColor outer hairline colour
 * @property {Aperture[]} apertures
 * @property {FrameDecoration[]} decorations
 * @property {object}   metadata    — text layout options
 * @property {object}   capabilities
 */

export const FRAME_CATALOG = [

  // ─── 1. Classic White ──────────────────────────────────────────────────────
  {
    id: 'classic-white',
    name: 'Classic White',
    category: 'classic',
    background: '#FFFFFF',
    borderColor: '#E0E0E0',
    apertures: [{
      x: 100, y: 340,
      w: 1960, h: 1720,
      shape: 'rect', radius: 0,
      emptyFill: '#F0F0F0'
    }],
    decorations: [],
    metadata: {
      visible: true,
      brandY: 230, brandColor: '#1A1A1A', brandSize: 42, brandStyle: 'italic',
      deviceY: 2280, deviceColor: '#111', deviceSize: 52,
      exif1Y: 2400, exif2Y: 2490, exifColor: '#555', exifSize: 36
    },
    capabilities: { photoCount: 1, metadata: true, decorations: true }
  },

  // ─── 2. Vintage Cream ─────────────────────────────────────────────────────
  {
    id: 'vintage-cream',
    name: 'Vintage Cream',
    category: 'vintage',
    background: '#F5EDD6',
    borderColor: '#C9B48C',
    apertures: [{
      x: 120, y: 380,
      w: 1920, h: 1680,
      shape: 'rect', radius: 0,
      emptyFill: '#EDE0C4'
    }],
    decorations: [
      { type: 'corner-tab', params: { corners: 'all', color: '#B8965A', size: 60 } },
      { type: 'line', params: { y: 2240, color: '#C9B48C', thickness: 2 } }
    ],
    metadata: {
      visible: true,
      brandY: 250, brandColor: '#5C4A28', brandSize: 40, brandStyle: 'italic',
      deviceY: 2300, deviceColor: '#3A2E1A', deviceSize: 48,
      exif1Y: 2410, exif2Y: 2500, exifColor: '#7A6440', exifSize: 34
    },
    capabilities: { photoCount: 1, metadata: true, decorations: true }
  },

  // ─── 3. Noir Black ────────────────────────────────────────────────────────
  {
    id: 'noir-black',
    name: 'Noir Black',
    category: 'classic',
    background: '#111111',
    borderColor: '#333333',
    apertures: [{
      x: 100, y: 340,
      w: 1960, h: 1720,
      shape: 'rect', radius: 0,
      emptyFill: '#1A1A1A'
    }],
    decorations: [
      { type: 'line', params: { y: 2240, color: '#333', thickness: 1 } }
    ],
    metadata: {
      visible: true,
      brandY: 230, brandColor: '#CCCCCC', brandSize: 42, brandStyle: 'italic',
      deviceY: 2280, deviceColor: '#FFFFFF', deviceSize: 52,
      exif1Y: 2400, exif2Y: 2490, exifColor: '#888888', exifSize: 36
    },
    capabilities: { photoCount: 1, metadata: true, decorations: true }
  },

  // ─── 4. Mini Polaroid ─────────────────────────────────────────────────────
  {
    id: 'mini',
    name: 'Mini',
    category: 'classic',
    background: '#FFFFFF',
    borderColor: '#E0E0E0',
    apertures: [{
      x: 200, y: 200,
      w: 1760, h: 1760,
      shape: 'rect', radius: 0,
      emptyFill: '#F5F5F5'
    }],
    decorations: [],
    metadata: {
      visible: true,
      brandY: 120, brandColor: '#AAAAAA', brandSize: 36, brandStyle: 'normal',
      deviceY: 2120, deviceColor: '#333', deviceSize: 56,
      exif1Y: 2240, exif2Y: 2340, exifColor: '#888', exifSize: 38,
      captionY: 2460, captionColor: '#444', captionSize: 52
    },
    capabilities: { photoCount: 1, metadata: true, decorations: true }
  },

  // ─── 5. Taped Memory ──────────────────────────────────────────────────────
  {
    id: 'taped-memory',
    name: 'Taped Memory',
    category: 'decorated',
    background: '#FAFAFA',
    borderColor: '#E8E8E8',
    apertures: [{
      x: 100, y: 340,
      w: 1960, h: 1720,
      shape: 'rect', radius: 0,
      emptyFill: '#F2F2F2'
    }],
    decorations: [
      { type: 'tape', params: { side: 'top-left',  angle: -35, x: 220, y: 240, w: 320, color: 'rgba(220,210,180,0.75)' } },
      { type: 'tape', params: { side: 'top-right', angle:  32, x: 1720, y: 190, w: 320, color: 'rgba(200,220,200,0.75)' } },
      { type: 'tape', params: { side: 'bottom-left', angle: -28, x: 160, y: 2340, w: 280, color: 'rgba(220,210,180,0.75)' } }
    ],
    metadata: {
      visible: true,
      brandY: 230, brandColor: '#888', brandSize: 40, brandStyle: 'italic',
      deviceY: 2280, deviceColor: '#333', deviceSize: 50,
      exif1Y: 2400, exif2Y: 2490, exifColor: '#666', exifSize: 34
    },
    capabilities: { photoCount: 1, metadata: true, decorations: true }
  },

  // ─── 6. Love Letter ────────────────────────────────────────────────────────
  {
    id: 'love-letter',
    name: 'Love Letter',
    category: 'decorated',
    background: '#5C1A1A',
    borderColor: '#3A0E0E',
    apertures: [{
      x: 140, y: 360,
      w: 1880, h: 1680,
      shape: 'rect', radius: 0,
      emptyFill: '#2A0A0A'
    }],
    decorations: [
      { type: 'heart', params: { x: 1080, y: 270,  size: 48, color: '#C45C5C' } },
      { type: 'heart', params: { x: 280,  y: 2520, size: 28, color: '#C45C5C' } },
      { type: 'heart', params: { x: 1880, y: 2490, size: 32, color: '#C45C5C' } },
      { type: 'bow',   params: { x: 1080, y: 130,  color: '#E8A0A0', size: 120 } },
      { type: 'envelope', params: { x: 1080, y: 2560, size: 140, color: '#F5EBE0', waxColor: '#C45C5C' } }
    ],
    metadata: {
      visible: false,
      brandY: 230, brandColor: '#C45C5C', brandSize: 40, brandStyle: 'italic',
      deviceY: 2280, deviceColor: '#FFE0E0', deviceSize: 50,
      exif1Y: 2400, exif2Y: 2490, exifColor: '#C49090', exifSize: 34
    },
    capabilities: { photoCount: 1, metadata: false, decorations: true }
  },

  // ─── 7. Photo Strip ───────────────────────────────────────────────────────
  {
    id: 'photo-strip',
    name: 'Photo Strip',
    category: 'film',
    background: '#FFFFFF',
    borderColor: '#DDDDDD',
    apertures: [
      { x: 100, y: 110,  w: 1960, h: 840, shape: 'rect', emptyFill: '#E8E8E8' },
      { x: 100, y: 990,  w: 1960, h: 840, shape: 'rect', emptyFill: '#E8E8E8' },
      { x: 100, y: 1870, w: 1960, h: 840, shape: 'rect', emptyFill: '#E8E8E8' }
    ],
    decorations: [],
    metadata: { visible: false },
    capabilities: { photoCount: 3, metadata: false, decorations: true }
  },

  // ─── 8. Editorial ────────────────────────────────────────────────────────
  {
    id: 'editorial',
    name: 'Editorial',
    category: 'editorial',
    background: '#FFFFFF',
    borderColor: '#000000',
    apertures: [{
      x: 80, y: 80,
      w: 2000, h: 2000,
      shape: 'rect', radius: 0,
      emptyFill: '#F8F8F8'
    }],
    decorations: [
      { type: 'line', params: { y: 2160, color: '#000', thickness: 3 } }
    ],
    metadata: {
      visible: true,
      brandY: 2240, brandColor: '#000', brandSize: 48, brandStyle: 'normal',
      deviceY: 2340, deviceColor: '#000', deviceSize: 44,
      exif1Y: 2450, exif2Y: 2540, exifColor: '#444', exifSize: 34,
      brandFont: "'Instrument Serif', Georgia, serif"
    },
    capabilities: { photoCount: 1, metadata: true, decorations: false }
  }
];

/**
 * Get frame definition by id
 * @param {string} id
 * @returns {FrameDefinition|undefined}
 */
export function getFrameById(id) {
  return FRAME_CATALOG.find(f => f.id === id);
}

/**
 * Get frames by category
 * @param {string} category
 */
export function getFramesByCategory(cat) {
  if (cat === 'all') return FRAME_CATALOG;
  return FRAME_CATALOG.filter(f => f.category === cat);
}

export const FRAME_CATEGORIES = [
  { id: 'all',       label: 'All' },
  { id: 'classic',   label: 'Classic' },
  { id: 'vintage',   label: 'Vintage' },
  { id: 'decorated', label: 'Decorated' },
  { id: 'film',      label: 'Film' },
  { id: 'editorial', label: 'Editorial' }
];
