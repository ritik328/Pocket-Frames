/**
 * Pocket Frames - Video Playback & Cinematic Frame Recorder
 * High-performance requestVideoFrameCallback render loop with real-time 3D LUT grading
 */
import { store } from '../state.js';
import { lutManager } from '../lut/lutManager.js';
import { applyLut } from '../lut/lutProcessor.js';
import { renderFrame } from '../frame/frameRenderer.js';

class VideoPlaybackManager {
  constructor() {
    this.video = null;
    this.rafId = null;
    this.rvfcId = null;
    this.listeners = new Set();
    this.isPlaying = false;
    this.isMuted = true;
    this.isLooping = true;
    this.isRecording = false;
    this.onUpdateCallback = null;
  }

  setUpdateCallback(fn) {
    this.onUpdateCallback = fn;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }

  attach(videoElement) {
    if (this.video === videoElement) return;
    this.detach();

    this.video = videoElement;
    if (!this.video) return;

    this.video.loop = this.isLooping;
    this.video.muted = this.isMuted;
    this.isPlaying = !this.video.paused;

    this._onPlay = () => {
      this.isPlaying = true;
      this.startRenderLoop();
      this.notify();
    };

    this._onPause = () => {
      this.isPlaying = false;
      this.stopRenderLoop();
      this.notify();
    };

    this._onEnded = () => {
      if (!this.isLooping) {
        this.isPlaying = false;
        this.stopRenderLoop();
        this.notify();
      }
    };

    this._onTimeUpdate = () => {
      this.notify();
    };

    this.video.addEventListener('play', this._onPlay);
    this.video.addEventListener('pause', this._onPause);
    this.video.addEventListener('ended', this._onEnded);
    this.video.addEventListener('timeupdate', this._onTimeUpdate);

    // Initial first-frame render
    this.renderFrame();
    this.notify();
  }

  detach() {
    this.stopRenderLoop();
    if (this.video) {
      if (this._onPlay) this.video.removeEventListener('play', this._onPlay);
      if (this._onPause) this.video.removeEventListener('pause', this._onPause);
      if (this._onEnded) this.video.removeEventListener('ended', this._onEnded);
      if (this._onTimeUpdate) this.video.removeEventListener('timeupdate', this._onTimeUpdate);
      this.video.pause();
      this.video = null;
    }
    this.isPlaying = false;
    this.notify();
  }

  play() {
    if (this.video) {
      this.video.play().catch(e => console.warn('[VideoManager] Play prevented:', e));
    }
  }

  pause() {
    if (this.video) {
      this.video.pause();
    }
  }

