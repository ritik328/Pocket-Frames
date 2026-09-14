/**
 * Pocket Frames - EXIF Orientation Normalizer
 * Normalizes EXIF orientation tags (1-8) so photographs are upright.
 */

export async function normalizeImageOrientation(img, orientation = 1) {
  // If orientation is 1 (normal) or undefined, return image directly
  if (!orientation || orientation === 1) {
    return {
      element: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height
    };
  }

  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;

  // Determine if width/height are swapped (orientations 5, 6, 7, 8)
  const isSwapped = orientation >= 5 && orientation <= 8;
  const targetWidth = isSwapped ? srcHeight : srcWidth;
  const targetHeight = isSwapped ? srcWidth : srcHeight;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  ctx.save();

  switch (orientation) {
    case 2: // Horizontal flip
      ctx.translate(targetWidth, 0);
      ctx.scale(-1, 1);
      break;
    case 3: // 180 rotate
      ctx.translate(targetWidth, targetHeight);
      ctx.rotate(Math.PI);
      break;
    case 4: // Vertical flip
      ctx.translate(0, targetHeight);
      ctx.scale(1, -1);
      break;
    case 5: // Vertical flip + 90 rotate CW
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;
    case 6: // 90 rotate CW
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(0, -targetWidth);
      break;
    case 7: // Horizontal flip + 90 rotate CW
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(targetHeight, -targetWidth);
      ctx.scale(-1, 1);
      break;
    case 8: // 270 rotate CW (90 CCW)
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-targetHeight, 0);
      break;
    default:
      break;
  }

  ctx.drawImage(img, 0, 0);
  ctx.restore();

  return {
    element: canvas,
    width: targetWidth,
    height: targetHeight
  };
}
