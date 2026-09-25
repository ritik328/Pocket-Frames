/**
 * Pocket Frames - Built-in Medium Format & Filmic 3D LUT Presets
 * Generates calibrated 17x17x17 .cube data with authentic color science curves
 */
import { parseCubeLut } from './lutParser.js';

// Color curve helpers
function clamp(val, min = 0, max = 1) {
  return Math.max(min, Math.min(max, val));
}

// S-curve contrast adjustment
function sCurve(x, contrast = 1.2) {
  return Math.pow(x, 2) / (Math.pow(x, 2) + Math.pow(1 - x, 2) * (1 / contrast));
}

/**
 * Generates a 17x17x17 3D LUT using a per-point RGB transformation function
 */
function generateLutData(size, transformFn) {
  const points = [];
  const N1 = size - 1;

  // Blue outer loop, Green middle, Red fastest (standard .cube order)
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const inR = r / N1;
        const inG = g / N1;
        const inB = b / N1;

        const [outR, outG, outB] = transformFn(inR, inG, inB);
        points.push(
          clamp(outR).toFixed(6),
          clamp(outG).toFixed(6),
          clamp(outB).toFixed(6)
        );
      }
    }
  }

  return points;
}

/**
 * Builds standard .cube string from transformation
 */
function buildCubeString(title, size, transformFn) {
  const points = generateLutData(size, transformFn);
  const lines = [
    `# Pocket Frames Calibrated Cinema Preset`,
    `TITLE "${title}"`,
    `LUT_3D_SIZE ${size}`,
    `DOMAIN_MIN 0.0 0.0 0.0`,
    `DOMAIN_MAX 1.0 1.0 1.0`
  ];

  for (let i = 0; i < points.length; i += 3) {
    lines.push(`${points[i]} ${points[i + 1]} ${points[i + 2]}`);
  }

  return lines.join('\n');
}

/**
 * Preset Definitions
 */
