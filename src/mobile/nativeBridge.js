/**
 * Pocket Frames - Native Android & Cross-Platform Hardware Bridge
 * Integrates Capacitor Native APIs:
 * - Native Gallery saving via @capacitor-community/media & MediaStore
 * - Native Haptic feedback via @capacitor/haptics
 * - Native Android Share Sheet via @capacitor/share
 * - Native File System via @capacitor/filesystem
 * 
 * Provides seamless, zero-crash web fallbacks when running in a standard browser.
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Media } from '@capacitor-community/media';

/**
 * Check if running inside native Android / iOS shell
 */
export function isNativePlatform() {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
}

/**
 * Get current platform name ('android', 'ios', 'web')
 */
export function getPlatform() {
  try {
    return Capacitor.getPlatform();
  } catch (e) {
    return 'web';
  }
}

/**
 * Trigger subtle, sensory haptic feedback
 * @param {'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning'} type
 */
export async function triggerHaptic(type = 'light') {
  try {
    if (isNativePlatform()) {
      switch (type) {
        case 'light':
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
        case 'medium':
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case 'heavy':
          await Haptics.impact({ style: ImpactStyle.Heavy });
          break;
        case 'selection':
          await Haptics.selectionChanged();
          break;
        case 'success':
          await Haptics.notification({ type: NotificationType.Success });
          break;
        case 'warning':
          await Haptics.notification({ type: NotificationType.Warning });
          break;
        default:
          await Haptics.impact({ style: ImpactStyle.Light });
      }
      return;
    }

    // Web vibration fallback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (type === 'heavy' || type === 'warning') {
        navigator.vibrate([30, 40, 30]);
      } else if (type === 'success') {
        navigator.vibrate([15, 60, 25]);
      } else if (type === 'medium') {
        navigator.vibrate(20);
      } else {
        navigator.vibrate(10);
      }
    }
  } catch (e) {
    // Non-critical, ignore silent failures
  }
}

/**
 * Convert Blob to Base64 String
 * @param {Blob} blob 
 * @returns {Promise<{ dataUrl: string, base64: string }>}
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve({ dataUrl, base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Save exported photo directly into native device Gallery / MediaStore
 * @param {object} params
 * @param {Blob} params.blob
 * @param {string} params.filename
 * @returns {Promise<{ success: boolean, method: string, path?: string }>}
 */
export async function saveToDeviceGallery({ blob, filename }) {
  await triggerHaptic('medium');

  if (isNativePlatform()) {
    try {
      const { dataUrl, base64 } = await blobToBase64(blob);
      const cleanName = filename.replace(/\.[^/.]+$/, '');

      // 1. Primary: Save directly to Android MediaStore/Gallery via @capacitor-community/media
      try {
        const photoRes = await Media.savePhoto({
          path: dataUrl,
          fileName: cleanName
        });
        await triggerHaptic('success');
        return { success: true, method: 'gallery', path: photoRes?.filePath };
      } catch (mediaErr) {
        console.warn('[NativeBridge] Media.savePhoto failed, falling back to Filesystem:', mediaErr);
      }

      // 2. Secondary fallback: Write to device Documents / Cache
      const fileRes = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents,
        recursive: true
      });

      await triggerHaptic('success');
      return { success: true, method: 'filesystem', path: fileRes.uri };
    } catch (err) {
      console.error('[NativeBridge] Native save failed:', err);
      // Fallback to web download if native save errors
    }
  }

  // Web Browser Fallback: standard anchor download
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  await triggerHaptic('success');
  return { success: true, method: 'web-download' };
}

/**
 * Open Native Android Share Sheet (Instagram, WhatsApp, Stories, Save, etc.)
 * @param {object} params
 * @param {Blob} params.blob
 * @param {string} params.filename
 * @param {string} [params.title]
 * @param {string} [params.text]
 * @returns {Promise<{ success: boolean, method: string }>}
 */
export async function shareFramedPhoto({
  blob,
  filename,
  title = 'Pocket Frames Photograph',
  text = 'Framed with Pocket Frames'
}) {
  await triggerHaptic('light');

  // 1. Native Capacitor Share Sheet
  if (isNativePlatform()) {
    try {
      const { base64 } = await blobToBase64(blob);

      // Write cached file for intent attachment
      const tempPath = `share_${Date.now()}_${filename}`;
      const writeResult = await Filesystem.writeFile({
        path: tempPath,
        data: base64,
        directory: Directory.Cache
      });

      const uriResult = await Filesystem.getUri({
        path: tempPath,
        directory: Directory.Cache
      });

      const fileUri = uriResult?.uri || writeResult?.uri;

      await Share.share({
        title,
        text,
        url: fileUri,
        dialogTitle: 'Share Framed Photograph'
      });

      await triggerHaptic('success');
      return { success: true, method: 'native-share' };
    } catch (err) {
      if (err.message && (err.message.includes('abort') || err.message.includes('canceled') || err.message.includes('cancelled'))) {
        return { success: false, canceled: true };
      }
      console.warn('[NativeBridge] Native share error, falling back:', err);
    }
  }

  // 2. Web Share API with File attachment (Mobile Chrome / Safari)
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text
        });
        await triggerHaptic('success');
        return { success: true, method: 'web-share' };
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, canceled: true };
      }
      console.warn('[NativeBridge] Web share failed, falling back to download:', err);
    }
  }

  // 3. Fallback to saveToDeviceGallery
  return await saveToDeviceGallery({ blob, filename });
}
