/**
 * Pocket Frames - Video Player Controls Dock
 * Liquid Glass dock for video playback, timeline scrubbing, and framed video export
 */
import { store } from '../state.js';
import { videoManager } from './videoManager.js';
import { showToast } from '../main.js';
import { downloadFrame } from '../export/exportEngine.js';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export class VideoDock {
  constructor(containerEl) {
    this.container = containerEl || document.getElementById('canvasArea');
    this.dockEl = null;
    this.isScrubbing = false;
    this.init();
  }

  init() {
    this.createDOM();
    this.bindEvents();

    videoManager.subscribe(() => {
      this.syncUI();
    });

    store.subscribe((state, changeType) => {
      if (changeType === 'image' || changeType === 'reset') {
        this.checkVisibility(state);
      }
    });

    this.checkVisibility(store.getState());
  }

  createDOM() {
    let existing = document.getElementById('videoPlayerDock');
    if (existing) existing.remove();

    const dock = document.createElement('div');
    dock.id = 'videoPlayerDock';
    dock.className = 'video-dock glass hidden';
    dock.setAttribute('role', 'toolbar');
    dock.setAttribute('aria-label', 'Video playback controls');

    dock.innerHTML = `
      <div class="video-dock__inner">
        <!-- Play / Pause Button -->
        <button type="button" class="video-btn video-btn--play" id="btnVideoPlayPause" aria-label="Play video" title="Play / Pause (Space)">
          <svg class="icon-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg class="icon-pause hidden" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>

        <!-- Time Counter -->
        <span class="video-time" id="videoTimeReadout">00:00 / 00:00</span>

        <!-- Timeline Scrubber -->
        <div class="video-scrubber-wrap" title="Drag to seek video frame">
          <input type="range" class="video-scrubber" id="videoScrubber" min="0" max="100" step="0.05" value="0" aria-label="Video timeline scrubber">
          <div class="video-scrubber-progress" id="videoScrubberProgress"></div>
        </div>

        <div class="video-dock__sep"></div>

        <!-- Mute Toggle -->
        <button type="button" class="video-icon-btn is-muted" id="btnVideoMute" aria-label="Toggle audio" title="Mute / Unmute">
          <svg class="icon-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
          <svg class="icon-unmuted hidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>

        <!-- Loop Toggle -->
        <button type="button" class="video-icon-btn is-active" id="btnVideoLoop" aria-label="Toggle loop" title="Loop video">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </button>

        <div class="video-dock__sep"></div>

        <!-- Capture Still Button -->
        <button type="button" class="video-action-btn" id="btnCaptureStill" title="Capture current video frame as high-res photo">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
          </svg>
          <span>Capture Still</span>
        </button>

        <!-- Export Framed Video Button -->
        <button type="button" class="video-action-btn video-action-btn--accent" id="btnExportFramedVideo" title="Record and export framed video with filters">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          <span id="exportVideoBtnText">Export Video</span>
        </button>
      </div>
    `;

    // Insert into canvas area right beneath the Polaroid canvas wrapper
    const canvasWrapper = document.getElementById('previewContainer');
    if (canvasWrapper && canvasWrapper.parentNode) {
      canvasWrapper.parentNode.insertBefore(dock, canvasWrapper.nextSibling);
    } else if (this.container) {
      this.container.appendChild(dock);
    }

    this.dockEl = dock;
  }

  checkVisibility(state) {
    if (!this.dockEl) return;
    const isVideo = state.image && (state.image.type === 'video' || state.image.isVideo || state.image.videoElement || state.image.originalElement?.tagName?.toLowerCase() === 'video');

    if (isVideo) {
      this.dockEl.classList.remove('hidden');
      const videoEl = state.image.videoElement || (state.image.originalElement?.tagName?.toLowerCase() === 'video' ? state.image.originalElement : (state.image.element?.tagName?.toLowerCase() === 'video' ? state.image.element : null));
      if (videoEl && typeof videoEl.pause === 'function') {
        videoManager.attach(videoEl);
      }
      this.syncUI();
    } else {
      this.dockEl.classList.add('hidden');
      videoManager.detach();
    }
  }

  bindEvents() {
    const btnPlay = document.getElementById('btnVideoPlayPause');
    const scrubber = document.getElementById('videoScrubber');
    const btnMute = document.getElementById('btnVideoMute');
    const btnLoop = document.getElementById('btnVideoLoop');
    const btnCapture = document.getElementById('btnCaptureStill');
    const btnExport = document.getElementById('btnExportFramedVideo');

    // Play / Pause
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        videoManager.togglePlay();
      });
    }

    // Scrubber
    if (scrubber) {
      scrubber.addEventListener('input', (e) => {
        this.isScrubbing = true;
        const dur = videoManager.getDuration();
        const targetTime = (parseFloat(e.target.value) / 100) * dur;
        videoManager.seek(targetTime);
      });

      scrubber.addEventListener('change', () => {
        this.isScrubbing = false;
      });
    }

    // Mute
    if (btnMute) {
      btnMute.addEventListener('click', () => {
        videoManager.toggleMute();
      });
    }

    // Loop
    if (btnLoop) {
      btnLoop.addEventListener('click', () => {
        videoManager.toggleLoop();
      });
    }

    // Capture Still Photo from video
    if (btnCapture) {
      btnCapture.addEventListener('click', async () => {
        const state = store.getState();
        if (!state.image) return;
        showToast('Capturing Polaroid still frame...');
        try {
          await downloadFrame(state);
          showToast('Still frame downloaded!');
        } catch (err) {
          showToast(`Capture failed: ${err.message}`);
        }
      });
    }

    // Export Framed Video
    if (btnExport) {
      btnExport.addEventListener('click', async () => {
        const state = store.getState();
        const isVideo = state.image && (state.image.type === 'video' || state.image.isVideo || state.image.videoElement);
        if (!isVideo) {
          showToast('Load a video to export.');
          return;
        }

        const btnText = document.getElementById('exportVideoBtnText');
        try {
          btnExport.disabled = true;
          if (btnText) btnText.textContent = 'Recording...';

          const result = await videoManager.exportFramedVideo(state, {
            width: 1080,
            height: 1350,
            fps: 30
          }, (msg) => {
            if (btnText) btnText.textContent = msg;
          });

          // Trigger download
          const url = URL.createObjectURL(result.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 2000);

          showToast('Framed video exported successfully!');
        } catch (err) {
          showToast(`Export error: ${err.message}`);
        } finally {
          btnExport.disabled = false;
          if (btnText) btnText.textContent = 'Export Video';
        }
      });
    }
  }

  syncUI() {
    const btnPlay = document.getElementById('btnVideoPlayPause');
    const iconPlay = btnPlay?.querySelector('.icon-play');
    const iconPause = btnPlay?.querySelector('.icon-pause');
    const timeReadout = document.getElementById('videoTimeReadout');
    const scrubber = document.getElementById('videoScrubber');
    const progressBar = document.getElementById('videoScrubberProgress');
    const btnMute = document.getElementById('btnVideoMute');
    const iconMuted = btnMute?.querySelector('.icon-muted');
    const iconUnmuted = btnMute?.querySelector('.icon-unmuted');
    const btnLoop = document.getElementById('btnVideoLoop');

    const isPlaying = videoManager.isPlaying;
    if (iconPlay) iconPlay.classList.toggle('hidden', isPlaying);
    if (iconPause) iconPause.classList.toggle('hidden', !isPlaying);

    const curr = videoManager.getCurrentTime();
    const dur = videoManager.getDuration();

    if (timeReadout) {
      timeReadout.textContent = `${formatTime(curr)} / ${formatTime(dur)}`;
    }

    if (scrubber && !this.isScrubbing && dur > 0) {
      const pct = (curr / dur) * 100;
      scrubber.value = pct;
      if (progressBar) progressBar.style.width = `${pct}%`;
    }

    // Mute state
    if (btnMute) {
      btnMute.classList.toggle('is-muted', videoManager.isMuted);
      if (iconMuted) iconMuted.classList.toggle('hidden', !videoManager.isMuted);
      if (iconUnmuted) iconUnmuted.classList.toggle('hidden', videoManager.isMuted);
    }

    // Loop state
    if (btnLoop) {
      btnLoop.classList.toggle('is-active', videoManager.isLooping);
    }
  }
}
