/**
 * Pocket Frames - On-Page Hasselblad Color Grading Controller
 * Synchronizes with lutManager to apply, preview, and adjust 3D LUTs directly on the Hasselblad page
 */
import { lutManager } from './lutManager.js';
import { showToast } from '../main.js';

export class SidebarLutControl {
  constructor(backdoorModalProvider) {
    this.getBackdoorModal = backdoorModalProvider;
    this.stripEl = document.getElementById('sidebarLutPillStrip');
    this.selectEl = document.getElementById('sidebarLutSelect');
    this.sliderEl = document.getElementById('sidebarLutSlider');
    this.intensityValEl = document.getElementById('sidebarLutIntensityValue');
    this.intensityPercentEl = document.getElementById('sidebarLutIntensityPercent');
    this.btnCompare = document.getElementById('sidebarBtnCompare');
    this.btnBypass = document.getElementById('sidebarBtnBypass');
    this.btnReset = document.getElementById('sidebarBtnReset');
    this.btnBackdoor = document.getElementById('sidebarBtnBackdoor');

    this.isComparing = false;
    this.init();
  }

  init() {
    this.bindEvents();
    this.render();
    lutManager.subscribe(() => {
      this.syncUI();
    });
  }

  bindEvents() {
    // Slider
    if (this.sliderEl) {
      this.sliderEl.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        lutManager.setIntensity(val, true);
        this.updateIntensityDisplay(val);
      });
    }

    // Select dropdown
    if (this.selectEl) {
      this.selectEl.addEventListener('change', (e) => {
        const lutId = e.target.value;
        if (!lutId) {
          lutManager.clearLut();
          showToast('Original photo (No LUT)');
        } else {
          const lut = lutManager.findLutById(lutId);
          if (lut) {
            lutManager.selectLut(lut);
            showToast(`Applied ${lut.title}`);
          }
        }
      });
    }

    // Reset button
    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => {
        lutManager.clearLut();
        showToast('Color grade reset to original');
      });
    }

    // Bypass button
    if (this.btnBypass) {
      this.btnBypass.addEventListener('click', () => {
        const next = !lutManager.isBypassed;
        lutManager.setBypass(next);
        this.btnBypass.classList.toggle('tool-btn--accent', next);
        showToast(next ? 'LUT bypassed (viewing original)' : 'LUT re-enabled');
      });
    }

    // Hold to Compare
    if (this.btnCompare) {
      const startCompare = (e) => {
        e.preventDefault();
        if (!lutManager.activeLut) return;
        this.isComparing = true;
        this.btnCompare.classList.add('tool-btn--accent');
        lutManager.setBypass(true);
      };
      const endCompare = (e) => {
        e.preventDefault();
        if (!this.isComparing) return;
        this.isComparing = false;
        this.btnCompare.classList.remove('tool-btn--accent');
        lutManager.setBypass(false);
      };

      this.btnCompare.addEventListener('mousedown', startCompare);
      window.addEventListener('mouseup', endCompare);
      this.btnCompare.addEventListener('touchstart', startCompare, { passive: false });
      window.addEventListener('touchend', endCompare);
    }

    // Backstage button
    if (this.btnBackdoor) {
      this.btnBackdoor.addEventListener('click', () => {
        const modal = this.getBackdoorModal ? this.getBackdoorModal() : null;
        if (modal) {
          modal.open();
        }
      });
    }
  }

  updateIntensityDisplay(val) {
    const pct = `${Math.round(val * 100)}%`;
    if (this.intensityValEl) this.intensityValEl.textContent = pct;
    if (this.intensityPercentEl) this.intensityPercentEl.textContent = pct;
  }

  render() {
    this.renderPills();
    this.renderSelect();
    this.syncUI();
  }

  renderPills() {
    if (!this.stripEl) return;
    this.stripEl.innerHTML = '';

    // "None (Original)" pill
    const nonePill = document.createElement('button');
    nonePill.type = 'button';
    nonePill.className = `lut-pill-item ${!lutManager.activeLut ? 'is-active' : ''}`;
    nonePill.dataset.lutId = '';
    nonePill.title = 'Original Photograph';
    nonePill.innerHTML = `
      <span class="lut-pill-dot" style="background: var(--text-faint);"></span>
      <span>Original</span>
    `;
    nonePill.addEventListener('click', () => {
      lutManager.clearLut();
      showToast('Original photo');
    });
    this.stripEl.appendChild(nonePill);

    // Preset pills
    const presets = lutManager.builtinPresets || [];
    presets.forEach(preset => {
      const isSelected = lutManager.activeLut && lutManager.activeLut.id === preset.id;
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `lut-pill-item ${isSelected ? 'is-active' : ''}`;
      pill.dataset.lutId = preset.id;
      pill.title = `${preset.title} (${preset.category || 'Preset'})`;

      // Short pill label
      let shortLabel = preset.title
        .replace('Hasselblad Natural Color (HNCS)', 'HNCS')
        .replace('Kodak Portra 400', 'Portra 400')
        .replace('Fujifilm Pro 400H', 'Pro 400H')
        .replace('Cine Teal & Orange', 'Teal & Orange')
        .replace('Leica Monochrom Noir', 'Leica B&W')
        .replace('Kodak Kodachrome 64', 'Kodachrome 64');

      pill.innerHTML = `
        <span class="lut-pill-dot" style="background: ${preset.colorTag || 'var(--accent)'};"></span>
        <span>${shortLabel}</span>
      `;

      pill.addEventListener('click', () => {
        lutManager.selectLut(preset);
        showToast(`Applied ${preset.title}`);
      });

      this.stripEl.appendChild(pill);
    });

    // Custom user LUTs (uploaded via backstage)
    const customLuts = lutManager.customLuts || [];
    customLuts.forEach(custom => {
      const isSelected = lutManager.activeLut && lutManager.activeLut.id === custom.id;
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `lut-pill-item ${isSelected ? 'is-active' : ''}`;
      pill.dataset.lutId = custom.id;
      pill.title = `${custom.title} (Custom .cube)`;

      pill.innerHTML = `
        <span class="lut-pill-dot" style="background: #9D7BFC;"></span>
        <span>${custom.title}</span>
      `;

      pill.addEventListener('click', () => {
        lutManager.selectLut(custom);
        showToast(`Applied ${custom.title}`);
      });

      this.stripEl.appendChild(pill);
    });
  }

  renderSelect() {
    if (!this.selectEl) return;
    this.selectEl.innerHTML = '';

    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'None (Original Photograph)';
    this.selectEl.appendChild(noneOpt);

    // Presets group
    const presetsGroup = document.createElement('optgroup');
    presetsGroup.label = 'Calibrated Presets';
    (lutManager.builtinPresets || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.title} (${p.category || 'Preset'})`;
      presetsGroup.appendChild(opt);
    });
    this.selectEl.appendChild(presetsGroup);

    // Custom group (if any uploaded)
    const customLuts = lutManager.customLuts || [];
    if (customLuts.length > 0) {
      const customGroup = document.createElement('optgroup');
      customGroup.label = 'Custom Backstage Vault (.cube)';
      customLuts.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.title} (${c.size}³ Custom .cube)`;
        customGroup.appendChild(opt);
      });
      this.selectEl.appendChild(customGroup);
    }
  }

  syncUI() {
    // 1. Slider & Readouts
    if (this.sliderEl) {
      this.sliderEl.value = lutManager.intensity;
      this.updateIntensityDisplay(lutManager.intensity);
    }

    // 2. Select dropdown value
    if (this.selectEl) {
      this.selectEl.value = lutManager.activeLut ? lutManager.activeLut.id : '';
    }

    // 3. Pill Strip Active State
    if (this.stripEl) {
      const pills = this.stripEl.querySelectorAll('.lut-pill-item');
      const activeId = lutManager.activeLut ? lutManager.activeLut.id : '';
      pills.forEach(p => {
        p.classList.toggle('is-active', p.dataset.lutId === activeId);
      });

      // If number of custom luts changed, re-render
      const totalPills = pills.length;
      const expectedTotal = 1 + (lutManager.builtinPresets?.length || 0) + (lutManager.customLuts?.length || 0);
      if (totalPills !== expectedTotal) {
        this.renderPills();
        this.renderSelect();
      }
    }

    // 4. Bypass button state
    if (this.btnBypass) {
      this.btnBypass.classList.toggle('tool-btn--accent', lutManager.isBypassed);
    }
  }
}
