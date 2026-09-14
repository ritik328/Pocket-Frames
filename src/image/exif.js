/**
 * Pocket Frames - Client-side EXIF Parser
 * Uses exifr running entirely client-side in the browser.
 * Zero server uploads; private and instant.
 */
import exifr from 'exifr';

/**
 * Format exposure time to standard shutter speed string
 * e.g., 0.04 -> '1/25', 0.002 -> '1/500', 1.5 -> '1.5s'
 */
export function formatExposureTime(seconds) {
  if (!seconds || typeof seconds !== 'number') return null;
  if (seconds >= 1) {
    return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
  }
  const denominator = Math.round(1 / seconds);
  return `1/${denominator}`;
}

/**
 * Format focal length
 * e.g., 146 -> '146mm'
 */
export function formatFocalLength(fl, fl35) {
  const val = fl35 || fl;
  if (!val) return null;
  return `${Math.round(val)}mm`;
}

/**
 * Format aperture
 * e.g., 2.6 -> 'f/2.6', 1.4 -> 'f/1.4'
 */
export function formatAperture(fn) {
  if (!fn || typeof fn !== 'number') return null;
  return Number.isInteger(fn) ? `f/${fn}.0` : `f/${fn.toFixed(1)}`;
}

/**
 * Format device name from Make and Model
 */
export function formatDeviceName(make, model) {
  if (!model && !make) return null;
  if (!make) return model.trim();
  if (!model) return make.trim();

  const cleanMake = make.trim();
  const cleanModel = model.trim();

  // If model already contains make (e.g. "OPPO Find X9"), don't duplicate
  if (cleanModel.toLowerCase().startsWith(cleanMake.toLowerCase())) {
    return cleanModel;
  }
  return `${cleanMake} ${cleanModel}`;
}

/**
 * Extract camera metadata & orientation from file or blob
 * @param {File|Blob} file 
 */
export async function extractExif(file) {
  try {
    const raw = await exifr.parse(file, [
      'Orientation',
      'Make',
      'Model',
      'FocalLength',
      'FocalLengthIn35mmFormat',
      'FNumber',
      'ExposureTime',
      'ISO'
    ]);

    if (!raw) {
      return {
        orientation: 1,
        extracted: null,
        raw: {}
      };
    }

    const extracted = {
      device: formatDeviceName(raw.Make, raw.Model),
      focalLength: formatFocalLength(raw.FocalLength, raw.FocalLengthIn35mmFormat),
      aperture: formatAperture(raw.FNumber),
      shutter: formatExposureTime(raw.ExposureTime),
      iso: raw.ISO ? String(raw.ISO) : null
    };

    return {
      orientation: raw.Orientation || 1,
      extracted,
      raw
    };
  } catch (err) {
    console.warn('Could not parse EXIF, falling back to defaults:', err);
    return {
      orientation: 1,
      extracted: null,
      raw: {}
    };
  }
}
