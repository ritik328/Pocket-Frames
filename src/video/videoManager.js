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

  getVideo() {
    if (this.video && typeof this.video.pause === 'function') {
      return this.video;
    }
    const state = store.getState();
    const candidate = state.image?.videoElement || (state.image?.originalElement?.tagName?.toLowerCase() === 'video' ? state.image.originalElement : null);
    if (candidate && typeof candidate.pause === 'function') {
      this.video = candidate;
      return candidate;
    }
    return null;
  }

  attach(videoElement) {
    let target = videoElement;
    if (!target || typeof target.pause !== 'function') {
      target = this.getVideo();
    }
    if (!target || typeof target.pause !== 'function') {
      console.warn('[VideoManager] attach() did not find a valid video element');
      return;
    }

    if (this.video === target) return;
    this.detach();

    this.video = target;
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
      if (typeof this.video.pause === 'function') {
        this.video.pause();
      }
      this.video = null;
    }
    this.isPlaying = false;
    this.notify();
  }

  play() {
    const v = this.getVideo();
    if (v && typeof v.play === 'function') {
      v.play().catch(e => console.warn('[VideoManager] Play prevented:', e));
    }
  }

  pause() {
    const v = this.getVideo();
    if (v && typeof v.pause === 'function') {
      v.pause();
    }
  }

  togglePlay() {
    const v = this.getVideo();
    if (!v) return;
    if (v.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  seek(timeInSeconds) {
    const v = this.getVideo();
    if (!v) return;
    const dur = v.duration || 1;
    v.currentTime = Math.max(0, Math.min(dur, timeInSeconds));
    this.renderFrame();
    this.notify();
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    const v = this.getVideo();
    if (v) {
      v.muted = this.isMuted;
    }
    this.notify();
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
  }

  setLooping(loop) {
    this.isLooping = Boolean(loop);
    const v = this.getVideo();
    if (v) {
      v.loop = this.isLooping;
    }
    this.notify();
  }

  toggleLoop() {
    this.setLooping(!this.isLooping);
  }

  getCurrentTime() {
    const v = this.getVideo();
    return v?.currentTime || 0;
  }

  getDuration() {
    const v = this.getVideo();
    return v?.duration || 0;
  }

  startRenderLoop() {
    this.stopRenderLoop();
    const v = this.getVideo();
    if (!v) return;

    const tick = () => {
      const currentVideo = this.getVideo();
      if (!currentVideo || currentVideo.paused || currentVideo.ended) {
        return;
      }

      this.renderFrame();

      if ('requestVideoFrameCallback' in currentVideo) {
        this.rvfcId = currentVideo.requestVideoFrameCallback(tick);
      } else {
        this.rafId = requestAnimationFrame(tick);
      }
    };

    if ('requestVideoFrameCallback' in v) {
      this.rvfcId = v.requestVideoFrameCallback(tick);
    } else {
      this.rafId = requestAnimationFrame(tick);
    }
  }

  stopRenderLoop() {
    const v = this.getVideo();
    if (v && this.rvfcId && 'cancelVideoFrameCallback' in v) {
      v.cancelVideoFrameCallback(this.rvfcId);
      this.rvfcId = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  renderFrame() {
    const video = this.getVideo();
    if (!video) return;

    // Apply active or hover-previewed 3D LUT to the current video frame in real time
    const activeLut = lutManager.previewHoverLut || (lutManager.isBypassed ? null : lutManager.activeLut);
    const state = store.getState();
    if (state.image && activeLut && lutManager.intensity > 0) {
      const renderedCanvas = applyLut(
        video,
        activeLut,
        lutManager.intensity,
        state.image.lutElement || null
      );
      state.image.lutElement = renderedCanvas;
      state.image.element = renderedCanvas;
    } else if (state.image) {
      state.image.element = video;
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
    const video = this.getVideo();
    if (!video || typeof video.pause !== 'function') {
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

    if (!exportCanvas.captureStream && !exportCanvas.mozCaptureStream) {
      throw new Error('Canvas video capture is not supported by your browser.');
    }

    const stream = exportCanvas.captureStream ? exportCanvas.captureStream(fps) : exportCanvas.mozCaptureStream(fps);

    // Capture audio track if present
    try {
      if (video.captureStream) {
        const audioTracks = video.captureStream().getAudioTracks();
        if (audioTracks.length > 0) stream.addTrack(audioTracks[0]);
      } else if (video.mozCaptureStream) {
        const audioTracks = video.mozCaptureStream().getAudioTracks();
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

    const wasPlaying = !video.paused;
    video.pause();
    this.isRecording = true;

    const originalTime = video.currentTime;
    const duration = video.duration || 10;
    const totalFrames = Math.max(1, Math.round(duration * fps));
    const frameInterval = 1 / fps;

    recorder.start();

    try {
      const videoTrack = stream.getVideoTracks ? stream.getVideoTracks()[0] : null;

      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        const targetTime = frameIndex * frameInterval;
        video.currentTime = targetTime;

        await new Promise(resolve => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked, { once: true });
          setTimeout(onSeeked, 150);
        });

        // Grade frame with active LUT
        const activeLut = lutManager.activeLut;
        if (state.image && activeLut && !lutManager.isBypassed && lutManager.intensity > 0) {
          const renderedCanvas = applyLut(
            video,
            activeLut,
            lutManager.intensity,
            state.image.lutElement || null
          );
          state.image.lutElement = renderedCanvas;
          state.image.element = renderedCanvas;
        } else if (state.image) {
          state.image.element = video;
        }

        renderFrame(exportCanvas, state, {
          isExport: true,
          targetWidth: width,
          targetHeight: height
        });

        if (videoTrack && typeof videoTrack.requestFrame === 'function') {
          videoTrack.requestFrame();
        }

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

        video.currentTime = originalTime;
        if (wasPlaying) video.play().catch(() => {});

        resolve({ blob, filename });
      };

      recorder.onerror = (err) => reject(err);
      recorder.stop();
    });
  }
}

export const videoManager = new VideoPlaybackManager();
