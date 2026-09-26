/**
 * Pocket Frames - Video Export Dialog & Live Recording Coordinator
 * Manages real-time framed video export with strict 45-second limit, audio sync, and live progress
 */
import { store } from '../state.js';
import { videoManager } from './videoManager.js';
import { downloadFrame } from '../export/exportEngine.js';
import { showToast } from '../main.js';

export class VideoExportModal {
  constructor() {
    this.modalEl = null;
    this.isOpen = false;
    this.isRecording = false;
    this.createDOM();
    this.bindEvents();
  }

  createDOM() {
    let existing = document.getElementById('videoExportModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'videoExportModal';
    modal.className = 'modal-backdrop hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'videoExportTitle');

    modal.innerHTML = `
      <div class="modal-card video-export-card">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="video-export-header-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="video-export-icon">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            <h3 id="videoExportTitle">Export Framed Video</h3>
          </div>
          <button type="button" id="btnCloseVideoExport" class="icon-btn" aria-label="Close dialog">✕</button>
        </div>

        <!-- Mode 1: Configuration View -->
        <div id="videoExportConfigView" class="video-export-view">
          <!-- Limit & Info Callout Banner -->
          <div class="video-export-banner">
            <div class="video-export-badge">45s Max Limit</div>
            <p class="video-export-banner-text">
              Exports the video playing inside your framed layout with active filters, film borders, and Hasselblad metadata.
            </p>
          </div>

          <!-- Video Parameters Grid -->
          <div class="video-export-fields">
            <!-- Source Video Info -->
            <div class="video-export-row">
              <span class="video-export-label">Source Length</span>
              <span class="video-export-val" id="veSourceLength">00:00</span>
            </div>

            <!-- Start Position -->
            <div class="video-export-field">
              <div class="video-export-field-header">
                <label for="veStartSlider" class="video-export-label">Start Time</label>
                <span class="video-export-val video-export-val--highlight" id="veStartTimeReadout">00:00</span>
              </div>
              <input type="range" id="veStartSlider" class="liquid-slider video-range-slider" min="0" max="60" step="0.1" value="0">
            </div>

            <!-- Target Export Duration -->
            <div class="video-export-field">
              <div class="video-export-field-header">
                <label for="veDurationSlider" class="video-export-label">Export Duration</label>
                <span class="video-export-val video-export-val--highlight" id="veDurationReadout">45.0s</span>
              </div>
              <input type="range" id="veDurationSlider" class="liquid-slider video-range-slider" min="1" max="45" step="0.5" value="45">
              <div class="video-export-slider-hints">
                <span>1s</span>
                <span class="video-export-cap-hint">Max Limit: 45s</span>
              </div>
            </div>

            <!-- Export Details Summary -->
            <div class="video-export-meta-box">
              <div class="video-export-meta-item">
                <span class="video-export-meta-label">Canvas Size</span>
                <span class="video-export-meta-val">1080 × 1350 (4:5 HD)</span>
              </div>
              <div class="video-export-meta-item">
                <span class="video-export-meta-label">Format</span>
                <span class="video-export-meta-val" id="veFormatLabel">MP4 (H.264)</span>
              </div>
              <div class="video-export-meta-item">
                <span class="video-export-meta-label">Frame Rate</span>
                <span class="video-export-meta-val">30 FPS Smooth</span>
              </div>
            </div>

            <!-- Audio Option -->
            <label class="video-export-checkbox-row">
              <input type="checkbox" id="veAudioCheck" checked>
              <span class="video-export-checkbox-label">Include original video audio</span>
            </label>
          </div>

          <!-- Action Buttons -->
          <div class="video-export-actions">
            <button type="button" class="btn--primary video-export-primary-btn" id="btnStartVideoExport">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span id="btnStartVideoExportText">Start Video Export (45s max)</span>
            </button>

            <button type="button" class="btn--secondary video-export-secondary-btn" id="btnExportStillInstead">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
              <span>Capture Still Photo (JPEG) Instead</span>
            </button>
          </div>
        </div>

        <!-- Mode 2: Live Recording Progress View -->
        <div id="videoExportRecordingView" class="video-export-view hidden">
          <div class="video-recording-status">
            <div class="video-recording-live-pill">
              <span class="video-recording-dot"></span>
              <span>REC</span>
            </div>
            <div class="video-recording-timer" id="veLiveTimer">00:00 / 00:45</div>
            <div class="video-recording-pct" id="veLivePercent">0%</div>
          </div>

          <!-- Progress Bar -->
          <div class="video-recording-progress-track">
            <div class="video-recording-progress-fill" id="veLiveProgressFill" style="width: 0%;"></div>
          </div>

          <p class="video-recording-note">
            Playing &amp; recording framed canvas in real-time. Video will automatically stop at 45s limit or click below to save now.
          </p>

          <!-- Recording Controls -->
          <div class="video-recording-actions">
            <button type="button" class="btn--primary video-stop-save-btn" id="btnStopAndSaveVideo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
              <span>Stop &amp; Save Video Now</span>
            </button>
            <button type="button" class="btn--secondary video-cancel-btn" id="btnCancelVideoRecording">
              Cancel
            </button>
          </div>
        </div>

        <!-- Mode 3: Completion View -->
        <div id="videoExportDoneView" class="video-export-view hidden">
          <div class="video-done-container">
            <div class="video-done-check">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h4>Video Saved to Downloads!</h4>
            <p id="veDoneFilename" class="video-done-filename">PocketFrames_FramedVideo.mp4</p>
            <button type="button" class="btn--primary" id="btnVideoDoneClose">Done</button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
    this.modalEl = modal;
  }

  formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  formatDuration(seconds) {
    return `${Number(seconds).toFixed(1)}s`;
  }

  open() {
    const video = videoManager.getVideo();
    if (!video) {
      showToast('Please load a video first.');
      return;
    }

    this.isOpen = true;
    this.isRecording = false;

    // Reset views
    document.getElementById('videoExportConfigView')?.classList.remove('hidden');
    document.getElementById('videoExportRecordingView')?.classList.add('hidden');
    document.getElementById('videoExportDoneView')?.classList.add('hidden');

    const totalDur = video.duration || 10;
    const maxExportLimit = 45.0;

    // Source duration readout
    const veSourceLength = document.getElementById('veSourceLength');
    if (veSourceLength) veSourceLength.textContent = this.formatTime(totalDur);

    // Start slider
    const startSlider = document.getElementById('veStartSlider');
    const maxStart = Math.max(0, totalDur - 1);
    if (startSlider) {
      startSlider.max = maxStart.toString();
      // Set to current scrub time if within range
      const currentScrub = Math.min(video.currentTime || 0, maxStart);
      startSlider.value = currentScrub.toString();
    }
    const startReadout = document.getElementById('veStartTimeReadout');
    if (startReadout) startReadout.textContent = this.formatTime(startSlider?.value || 0);

    // Duration slider: max 45s strictly enforced
    const durSlider = document.getElementById('veDurationSlider');
    const maxPossibleDur = Math.min(maxExportLimit, totalDur - (parseFloat(startSlider?.value || 0)));
    if (durSlider) {
      durSlider.max = Math.min(maxExportLimit, totalDur).toString();
      durSlider.value = Math.max(1, maxPossibleDur).toString();
    }
    const durReadout = document.getElementById('veDurationReadout');
    if (durReadout) durReadout.textContent = this.formatDuration(durSlider?.value || 45);

    // Start button text
    const btnStartText = document.getElementById('btnStartVideoExportText');
    if (btnStartText) {
      btnStartText.textContent = `Start Video Export (${this.formatDuration(durSlider?.value || 45)} max)`;
    }

    // Best supported format label
    const formatLabel = document.getElementById('veFormatLabel');
    if (formatLabel) {
      const isMp4 = typeof MediaRecorder !== 'undefined' && (
        MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ||
        MediaRecorder.isTypeSupported('video/mp4')
      );
      formatLabel.textContent = isMp4 ? 'MP4 (H.264 HD)' : 'WebM (High Fidelity)';
    }

    this.modalEl.classList.remove('hidden');
  }

  close() {
    if (this.isRecording) {
      const confirmCancel = confirm('Video recording is in progress. Do you want to cancel?');
      if (!confirmCancel) return;
      videoManager.cancelRecording();
    }
    this.isOpen = false;
    this.isRecording = false;
    this.modalEl.classList.add('hidden');
  }

  bindEvents() {
    const btnClose = document.getElementById('btnCloseVideoExport');
    const startSlider = document.getElementById('veStartSlider');
    const durSlider = document.getElementById('veDurationSlider');
    const startReadout = document.getElementById('veStartTimeReadout');
    const durReadout = document.getElementById('veDurationReadout');
    const btnStart = document.getElementById('btnStartVideoExport');
    const btnStill = document.getElementById('btnExportStillInstead');
    const btnStopSave = document.getElementById('btnStopAndSaveVideo');
    const btnCancelRec = document.getElementById('btnCancelVideoRecording');
    const btnDoneClose = document.getElementById('btnVideoDoneClose');

    // Close button
    if (btnClose) btnClose.addEventListener('click', () => this.close());

    // Backdrop click
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl && !this.isRecording) {
        this.close();
      }
    });

    // Start slider change
    if (startSlider) {
      startSlider.addEventListener('input', () => {
        const val = parseFloat(startSlider.value) || 0;
        if (startReadout) startReadout.textContent = this.formatTime(val);

        const video = videoManager.getVideo();
        const totalDur = video?.duration || 45;
        const remaining = Math.max(1, totalDur - val);
        const maxDur = Math.min(45, remaining);

        if (durSlider) {
          durSlider.max = maxDur.toString();
          if (parseFloat(durSlider.value) > maxDur) {
            durSlider.value = maxDur.toString();
            if (durReadout) durReadout.textContent = this.formatDuration(maxDur);
          }
        }
        const btnText = document.getElementById('btnStartVideoExportText');
        if (btnText && durSlider) {
          btnText.textContent = `Start Video Export (${this.formatDuration(durSlider.value)} max)`;
        }
      });
    }

    // Duration slider change (capped strictly at 45.0s max)
    if (durSlider) {
      durSlider.addEventListener('input', () => {
        const val = Math.min(45, parseFloat(durSlider.value) || 45);
        if (durReadout) durReadout.textContent = this.formatDuration(val);
        const btnText = document.getElementById('btnStartVideoExportText');
        if (btnText) {
          btnText.textContent = `Start Video Export (${this.formatDuration(val)} max)`;
        }
      });
    }

    // Capture Still Photo Instead
    if (btnStill) {
      btnStill.addEventListener('click', async () => {
        this.close();
        const state = store.getState();
        showToast('Capturing still frame...');
        try {
          await downloadFrame(state);
          showToast('Still frame downloaded!');
        } catch (err) {
          showToast(`Capture failed: ${err.message}`);
        }
      });
    }

    // Start Video Export
    if (btnStart) {
      btnStart.addEventListener('click', () => this.startExport());
    }

    // Stop and save video immediately
    if (btnStopSave) {
      btnStopSave.addEventListener('click', () => {
        showToast('Finishing video recording...');
        videoManager.stopRecording();
      });
    }

    // Cancel recording
    if (btnCancelRec) {
      btnCancelRec.addEventListener('click', () => {
        videoManager.cancelRecording();
        this.close();
        showToast('Video export cancelled.');
      });
    }

    // Done Close button
    if (btnDoneClose) {
      btnDoneClose.addEventListener('click', () => this.close());
    }
  }

  async startExport() {
    const video = videoManager.getVideo();
    if (!video) {
      showToast('No video available to export.');
      return;
    }

    const startSlider = document.getElementById('veStartSlider');
    const durSlider = document.getElementById('veDurationSlider');
    const audioCheck = document.getElementById('veAudioCheck');

    const startTime = Math.max(0, parseFloat(startSlider?.value || 0));
    // Hard cap at 45.0s maximum limit
    const targetDuration = Math.min(45.0, Math.max(1.0, parseFloat(durSlider?.value || 45.0)));
    const includeAudio = audioCheck ? audioCheck.checked : true;

    // Switch to Mode 2: Live Recording Progress
    this.isRecording = true;
    document.getElementById('videoExportConfigView')?.classList.add('hidden');
    document.getElementById('videoExportRecordingView')?.classList.remove('hidden');

    const liveTimer = document.getElementById('veLiveTimer');
    const livePercent = document.getElementById('veLivePercent');
    const liveProgressFill = document.getElementById('veLiveProgressFill');

    if (liveTimer) liveTimer.textContent = `00:00 / ${this.formatTime(targetDuration)}`;
    if (livePercent) livePercent.textContent = '0%';
    if (liveProgressFill) liveProgressFill.style.width = '0%';

    const state = store.getState();

    try {
      const result = await videoManager.exportFramedVideo(state, {
        startTime,
        duration: targetDuration,
        width: 1080,
        height: 1350,
        fps: 30,
        includeAudio
      }, (progress) => {
        if (liveTimer) {
          liveTimer.textContent = `${this.formatTime(progress.currentSec)} / ${this.formatTime(progress.totalSec)}`;
        }
        if (livePercent) {
          livePercent.textContent = `${progress.percent}%`;
        }
        if (liveProgressFill) {
          liveProgressFill.style.width = `${progress.percent}%`;
        }
      });

      if (!result || !result.blob) return;

      // Trigger automatic browser download
      const blobUrl = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);

      // Switch to Mode 3: Done View
      this.isRecording = false;
      document.getElementById('videoExportRecordingView')?.classList.add('hidden');
      document.getElementById('videoExportDoneView')?.classList.remove('hidden');

      const doneFilename = document.getElementById('veDoneFilename');
      if (doneFilename) {
        doneFilename.textContent = `${result.filename} (${this.formatDuration(result.duration || targetDuration)})`;
      }

      showToast('Framed video exported successfully!');

      // Automatically auto-close after 2.5s
      setTimeout(() => {
        if (this.isOpen && !this.isRecording) {
          this.close();
        }
      }, 2500);

    } catch (err) {
      this.isRecording = false;
      if (err.message && err.message.includes('cancelled')) {
        this.close();
      } else {
        showToast(`Video export failed: ${err.message}`);
        // Reset back to config view
        document.getElementById('videoExportRecordingView')?.classList.add('hidden');
        document.getElementById('videoExportConfigView')?.classList.remove('hidden');
      }
    }
  }
}

export const videoExportModal = new VideoExportModal();
