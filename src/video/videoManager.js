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
   * Stop active recording and save output immediately
   */
  stopRecording() {
    if (this._stopRecordingFn) {
      this._stopRecordingFn();
    }
  }

  /**
   * Cancel active recording without saving
   */
  cancelRecording() {
    this._abortRecording = true;
    if (this._cancelRecordingFn) {
      this._cancelRecordingFn();
    }
  }

  /**
   * Render single master export frame with 3D LUT grading onto export canvas
   */
  renderFrameForExport(exportCanvas, state, width, height) {
    const video = this.getVideo();
    if (!video) return;

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
  }

  /**
   * Export framed video with 3D LUT grading, Polaroid borders, and Hasselblad metadata
   * Strict max 45.0s limit, real-time audio sync, and live progress reporting
   */
  async exportFramedVideo(state, options = {}, onProgress = null) {
    const video = this.getVideo();
    if (!video || typeof video.pause !== 'function') {
      throw new Error('No video loaded to export.');
    }

    const MAX_ALLOWED_SECONDS = 45.0; // Hard max limit requested by user
    const {
      width = 1080,
      height = 1350,
      fps = 30,
      startTime = 0,
      duration = 45.0,
      includeAudio = true
    } = options;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;

    if (!exportCanvas.captureStream && !exportCanvas.mozCaptureStream) {
      throw new Error('Canvas video capture is not supported by your browser.');
    }

    const stream = exportCanvas.captureStream ? exportCanvas.captureStream(fps) : exportCanvas.mozCaptureStream(fps);

    // Audio capture if requested and present
    let audioTrackAdded = false;
    if (includeAudio) {
      try {
        let vStream = null;
        if (typeof video.captureStream === 'function') {
          vStream = video.captureStream();
        } else if (typeof video.mozCaptureStream === 'function') {
          vStream = video.mozCaptureStream();
        }
        if (vStream) {
          const audioTracks = vStream.getAudioTracks();
          if (audioTracks && audioTracks.length > 0) {
            stream.addTrack(audioTracks[0]);
            audioTrackAdded = true;
          }
        }
      } catch (e) {
        console.warn('[VideoManager] Audio capture notice:', e);
      }
    }

    // Determine highest-fidelity supported mime type
    const candidateMimes = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    let mimeType = 'video/webm';
    for (const mime of candidateMimes) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        mimeType = mime;
        break;
      }
    }

    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 9000000 // 9 Mbps high bitrate for crisp video & metadata text
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    // Calculate strict duration boundaries
    const totalVideoDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : MAX_ALLOWED_SECONDS;
    const startSec = Math.max(0, Math.min(totalVideoDur - 0.5, Number(startTime) || 0));
    const availableDur = Math.max(0.5, totalVideoDur - startSec);
    const targetDuration = Math.min(MAX_ALLOWED_SECONDS, Math.max(0.5, Number(duration) || availableDur), availableDur);

    // Save initial state to restore after export
    const wasPlaying = !video.paused;
    const originalTime = video.currentTime;
    const originalMuted = video.muted;
    const originalLoop = video.loop;

    this.isRecording = true;
    this._abortRecording = false;

    // Seek to start position
    video.pause();
    video.loop = false;
    video.currentTime = startSec;

    await new Promise(resolve => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked, { once: true });
      setTimeout(onSeeked, 300);
    });

    // Initial frame render
    this.renderFrameForExport(exportCanvas, state, width, height);

    // Unmute during export so captureStream audio track streams sound
    if (audioTrackAdded) {
      video.muted = false;
    }

    recorder.start(100);

    try {
      await video.play().catch(err => {
        console.warn('[VideoManager] Play prevented during export:', err);
      });

      await new Promise((resolve) => {
        let animId = null;
        let isStopped = false;
        const startWallTime = performance.now();

        const finishRecording = (cancelled = false) => {
          if (isStopped) return;
          isStopped = true;
          if (animId) cancelAnimationFrame(animId);

          if (recorder.state !== 'inactive') {
            recorder.onstop = () => resolve({ cancelled });
            recorder.stop();
          } else {
            resolve({ cancelled });
          }
        };

        this._stopRecordingFn = () => finishRecording(false);
        this._cancelRecordingFn = () => finishRecording(true);

        const onFrame = () => {
          if (this._abortRecording) {
            finishRecording(true);
            return;
          }

          // Measure elapsed time from video clock and wall clock for resilience
          const elapsedVideo = Math.max(0, video.currentTime - startSec);
          const elapsedWall = (performance.now() - startWallTime) / 1000;
          const elapsed = Math.max(elapsedVideo, elapsedWall);
          const progressPct = Math.min(100, Math.round((elapsed / targetDuration) * 100));

          // Render live frame onto export canvas
          this.renderFrameForExport(exportCanvas, state, width, height);

          if (onProgress) {
            onProgress({
              currentSec: Math.min(elapsed, targetDuration),
              totalSec: targetDuration,
              percent: progressPct
            });
          }

          // Strict termination: when duration reached or video ended or 45s reached
          if (elapsed >= targetDuration || video.currentTime >= (startSec + targetDuration) || video.ended) {
            finishRecording(false);
            return;
          }

          animId = requestAnimationFrame(onFrame);
        };

        animId = requestAnimationFrame(onFrame);
      });
    } finally {
      this.isRecording = false;
      this._stopRecordingFn = null;
      this._cancelRecordingFn = null;

      // Restore video playback state
      video.pause();
      video.currentTime = originalTime;
      video.muted = originalMuted;
      video.loop = originalLoop;
      if (wasPlaying) video.play().catch(() => {});
    }

    if (this._abortRecording) {
      throw new Error('Export cancelled by user.');
    }

    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: mimeType });
    const deviceName = (state.metadata?.device || 'Hasselblad').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'Hasselblad';
    const filename = `PocketFrames_${deviceName}_FramedVideo.${ext}`;

    return { blob, filename, ext, duration: targetDuration };
  }
}

export const videoManager = new VideoPlaybackManager();