export const BUILTIN_PRESET_DEFINITIONS = [
  {
    id: 'hasselblad_natural',
    title: 'Hasselblad Natural Color (HNCS)',
    category: 'Medium Format',
    description: 'Authentic medium-format tone curve with natural skin tones and rich controlled foliage greens.',
    colorTag: '#C49A45',
    generate: (size = 17) => buildCubeString('Hasselblad Natural Color (HNCS)', size, (r, g, b) => {
      // Gentle Hasselblad S-curve
      let ro = Math.pow(r, 1.02);
      let go = Math.pow(g, 1.01);
      let bo = Math.pow(b, 1.04);

      // Natural highlight roll-off
      ro = ro < 0.5 ? 0.5 * Math.pow(ro * 2, 1.15) : 1 - 0.5 * Math.pow((1 - ro) * 2, 1.15);
      go = go < 0.5 ? 0.5 * Math.pow(go * 2, 1.12) : 1 - 0.5 * Math.pow((1 - go) * 2, 1.12);
      bo = bo < 0.5 ? 0.5 * Math.pow(bo * 2, 1.18) : 1 - 0.5 * Math.pow((1 - bo) * 2, 1.18);

      // Subtle warm medium format bias in skin/highlights
      ro += (1 - ro) * 0.035 * Math.max(0, ro - bo);
      // Clean shadows without murky black crushing
      ro = ro * 0.98 + 0.01;
      go = go * 0.98 + 0.008;
      bo = bo * 0.98 + 0.012;

      return [ro, go, bo];
    })
  },
  {
    id: 'kodak_portra_400',
    title: 'Kodak Portra 400',
    category: 'Negative Film',
    description: 'Warm golden highlights, lifted gentle film shadows, and flattering editorial portrait skin tones.',
    colorTag: '#E6A770',
    generate: (size = 17) => buildCubeString('Kodak Portra 400', size, (r, g, b) => {
      // Lifted film black
      let ro = r * 0.93 + 0.035;
      let go = g * 0.94 + 0.028;
      let bo = b * 0.92 + 0.045;

      // Soft Portra midtone contrast
      ro = Math.pow(ro, 0.94);
      go = Math.pow(go, 0.96);
      bo = Math.pow(bo, 1.03);

      // Warm highlight tint
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      ro += lum * 0.05;
      go += lum * 0.02;
      bo -= lum * 0.025;

      return [ro, go, bo];
    })
  },
  {
    id: 'fuji_pro_400h',
    title: 'Fujifilm Pro 400H',
    category: 'Negative Film',
    description: 'Cool airy mint/cyan highlights, gentle pastel saturation, and luminous high-key tonal depth.',
    colorTag: '#68C3B5',
    generate: (size = 17) => buildCubeString('Fujifilm Pro 400H', size, (r, g, b) => {
      // Soft high-key curve
      let ro = Math.pow(r, 0.96);
      let go = Math.pow(g, 0.94);
      let bo = Math.pow(b, 0.92);

      // Cool mint highlight shift
      const lum = 0.299 * ro + 0.587 * go + 0.114 * bo;
      go += lum * 0.03;
      bo += lum * 0.04;
      ro -= lum * 0.01;

      // Clean lifted pastel shadows
      ro = ro * 0.95 + 0.025;
      go = go * 0.95 + 0.03;
      bo = bo * 0.95 + 0.04;

      return [ro, go, bo];
    })
  },
  {
    id: 'cinematic_teal_orange',
    title: 'Cine Teal & Orange',
    category: 'Cinematic',
    description: 'Hollywood blockbuster complementary split-toning: deep teal shadows paired with rich amber skin tones.',
    colorTag: '#3A9BB2',
    generate: (size = 17) => buildCubeString('Cine Teal & Orange', size, (r, g, b) => {
      // Punchy cinematic S-curve
      let ro = sCurve(r, 1.3);
      let go = sCurve(g, 1.25);
      let bo = sCurve(b, 1.35);

      const lum = 0.299 * ro + 0.587 * go + 0.114 * bo;

      // Shadows -> Teal
      const shadowWeight = Math.pow(1 - lum, 1.8);
      ro -= shadowWeight * 0.06;
      go += shadowWeight * 0.03;
      bo += shadowWeight * 0.10;

      // Highlights -> Orange
      const highlightWeight = Math.pow(lum, 1.6);
      ro += highlightWeight * 0.08;
      go += highlightWeight * 0.025;
      bo -= highlightWeight * 0.07;

      return [ro, go, bo];
    })
  },
  {
    id: 'leica_monochrome',
    title: 'Leica Monochrom Noir',
    category: 'Black & White',
    description: 'Silver gelatin panchromatic street photography monochrome with velvety micro-contrast.',
    colorTag: '#8E8E93',
    generate: (size = 17) => buildCubeString('Leica Monochrom Noir', size, (r, g, b) => {
      // Panchromatic spectral luminance
      const mono = 0.299 * r + 0.587 * g + 0.114 * b;
      // High-contrast film curve
      let out = sCurve(mono, 1.4);
      // Controlled ink black
      out = Math.pow(out, 1.05);

      return [out, out, out];
    })
  },
  {
    id: 'kodachrome_64',
    title: 'Kodak Kodachrome 64',
    category: 'Slide Film',
    description: 'Iconic 1970s slide film with rich primary reds, golden amber daylight, and nostalgic punch.',
    colorTag: '#E04A36',
    generate: (size = 17) => buildCubeString('Kodak Kodachrome 64', size, (r, g, b) => {
      // Contrast rich slide curve
      let ro = Math.pow(r, 1.12);
      let go = Math.pow(g, 1.15);
      let bo = Math.pow(b, 1.22);

      // Distinctive warm red punch
      ro = ro * 1.06 + 0.01;
      // Shadow warmth
      go = go * 0.98;
      bo = bo * 0.92;

      return [ro, go, bo];
    })
  }
];

let cachedPresets = null;

/**
 * Returns all parsed built-in presets ready to use immediately
 * @returns {CubeLut[]}
 */
export function getBuiltinPresets() {
  if (cachedPresets) return cachedPresets;

  cachedPresets = BUILTIN_PRESET_DEFINITIONS.map(def => {
    const cubeText = def.generate(17);
    const parsed = parseCubeLut(cubeText, `${def.id}.cube`);
    parsed.id = def.id;
    parsed.title = def.title;
    parsed.category = def.category;
    parsed.description = def.description;
    parsed.colorTag = def.colorTag;
    parsed.isBuiltin = true;
    return parsed;
  });

  return cachedPresets;
}