  togglePlay() {
    if (!this.video) return;
    if (this.video.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  seek(timeInSeconds) {
    if (!this.video) return;
    const dur = this.video.duration || 1;
    this.video.currentTime = Math.max(0, Math.min(dur, timeInSeconds));
    this.renderFrame();
    this.notify();
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.video) {
      this.video.muted = this.isMuted;
    }
    this.notify();
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
  }

  setLooping(loop) {
    this.isLooping = Boolean(loop);
    if (this.video) {
      this.video.loop = this.isLooping;
    }
    this.notify();
  }

  toggleLoop() {
    this.setLooping(!this.isLooping);
  }

  getCurrentTime() {
    return this.video?.currentTime || 0;
  }

  getDuration() {
    return this.video?.duration || 0;
  }

  startRenderLoop() {
    this.stopRenderLoop();

    const tick = () => {
      if (!this.video || this.video.paused || this.video.ended) {
        return;
      }

      this.renderFrame();

      if ('requestVideoFrameCallback' in this.video) {
        this.rvfcId = this.video.requestVideoFrameCallback(tick);
      } else {
        this.rafId = requestAnimationFrame(tick);
      }
    };

    if ('requestVideoFrameCallback' in this.video) {
      this.rvfcId = this.video.requestVideoFrameCallback(tick);
    } else {
      this.rafId = requestAnimationFrame(tick);
    }
  }

  stopRenderLoop() {
    if (this.video && this.rvfcId && 'cancelVideoFrameCallback' in this.video) {
      this.video.cancelVideoFrameCallback(this.rvfcId);
      this.rvfcId = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  renderFrame() {
    if (!this.video) return;

    // Apply active or hover-previewed 3D LUT to the current video frame in real time
    const activeLut = lutManager.previewHoverLut || (lutManager.isBypassed ? null : lutManager.activeLut);
    const state = store.getState();
    if (state.image && activeLut && lutManager.intensity > 0) {
      if (!state.image.originalElement) {
        state.image.originalElement = state.image.element;
      }
      const renderedCanvas = applyLut(
        state.image.originalElement,
        activeLut,
        lutManager.intensity,
        state.image.lutElement || null
      );
      state.image.lutElement = renderedCanvas;
      state.image.element = renderedCanvas;
    } else if (state.image && state.image.originalElement) {
      state.image.element = state.image.originalElement;
    }

    // Trigger canvas preview refresh
    if (this.onUpdateCallback) {
      this.onUpdateCallback();
    }
  }

  /**
   * Export framed video with 3D LUT grading, Polaroid borders, and Hasselblad metadata
   */
  async exportFramedVideo(state, options = {}, onProgress = null) {
    if (!this.video) {
      throw new Error('No video loaded to export.');
    }

    const {
      width = 1080,
      height = 1350,
      fps = 30
    } = options;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;

    const stream = exportCanvas.captureStream(fps);

    // Capture audio track if present
    try {
      if (this.video.captureStream) {
        const audioTracks = this.video.captureStream().getAudioTracks();
        if (audioTracks.length > 0) stream.addTrack(audioTracks[0]);
      } else if (this.video.mozCaptureStream) {
        const audioTracks = this.video.mozCaptureStream().getAudioTracks();
        if (audioTracks.length > 0) stream.addTrack(audioTracks[0]);
      }
    } catch (e) {
      console.warn('[VideoManager] Audio capture notice:', e);
    }

    let mimeType = 'video/webm;codecs=vp9';
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      mimeType = 'video/mp4;codecs=avc1';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    }

    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8000000
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    const wasPlaying = !this.video.paused;
    this.video.pause();
    this.isRecording = true;

    const originalTime = this.video.currentTime;
    const duration = this.video.duration || 10;
    const totalFrames = Math.max(1, Math.round(duration * fps));
    const frameInterval = 1 / fps;

    recorder.start();

    try {
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        const targetTime = frameIndex * frameInterval;
        this.video.currentTime = targetTime;

        await new Promise(resolve => {
          const onSeeked = () => {
            this.video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          this.video.addEventListener('seeked', onSeeked, { once: true });
          setTimeout(onSeeked, 100);
        });

        // Grade frame with active LUT
        const activeLut = lutManager.activeLut;
        if (state.image && activeLut && !lutManager.isBypassed && lutManager.intensity > 0) {
          if (!state.image.originalElement) {
            state.image.originalElement = state.image.element;
          }
          const renderedCanvas = applyLut(
            state.image.originalElement,
            activeLut,
            lutManager.intensity,
            state.image.lutElement || null
          );
          state.image.lutElement = renderedCanvas;
          state.image.element = renderedCanvas;
        } else if (state.image && state.image.originalElement) {
          state.image.element = state.image.originalElement;
        }

        renderFrame(exportCanvas, state, {
          isExport: true,
          targetWidth: width,
          targetHeight: height
        });

        if (onProgress) {
          const pct = Math.round(((frameIndex + 1) / totalFrames) * 100);
          onProgress(`Rendering video frame ${frameIndex + 1}/${totalFrames} (${pct}%)...`);
        }
      }
    } finally {
      this.isRecording = false;
    }

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunks, { type: mimeType });
        const deviceName = state.metadata?.device?.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'Hasselblad';
        const filename = `PocketFrames_${deviceName}_FramedVideo.${ext}`;

        this.video.currentTime = originalTime;
        if (wasPlaying) this.video.play().catch(() => {});

        resolve({ blob, filename });
      };

      recorder.onerror = (err) => reject(err);
      recorder.stop();
    });
  }
}

export const videoManager = new VideoPlaybackManager();
