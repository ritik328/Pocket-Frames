/**
 * Pocket Frames - Universal Media Loader (Photos & Videos)
 * Supports JPG, PNG, WebP, MP4, WebM, QuickTime MOV
 */
import { extractExif } from './exif.js';
import { normalizeImageOrientation } from './orientation.js';

export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB safe limit
export const SUPPORTED_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const SUPPORTED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/ogg'];
export const SUPPORTED_VIDEO_EXTS = ['mp4', 'webm', 'mov', 'm4v', 'ogv'];
export const SUPPORTED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

/**
 * Validates and loads an uploaded file (Image or Video)
 * @param {File|Blob} file 
 * @returns {Promise<Object>}
 */
export async function loadUserImage(file) {
  if (!file) {
    throw new Error('No file provided.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File is too large to process safely (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please use a file under 500MB.`);
  }

  const name = file.name || '';
  const ext = name.split('.').pop()?.toLowerCase();
  const isVideo = (file.type && file.type.startsWith('video/')) || SUPPORTED_VIDEO_EXTS.includes(ext);

  if (isVideo) {
    return loadUserVideo(file);
  }

  // Validate image types
  if (file.type && !SUPPORTED_IMAGE_MIMES.includes(file.type.toLowerCase())) {
    if (!SUPPORTED_IMAGE_EXTS.includes(ext)) {
      throw new Error(`Unsupported format. Please upload JPG, PNG, WebP photos or MP4, WebM, MOV videos.`);
    }
  }

  // 1. Extract EXIF & orientation
  const { orientation, extracted: extractedExif, raw: rawExif } = await extractExif(file);

  // 2. Decode image natively at full resolution
  const objectUrl = URL.createObjectURL(file);
  const rawImg = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Browser was unable to decode this image file. It may be corrupt or an unsupported format.'));
    };
    img.src = objectUrl;
  });

  URL.revokeObjectURL(objectUrl);

  // 3. Normalize orientation if needed
  const normalized = await normalizeImageOrientation(rawImg, orientation);

  return {
    type: 'image',
    element: normalized.element,
    originalElement: normalized.element,
    width: normalized.width,
    height: normalized.height,
    orientation,
    extractedExif,
    rawExif,
    file,
    filename: file.name || 'photograph.jpg'
  };
}

/**
 * Loads and prepares an HTML5 video element for canvas rendering
 */
async function loadUserVideo(file) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = objectUrl;
  video.crossOrigin = 'anonymous';
  video.playsInline = true;
  video.muted = true; // muted allows immediate autoplay
  video.loop = true;
  video.preload = 'auto';

  await new Promise((resolve, reject) => {
    const onLoaded = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Browser was unable to decode this video file. Try MP4 (H.264), WebM, or MOV.'));
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });

  // Seek slightly forward to ensure first video frame is available to canvas
  try {
    video.currentTime = 0.05;
    await new Promise(resolve => {
      video.addEventListener('seeked', resolve, { once: true });
      setTimeout(resolve, 150);
    });
  } catch (e) {}

  const width = video.videoWidth || 1920;
  const height = video.videoHeight || 1080;
  const duration = video.duration || 0;

  // Clean filename for device title
  const cleanTitle = (file.name || 'Video Clip')
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .trim();

  return {
    type: 'video',
    element: video,
    originalElement: video,
    width,
    height,
    duration,
    orientation: 1,
    extractedExif: {
      device: cleanTitle || 'Cinema Video',
      focalLength: '28mm',
      aperture: 'f/1.8',
      shutter: '1/60',
      iso: '400'
    },
    rawExif: null,
    file,
    filename: file.name || 'video.mp4',
    objectUrl
  };
}
