/**
 * Pocket Frames - Hasselblad Secret Backgate Modal
 * Professional 3D LUT Color Lab for .cube files
 */
import { store } from '../state.js';
import { lutManager } from './lutManager.js';
import { exportCubeLutToString } from './lutParser.js';
import { generateLutThumbnail } from './lutProcessor.js';
import { showToast } from '../main.js';

export class LutBackdoorModal {
  constructor() {
    this.modalEl = null;
    this.isOpen = false;
    this.currentTab = 'all'; // 'all', 'presets', 'custom'
    this.isComparing = false;
    this.init();
  }

  init() {
    this.createModalDOM();
    this.bindEvents();
    lutManager.subscribe(() => {
      if (this.isOpen) {
        this.renderLutList();
        this.updateActiveLutControls();
      }
      this.updateTopbarIndicator();
    });
  }

  createModalDOM() {
    const modal = document.createElement('div');
    modal.id = 'lutBackdoorModal';
    modal.className = 'lut-modal-backdrop hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'lutModalTitle');

    modal.innerHTML = `
      <div class="lut-modal glass" id="lutModalContainer">
        <!-- Header -->
        <div class="lut-modal__header">
          <div class="lut-header-left">
            <div class="lut-badge">
              <span class="lut-badge__dot"></span>
              <span class="lut-badge__text">HASSELBLAD DEV BACKGATE</span>
            </div>
            <h2 id="lutModalTitle" class="lut-modal__title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                <path d="M2 12h20"/>
              </svg>
              3D LUT Color Lab
            </h2>
            <p class="lut-modal__subtitle">Apply professional .cube 3D lookup tables with real-time GPU hardware interpolation.</p>
          </div>
          <div class="lut-header-right">
            <button class="lut-icon-btn" id="btnResetLut" title="Clear Active LUT">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              <span>Reset</span>
            </button>
            <button class="lut-close-btn" id="btnCloseLutModal" aria-label="Close Backgate">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        <div class="lut-modal__body">
          <!-- Top Row: File Dropzone & Active Controls -->
          <div class="lut-top-controls">
            <!-- Upload Dropzone -->
            <div class="lut-dropzone" id="lutDropzone">
              <input type="file" id="lutFileInput" accept=".cube" multiple class="lut-hidden-file-input">
              <div class="lut-dropzone__icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <div class="lut-dropzone__content">
                <span class="lut-dropzone__main">Drop .CUBE files here, or <span class="lut-link">browse</span></span>
                <span class="lut-dropzone__sub">Adobe / DaVinci Resolve 3D LUT format (16³, 17³, 33³, 64³)</span>
              </div>
            </div>

            <!-- Active LUT Panel -->
            <div class="lut-active-card" id="lutActiveCard">
              <div class="lut-active-card__meta">
                <span class="lut-label">Active Color Grade</span>
                <div class="lut-active-title" id="lutActiveTitle">No LUT applied (Original photograph)</div>
                <div class="lut-active-sub" id="lutActiveSub">Select a preset below or import your own .cube file</div>
              </div>

              <!-- Intensity Slider -->
              <div class="lut-intensity-group">
                <div class="lut-intensity-header">
                  <span class="lut-intensity-label">LUT Intensity</span>
                  <span class="lut-intensity-val" id="lutIntensityVal">100%</span>
                </div>
                <div class="lut-slider-row">
                  <input type="range" min="0" max="1" step="0.01" value="1" id="lutIntensitySlider" class="lut-slider">
                </div>
                <div class="lut-quick-presets">
                  <button type="button" class="lut-chip-btn" data-val="0.25">25%</button>
                  <button type="button" class="lut-chip-btn" data-val="0.50">50%</button>
                  <button type="button" class="lut-chip-btn" data-val="0.75">75%</button>
                  <button type="button" class="lut-chip-btn is-active" data-val="1.00">100%</button>
                </div>
              </div>

              <!-- Action Bar -->
              <div class="lut-actions-bar">
                <button type="button" class="lut-action-btn" id="btnHoldCompare" title="Click and hold to compare with un-graded original">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span>Hold to Compare</span>
                </button>
                <button type="button" class="lut-action-btn" id="btnToggleBypass" title="Toggle temporary LUT bypass">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  <span id="btnBypassText">Bypass</span>
                </button>
                <button type="button" class="lut-action-btn" id="btnExportCube" title="Export this .cube file" disabled>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Export .cube</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Filter Category Tabs -->
          <div class="lut-category-tabs">
            <button type="button" class="lut-tab-btn is-active" data-tab="all">All LUTs (<span id="countAll">0</span>)</button>
            <button type="button" class="lut-tab-btn" data-tab="presets">Calibrated Presets (<span id="countPresets">0</span>)</button>
            <button type="button" class="lut-tab-btn" data-tab="custom">Custom Vault (<span id="countCustom">0</span>)</button>
          </div>

          <!-- LUT Cards Grid -->
          <div class="lut-grid-scroll">
            <div class="lut-grid" id="lutCardsGrid">
              <!-- Dynamically populated -->
            </div>
          </div>

          <!-- Bottom Notice -->
          <div class="lut-footer-tip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>Triple-click on the Hasselblad switch button anytime to reopen this secret color vault. All custom .cube uploads persist locally in your browser.</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalEl = modal;

    // Add Topbar Indicator Pill into format-chips area
    this.createTopbarIndicator();
  }

  createTopbarIndicator() {
    const formatChips = document.getElementById('pf-format-chips');
    if (!formatChips) return;

    let chip = document.getElementById('lutTopbarChip');
    if (!chip) {
      chip = document.createElement('button');
      chip.id = 'lutTopbarChip';
      chip.className = 'lut-topbar-chip hidden';
      chip.title = 'Hasselblad Color Lab active - Click to adjust LUT';
      chip.innerHTML = `
        <span class="lut-chip-pulse"></span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/></svg>
        <span id="lutTopbarChipText">LUT: None</span>
      `;
      chip.addEventListener('click', () => this.open());
      formatChips.appendChild(chip);
    }
  }

  updateTopbarIndicator() {
    const chip = document.getElementById('lutTopbarChip');
    const chipText = document.getElementById('lutTopbarChipText');
    const tabHasselblad = document.getElementById('tab-hasselblad');

    if (!chip || !chipText) return;

    if (lutManager.activeLut && !lutManager.isBypassed && lutManager.intensity > 0) {
      const pct = Math.round(lutManager.intensity * 100);
      chipText.textContent = `LUT: ${lutManager.activeLut.title} (${pct}%)`;
      chip.classList.remove('hidden');
      if (tabHasselblad) tabHasselblad.classList.add('has-active-lut');
    } else {
      chip.classList.add('hidden');
      if (tabHasselblad) tabHasselblad.classList.remove('has-active-lut');
    }
  }

  bindEvents() {
    const btnClose = document.getElementById('btnCloseLutModal');
    const btnReset = document.getElementById('btnResetLut');
    const dropzone = document.getElementById('lutDropzone');
    const fileInput = document.getElementById('lutFileInput');
    const slider = document.getElementById('lutIntensitySlider');
    const btnCompare = document.getElementById('btnHoldCompare');
    const btnBypass = document.getElementById('btnToggleBypass');
    const btnExport = document.getElementById('btnExportCube');

    // Close on backdrop or X
    if (btnClose) btnClose.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    // ESC key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Reset button
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        lutManager.clearLut();
        showToast('Color grade reset to original.');
      });
    }

    // Category Tabs
    const tabBtns = this.modalEl.querySelectorAll('.lut-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.currentTab = btn.dataset.tab;
        this.renderLutList();
      });
    });

    // Intensity Slider
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        lutManager.setIntensity(val, true);
        this.updateIntensityDisplay(val);
      });
    }

    // Quick Intensity Preset Chips
    const quickChips = this.modalEl.querySelectorAll('.lut-chip-btn');
    quickChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const val = parseFloat(chip.dataset.val);
        if (slider) slider.value = val;
        lutManager.setIntensity(val, true);
        this.updateIntensityDisplay(val);
      });
    });

    // Hold to Compare
    if (btnCompare) {
      const startCompare = (e) => {
        e.preventDefault();
        if (!lutManager.activeLut) return;
        this.isComparing = true;
        btnCompare.classList.add('is-active');
        lutManager.setBypass(true);
      };
      const endCompare = (e) => {
        e.preventDefault();
        if (!this.isComparing) return;
        this.isComparing = false;
        btnCompare.classList.remove('is-active');
        lutManager.setBypass(false);
      };

      btnCompare.addEventListener('mousedown', startCompare);
      window.addEventListener('mouseup', endCompare);
      btnCompare.addEventListener('touchstart', startCompare, { passive: false });
      window.addEventListener('touchend', endCompare);
    }

    // Toggle Bypass
    if (btnBypass) {
      btnBypass.addEventListener('click', () => {
        const nextState = !lutManager.isBypassed;
        lutManager.setBypass(nextState);
        btnBypass.classList.toggle('is-active', nextState);
        const textEl = document.getElementById('btnBypassText');
        if (textEl) textEl.textContent = nextState ? 'Bypassed' : 'Bypass';
      });
    }

    // Export .cube
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        if (!lutManager.activeLut) return;
        const cubeText = lutManager.activeLut.rawText || exportCubeLutToString(lutManager.activeLut);
        const blob = new Blob([cubeText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = lutManager.activeLut.filename || `${lutManager.activeLut.title.replace(/\s+/g, '_')}.cube`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Exported ${a.download}`);
      });
    }

    // Dropzone File Upload
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('is-dragover');
      });

      ['dragleave', 'dragend'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('is-dragover');
        });
      });

      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('is-dragover');

        const files = Array.from(e.dataTransfer?.files || []).filter(f => f.name.toLowerCase().endsWith('.cube'));
        if (files.length === 0) {
          showToast('Please drop standard .cube files.');
          return;
        }

        await this.handleFiles(files);
      });

      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
          await this.handleFiles(files);
        }
        fileInput.value = '';
      });
    }
  }

  async handleFiles(files) {
    let successCount = 0;
    for (const file of files) {
      try {
        const lut = await lutManager.importCubeFile(file);
        successCount++;
        // Auto-select the newly uploaded LUT
        await lutManager.selectLut(lut);
      } catch (err) {
        showToast(`Error in ${file.name}: ${err.message}`);
      }
    }

    if (successCount > 0) {
      showToast(`Imported ${successCount} .cube LUT${successCount > 1 ? 's' : ''} to vault.`);
      this.currentTab = 'custom';
      const customTabBtn = this.modalEl.querySelector('[data-tab="custom"]');
      if (customTabBtn) {
        this.modalEl.querySelectorAll('.lut-tab-btn').forEach(b => b.classList.remove('is-active'));
        customTabBtn.classList.add('is-active');
      }
      this.renderLutList();
    }
  }

  updateIntensityDisplay(val) {
    const valText = document.getElementById('lutIntensityVal');
    if (valText) {
      valText.textContent = `${Math.round(val * 100)}%`;
    }

    const quickChips = this.modalEl.querySelectorAll('.lut-chip-btn');
    quickChips.forEach(chip => {
      const chipVal = parseFloat(chip.dataset.val);
      chip.classList.toggle('is-active', Math.abs(chipVal - val) < 0.02);
    });
  }

  updateActiveLutControls() {
    const titleEl = document.getElementById('lutActiveTitle');
    const subEl = document.getElementById('lutActiveSub');
    const slider = document.getElementById('lutIntensitySlider');
    const btnExport = document.getElementById('btnExportCube');
    const btnBypass = document.getElementById('btnToggleBypass');
    const btnBypassText = document.getElementById('btnBypassText');

    if (slider) {
      slider.value = lutManager.intensity;
      this.updateIntensityDisplay(lutManager.intensity);
    }

    if (btnExport) {
      btnExport.disabled = !lutManager.activeLut;
    }

    if (btnBypass && btnBypassText) {
      btnBypass.classList.toggle('is-active', lutManager.isBypassed);
      btnBypassText.textContent = lutManager.isBypassed ? 'Bypassed' : 'Bypass';
    }

    if (lutManager.activeLut) {
      const lut = lutManager.activeLut;
      const typeStr = lut.type === '3D' ? `${lut.size}³ 3D LUT` : `${lut.size} 1D LUT`;
      const pointsStr = lut.totalPoints ? `${lut.totalPoints.toLocaleString()} points` : '';
      if (titleEl) titleEl.textContent = lut.title;
      if (subEl) subEl.textContent = `${typeStr} • ${lut.isBuiltin ? 'Calibrated Hasselblad Preset' : 'Custom Imported Vault'} • ${pointsStr}`;
    } else {
      if (titleEl) titleEl.textContent = 'No LUT applied (Pass-through)';
      if (subEl) subEl.textContent = 'Select a preset below or import your own .cube file';
    }
  }

  renderLutList() {
    const grid = document.getElementById('lutCardsGrid');
    const countAll = document.getElementById('countAll');
    const countPresets = document.getElementById('countPresets');
    const countCustom = document.getElementById('countCustom');

    if (!grid) return;

    const allLuts = lutManager.getAllLuts();
    const presets = lutManager.builtinPresets;
    const custom = lutManager.customLuts;

    if (countAll) countAll.textContent = allLuts.length;
    if (countPresets) countPresets.textContent = presets.length;
    if (countCustom) countCustom.textContent = custom.length;

    let targetLuts = allLuts;
    if (this.currentTab === 'presets') targetLuts = presets;
    if (this.currentTab === 'custom') targetLuts = custom;

    grid.innerHTML = '';

    if (targetLuts.length === 0) {
      grid.innerHTML = `
        <div class="lut-empty-vault">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/></svg>
          <p>No custom LUTs imported yet.</p>
          <p class="lut-empty-vault__sub">Drag & drop your .cube files above to store them in your local vault.</p>
        </div>
      `;
      return;
    }

    // Current source image for thumbnails if loaded
    const currentImg = store.getState().image?.originalElement || null;

    targetLuts.forEach(lut => {
      const isSelected = lutManager.activeLut && lutManager.activeLut.id === lut.id;
      const card = document.createElement('div');
      card.className = `lut-card ${isSelected ? 'is-selected' : ''}`;
      card.dataset.lutId = lut.id;

      // Swatch thumbnail preview
      const thumb = generateLutThumbnail(lut, currentImg, 72);
      thumb.className = 'lut-card__thumb';

      const typeLabel = lut.type === '3D' ? `${lut.size}³` : `${lut.size}`;
      const category = lut.category || (lut.isBuiltin ? 'Preset' : 'Custom Vault');

      card.innerHTML = `
        <div class="lut-card__preview-wrap">
          <div class="lut-card__thumb-slot"></div>
          ${isSelected ? '<span class="lut-card__check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
        </div>
        <div class="lut-card__info">
          <div class="lut-card__title-row">
            <span class="lut-card__title" title="${lut.title}">${lut.title}</span>
          </div>
          <div class="lut-card__tags">
            <span class="lut-pill lut-pill--cat">${category}</span>
            <span class="lut-pill lut-pill--size">${typeLabel}</span>
          </div>
          ${lut.description ? `<p class="lut-card__desc">${lut.description}</p>` : ''}
        </div>
        ${!lut.isBuiltin ? `
          <button type="button" class="lut-card__del-btn" data-del-id="${lut.id}" title="Delete LUT from vault">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        ` : ''}
      `;

      card.querySelector('.lut-card__thumb-slot')?.appendChild(thumb);

      // Card selection click
      card.addEventListener('click', (e) => {
        if (e.target.closest('.lut-card__del-btn')) return;
        lutManager.selectLut(lut);
        showToast(`Applied ${lut.title}`);
      });

      // Delete button click
      const delBtn = card.querySelector('.lut-card__del-btn');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Remove "${lut.title}" from your vault?`)) {
            await lutManager.deleteLut(lut.id);
            showToast(`Deleted ${lut.title}`);
          }
        });
      }

      grid.appendChild(card);
    });
  }

  async open() {
    await lutManager.init();
    this.isOpen = true;
    this.modalEl.classList.remove('hidden');
    document.body.classList.add('lut-modal-open');
    this.renderLutList();
    this.updateActiveLutControls();
  }

  close() {
    this.isOpen = false;
    this.modalEl.classList.add('hidden');
    document.body.classList.remove('lut-modal-open');
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}
