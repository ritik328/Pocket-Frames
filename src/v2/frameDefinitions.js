/**
 * Pocket Frames V2 — Frame Definitions
 * 
 * 17 Original Frame Templates from reference specifications:
 * 1. Plain strip
 * 2. Ticket stub
 * 3. Love notes
 * 4. Vintage lace
 * 5. Coastal ring
 * 6. Camera cutout
 * 7. Playing card
 * 8. Love scribble
 * 9. Digital camera
 * 10. Citrus collage
 * 11. Handwritten caption
 * 12. Retro phone collage
 * 13. Postcard
 * 14. Story of love
 * 15. Camera screen
 * 16. Editor toolbar
 * 17. Film roll
 *
 * Coordinate system: logical 2160 × 2700 (4:5 master portrait).
 * Each frame defines apertures, background patterns, and default editable elements.
 */

export const LOGICAL_W = 2160;
export const LOGICAL_H = 2700;

export const FRAME_CATEGORIES = [
  { id: 'all',       label: 'All (17)' },
  { id: 'strip',     label: 'Photo Strip' },
  { id: 'editorial', label: 'Editorial & Vintage' },
  { id: 'playful',   label: 'Playful & Cute' },
  { id: 'camera',    label: 'Camera & Tech' }
];

export const FRAME_CATALOG = [

  // ─── 1. Plain strip ────────────────────────────────────────────────────────
  {
    id: 'plain-strip',
    name: 'Plain strip',
    category: 'strip',
    background: '#FAF7F2',
    borderColor: '#E3DDD2',
    pattern: 'none',
    apertures: [
      { x: 180, y: 160,  w: 1800, h: 740, shape: 'rect', emptyFill: '#ECE6DC' },
      { x: 180, y: 980,  w: 1800, h: 740, shape: 'rect', emptyFill: '#ECE6DC' },
      { x: 180, y: 1800, w: 1800, h: 740, shape: 'rect', emptyFill: '#ECE6DC' }
    ],
    defaultElements: [],
    capabilities: { photoCount: 3, metadata: false }
  },

  // ─── 2. Ticket stub ────────────────────────────────────────────────────────
  {
    id: 'ticket-stub',
    name: 'Ticket stub',
    category: 'editorial',
    background: '#5A1620',
    borderColor: '#3D0D14',
    pattern: 'ticket-stub',
    apertures: [
      { x: 160, y: 520, w: 1840, h: 1470, shape: 'rect', emptyFill: '#420E15' }
    ],
    defaultElements: [
      {
        id: 'el-ticket-header',
        type: 'text',
        text: 'Evening session',
        x: 180, y: 220, w: 1800, h: 180,
        style: { fontFamily: 'Caveat', fontSize: 130, color: '#F4E3C8', fontStyle: 'italic', align: 'center', letterSpacing: 3 }
      },
      {
        id: 'el-ticket-date',
        type: 'text',
        text: '19 · 09 · 2026',
        x: 1060, y: 2420, w: 900, h: 90,
        style: { fontFamily: 'JetBrains Mono', fontSize: 50, color: '#E6C9A4', align: 'right', letterSpacing: 4 }
      }
    ],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 3. Love notes ─────────────────────────────────────────────────────────
  {
    id: 'love-notes',
    name: 'Love notes',
    category: 'playful',
    background: '#F4E9DF',
    borderColor: '#E2D0C2',
    pattern: 'dots',
    patColor: '#E8B9BE',
    apertures: [
      { x: 260, y: 500, w: 1640, h: 1640, shape: 'rect', emptyFill: '#380E13' }
    ],
    innerFrame: { x: 200, y: 440, w: 1760, h: 1760, color: '#6A1C22', radius: 12 },
    defaultElements: [
      {
        id: 'el-love-bow',
        type: 'bow',
        x: 930, y: 150, w: 300, h: 210,
        color: '#B3273A', knotColor: '#7A1C26'
      },
      {
        id: 'el-love-envelope',
        type: 'envelope',
        x: 940, y: 2360, w: 280, h: 180,
        color: '#F4E9D8', waxColor: '#B3273A'
      }
    ],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 4. Vintage lace ───────────────────────────────────────────────────────
  {
    id: 'vintage-lace',
    name: 'Vintage lace',
    category: 'editorial',
    background: '#26303C',
    borderColor: '#1D252E',
    pattern: 'weave',
    patColor: '#2C3542',
    apertures: [
      { x: 240, y: 340, w: 1680, h: 2060, shape: 'rect', emptyFill: '#E4DAC5' }
    ],
    innerFrame: { x: 170, y: 270, w: 1820, h: 2200, color: '#EFE6D3', radius: 14 },
    defaultElements: [
      {
        id: 'el-lace-clip',
        type: 'clip',
        x: 940, y: 140, w: 280, h: 170,
        color: '#C9A24A'
      }
    ],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 5. Coastal ring ───────────────────────────────────────────────────────
  {
    id: 'coastal-ring',
    name: 'Coastal ring',
    category: 'playful',
    background: '#FDF3EF',
    borderColor: '#E8CCD2',
    pattern: 'gingham',
    patColor: '#E6AAB4',
    apertures: [
      { x: 240, y: 380, w: 1680, h: 1760, shape: 'rounded', radius: 40, emptyFill: '#F4E2DE' }
    ],
    defaultElements: [
      {
        id: 'el-ring-btn-top',
        type: 'button-deco',
        x: 1020, y: 180, w: 120, h: 120,
        color: '#E6AAB4'
      },
      {
        id: 'el-ring-btn-bottom',
        type: 'button-deco',
        x: 1020, y: 2360, w: 120, h: 120,
        color: '#E6AAB4'
      }
    ],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 6. Camera cutout ──────────────────────────────────────────────────────
  {
    id: 'camera-cutout',
    name: 'Camera cutout',
    category: 'strip',
    background: '#8F1D1D',
    borderColor: '#681414',
    pattern: 'camera-cutout',
    apertures: [
      { x: 240, y: 560,  w: 1680, h: 600, shape: 'rounded', radius: 12, emptyFill: '#6E1313' },
      { x: 240, y: 1220, w: 1680, h: 600, shape: 'rounded', radius: 12, emptyFill: '#6E1313' },
      { x: 240, y: 1880, w: 1680, h: 600, shape: 'rounded', radius: 12, emptyFill: '#6E1313' }
    ],
    defaultElements: [],
    capabilities: { photoCount: 3, metadata: false }
  },

  // ─── 7. Playing card ───────────────────────────────────────────────────────
  {
    id: 'playing-card',
    name: 'Playing card',
    category: 'editorial',
    background: '#B3273A',
    borderColor: '#8A1B2A',
    pattern: 'playing-card',
    apertures: [
      { x: 260, y: 540, w: 1640, h: 1860, shape: 'rounded', radius: 24, emptyFill: '#EDE6D8' }
    ],
    innerFrame: { x: 160, y: 160, w: 1840, h: 2380, color: '#FBF6EC', radius: 40 },
    defaultElements: [
      {
        id: 'el-card-suit-tl',
        type: 'club-suit',
        x: 230, y: 230, w: 90, h: 90,
        color: '#B3273A'
      },
      {
        id: 'el-card-suit-br',
        type: 'club-suit',
        x: 1840, y: 2420, w: 90, h: 90,
        color: '#B3273A', rotation: 180
      },
      {
        id: 'el-card-caption',
        type: 'text',
        text: 'how lucky are we',
        x: 360, y: 270, w: 1440, h: 160,
        style: { fontFamily: 'Caveat', fontSize: 120, color: '#B3273A', align: 'center', letterSpacing: 2 }
      }
    ],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 8. Love scribble ──────────────────────────────────────────────────────
  {
    id: 'love-scribble',
    name: 'Love scribble',
    category: 'playful',
    background: '#FFF8F3',
    borderColor: '#F0D5D8',
    pattern: 'dots-dense',
    patColor: '#C23B4C',
    apertures: [
      { x: 200, y: 340, w: 1760, h: 1760, shape: 'rect', emptyFill: '#F2E8E4' }
    ],
    defaultElements: [
      {
        id: 'el-scribble-caption',
        type: 'text',
        text: 'xoxo',
        x: 200, y: 2300, w: 1760, h: 140,
        style: { fontFamily: 'Caveat', fontSize: 130, color: '#C23B4C', align: 'center' }
      }
    ],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 9. Digital camera ─────────────────────────────────────────────────────
  {
    id: 'digital-camera',
    name: 'Digital camera',
    category: 'camera',
    background: '#D98AA0',
    borderColor: '#BC6D84',
    pattern: 'digicam',
    apertures: [
      { x: 220, y: 260, w: 1720, h: 1800, shape: 'rounded', radius: 48, emptyFill: '#24181E' }
    ],
    defaultElements: [
      {
        id: 'el-digicam-controls',
        type: 'controls',
        x: 840, y: 2260, w: 480, h: 120,
        color: 'rgba(255,255,255,0.75)'
      }
    ],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 10. Citrus collage ────────────────────────────────────────────────────
  {
    id: 'citrus-collage',
    name: 'Citrus collage',
    category: 'playful',
    background: '#F7E2B8',
    borderColor: '#E8BA68',
    pattern: 'citrus-gradient',
    apertures: [
      { x: 260, y: 360, w: 1640, h: 1960, shape: 'rect', emptyFill: '#FAF4E8' }
    ],
    innerFrame: { x: 160, y: 260, w: 1840, h: 2180, color: '#FFFFFF', radius: 18, rotation: -3 },
    defaultElements: [
      {
        id: 'el-citrus-badge',
        type: 'badge',
        text: 'fresh cut',
        x: 140, y: 120, w: 380, h: 110,
        bg: '#B3273A', textColor: '#FDE8C8'
      },
      {
        id: 'el-citrus-crosshair',
        type: 'crosshair',
        x: 980, y: 1240, w: 200, h: 200,
        color: '#181818'
      }
    ],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 11. Handwritten caption ───────────────────────────────────────────────
  {
    id: 'handwritten-caption',
    name: 'Handwritten caption',
    category: 'editorial',
    background: '#F4ECDD',
    borderColor: '#DFD4BE',
    pattern: 'none',
    apertures: [
      { x: 140, y: 220, w: 1880, h: 1980, shape: 'rect', emptyFill: '#E8DDC9' }
    ],
    defaultElements: [
      {
        id: 'el-handwritten-text',
        type: 'text',
        text: 'With love.',
        x: 180, y: 2360, w: 1100, h: 160,
        style: { fontFamily: 'Caveat', fontSize: 140, color: '#3A2B28', align: 'left', letterSpacing: 2 }
      }
    ],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 12. Retro phone collage ───────────────────────────────────────────────
  {
    id: 'retro-phone',
    name: 'Retro phone collage',
    category: 'camera',
    background: '#F6E2C4',
    borderColor: '#E6C49A',
    pattern: 'dots-dense',
    patColor: '#E8823C',
    apertures: [
      { x: 260, y: 320, w: 1640, h: 1720, shape: 'rounded', radius: 36, emptyFill: '#2E1920' }
    ],
    innerFrame: { x: 160, y: 220, w: 1840, h: 2260, color: '#D98AA0', radius: 52 },
    defaultElements: [
      {
        id: 'el-retro-controls',
        type: 'controls',
        x: 840, y: 2220, w: 480, h: 120,
        color: 'rgba(255,255,255,0.75)'
      }
    ],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 13. Postcard ──────────────────────────────────────────────────────────
  {
    id: 'postcard',
    name: 'Postcard',
    category: 'editorial',
    background: '#FAF6EA',
    borderColor: '#E3DCBF',
    pattern: 'grid',
    patColor: 'rgba(0,0,0,0.08)',
    apertures: [
      { x: 160, y: 220, w: 1840, h: 2060, shape: 'rect', emptyFill: '#EDE6D2' }
    ],
    defaultElements: [
      {
        id: 'el-postcard-seal',
        type: 'seal',
        x: 160, y: 2380, w: 160, h: 160,
        color: '#8F1D1D', innerColor: '#B3273A'
      },
      {
        id: 'el-postcard-tag',
        type: 'tag',
        text: 'a girl, an ocean',
        x: 360, y: 2410, w: 680, h: 100,
        bg: '#FFFFFF', color: '#8A7A5A', borderColor: '#DDD0BA'
      }
    ],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 14. Story of love ─────────────────────────────────────────────────────
  {
    id: 'story-of-love',
    name: 'Story of love',
    category: 'strip',
    background: '#0D0D0E',
    borderColor: '#242426',
    pattern: 'none',
    innerFrame: { x: 120, y: 120, w: 1920, h: 2460, color: '#7A1C26', radius: 18 },
    apertures: [
      { x: 400, y: 200,  w: 1540, h: 680, shape: 'rect', emptyFill: '#4A1117' },
      { x: 400, y: 960,  w: 1540, h: 680, shape: 'rect', emptyFill: '#4A1117' },
      { x: 400, y: 1720, w: 1540, h: 680, shape: 'rect', emptyFill: '#4A1117' }
    ],
    defaultElements: [
      {
        id: 'el-story-ribbon',
        type: 'tag',
        text: 'i love you',
        x: 160, y: 800, w: 200, h: 1000,
        vertical: true, font: 'Caveat', fontSize: 130, color: '#F4D8C8'
      },
      {
        id: 'el-story-stamp',
        type: 'stamp',
        x: 1620, y: 2450, w: 180, h: 120,
        bg: '#F4E9D8', borderColor: '#B98A55'
      }
    ],
    capabilities: { photoCount: 3, metadata: false }
  },

  // ─── 15. Camera screen ─────────────────────────────────────────────────────
  {
    id: 'camera-screen',
    name: 'Camera screen',
    category: 'camera',
    background: '#3A2F26',
    borderColor: '#261F18',
    pattern: 'weave',
    innerFrame: { x: 120, y: 120, w: 1920, h: 2460, color: '#1C1C1C', radius: 32 },
    apertures: [
      { x: 180, y: 200, w: 1800, h: 2120, shape: 'rounded', radius: 16, emptyFill: '#0D0D0E' }
    ],
    defaultElements: [
      {
        id: 'el-cam-screen-text',
        type: 'text',
        text: 'photo+',
        x: 240, y: 2410, w: 420, h: 100,
        style: { fontFamily: 'Caveat', fontSize: 96, color: '#E8A83A', align: 'left' }
      },
      {
        id: 'el-cam-screen-vinyl',
        type: 'vinyl',
        x: 1820, y: 2360, w: 220, h: 220
      }
    ],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 16. Editor toolbar ────────────────────────────────────────────────────
  {
    id: 'editor-toolbar',
    name: 'Editor toolbar',
    category: 'camera',
    background: '#FAF8F4',
    borderColor: '#E2DBD0',
    pattern: 'editor-toolbar',
    apertures: [
      { x: 340, y: 140, w: 1700, h: 2420, shape: 'rect', emptyFill: '#EDE6D8' }
    ],
    defaultElements: [],
    capabilities: { photoCount: 1, metadata: false }
  },

  // ─── 17. Film roll ─────────────────────────────────────────────────────────
  {
    id: 'film-roll',
    name: 'Film roll',
    category: 'strip',
    background: '#1C1C1C',
    borderColor: '#111111',
    pattern: 'sprockets',
    apertures: [
      { x: 260, y: 320,  w: 1640, h: 680, shape: 'rect', emptyFill: '#0D0D0E' },
      { x: 260, y: 1080, w: 1640, h: 680, shape: 'rect', emptyFill: '#0D0D0E' },
      { x: 260, y: 1840, w: 1640, h: 680, shape: 'rect', emptyFill: '#0D0D0E' }
    ],
    defaultElements: [
      {
        id: 'el-film-tag',
        type: 'tag',
        text: 'roll 02',
        x: 260, y: 150, w: 340, h: 90,
        bg: '#2C2C2C', color: '#CCCCCC', borderColor: '#444444'
      }
    ],
    capabilities: { photoCount: 3, metadata: false }
  }

];

/**
 * Get frame definition by id
 * @param {string} id
 * @returns {object|undefined}
 */
export function getFrameById(id) {
  return FRAME_CATALOG.find(f => f.id === id) || FRAME_CATALOG[0];
}

/**
 * Get frames by category
 * @param {string} category
 */
export function getFramesByCategory(cat) {
  if (!cat || cat === 'all') return FRAME_CATALOG;
  return FRAME_CATALOG.filter(f => f.category === cat);
}
