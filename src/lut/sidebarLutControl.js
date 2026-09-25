/**
 * Pocket Frames - On-Page Hasselblad Color Grading Controller
 * Supports live mouse cursor hover preview from dropdown & swatch pills
 */
import { lutManager } from './lutManager.js';
import { showToast } from '../main.js';

export class SidebarLutControl {
  constructor(backdoorModalProvider) {
    this.getBackdoorModal = backdoorModalProvider;
    this.stripEl = document.getElementById('sidebarLutPillStrip');
    this.dropdownEl = document.getElementById('sidebarLutDropdown');
    this.dropdownBtn = document.getElementById('sidebarLutDropdownBtn');
    this.dropdownText = document.getElementById('sidebarLutDropdownText');
    this.dropdownMenu = document.getElementById('sidebarLutDropdownMenu');
    this.sliderEl = document.getElementById('sidebarLutSlider');
    this.intensityValEl = document.getElementById('sidebarLutIntensityValue');
    this.intensityPercentEl = document.getElementById('sidebarLutIntensityPercent');
    this.btnCompare = document.getElementById('sidebarBtnCompare');
    this.btnBypass = document.getElementById('sidebarBtnBypass');
    this.btnReset = document.getElementById('sidebarBtnReset');
    this.btnBackdoor = document.getElementById('sidebarBtnBackdoor');

    this.isOpen = false;
    this.isComparing = false;
    this.hoverIndex = -1;
    this.menuItems = [];

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
    // Dropdown toggle
    if (this.dropdownBtn) {
      this.dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && this.dropdownEl && !this.dropdownEl.contains(e.target)) {
        this.closeDropdown();
      }
    });

    // Keyboard navigation when dropdown is open
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeDropdown();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateMenu(1);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateMenu(-1);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.hoverIndex >= 0 && this.hoverIndex < this.menuItems.length) {
          const item = this.menuItems[this.hoverIndex];
          this.commitSelection(item.dataset.lutId);
        }
      }
    });

    // Slider input
    if (this.sliderEl) {
      this.sliderEl.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        lutManager.setIntensity(val, true);
        this.updateIntensityDisplay(val);
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

  toggleDropdown() {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    this.isOpen = true;
    this.dropdownMenu.classList.remove('hidden');
    this.dropdownBtn.classList.add('is-active');
    this.dropdownBtn.setAttribute('aria-expanded', 'true');
    this.hoverIndex = -1;
  }

  closeDropdown() {
    this.isOpen = false;
    this.dropdownMenu.classList.add('hidden');
    this.dropdownBtn.classList.remove('is-active');
    this.dropdownBtn.setAttribute('aria-expanded', 'false');
    lutManager.restoreCommittedLut();
    this.clearHoverHighlight();
  }

  clearHoverHighlight() {
    this.menuItems.forEach(item => item.classList.remove('is-hovered'));
  }

  navigateMenu(direction) {
    if (this.menuItems.length === 0) return;
    this.clearHoverHighlight();

    this.hoverIndex += direction;
    if (this.hoverIndex < 0) this.hoverIndex = this.menuItems.length - 1;
    if (this.hoverIndex >= this.menuItems.length) this.hoverIndex = 0;

    const item = this.menuItems[this.hoverIndex];
    item.classList.add('is-hovered');
    item.scrollIntoView({ block: 'nearest' });

    // Live preview on keyboard navigate
    const lutId = item.dataset.lutId;
    const lut = lutId ? lutManager.findLutById(lutId) : null;
    lutManager.previewLut(lut);
  }

  commitSelection(lutId) {
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
    this.closeDropdown();
  }

  updateIntensityDisplay(val) {
    const pct = `${Math.round(val * 100)}%`;
    if (this.intensityValEl) this.intensityValEl.textContent = pct;
    if (this.intensityPercentEl) this.intensityPercentEl.textContent = pct;
  }

  render() {
    this.renderPills();
    this.renderDropdownMenu();
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

    // Live preview on hover
    nonePill.addEventListener('mouseenter', () => lutManager.previewLut(null));
    nonePill.addEventListener('mouseleave', () => lutManager.restoreCommittedLut());
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

      // Live hover preview on mouseenter
      pill.addEventListener('mouseenter', () => lutManager.previewLut(preset));
      pill.addEventListener('mouseleave', () => lutManager.restoreCommittedLut());
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

      pill.addEventListener('mouseenter', () => lutManager.previewLut(custom));
      pill.addEventListener('mouseleave', () => lutManager.restoreCommittedLut());
      pill.addEventListener('click', () => {
        lutManager.selectLut(custom);
        showToast(`Applied ${custom.title}`);
      });

      this.stripEl.appendChild(pill);
    });
  }

  renderDropdownMenu() {
    if (!this.dropdownMenu) return;
    this.dropdownMenu.innerHTML = '';
    this.menuItems = [];

    // When mouse leaves the entire dropdown menu, restore committed LUT
    this.dropdownMenu.addEventListener('mouseleave', () => {
      this.clearHoverHighlight();
      lutManager.restoreCommittedLut();
    });

    // Item: None (Original Photograph)
    const noneItem = this.createDropdownItem('', 'None (Original Photograph)', null, 'Original un-graded photo');
    this.dropdownMenu.appendChild(noneItem);

    // Group: Calibrated Presets
    const presetsGroupHeader = document.createElement('div');
    presetsGroupHeader.className = 'lut-dropdown-group-header';
    presetsGroupHeader.textContent = 'Calibrated Presets';
    this.dropdownMenu.appendChild(presetsGroupHeader);

    (lutManager.builtinPresets || []).forEach(p => {
      const item = this.createDropdownItem(p.id, `${p.title} (${p.category || 'Preset'})`, p.colorTag, p);
      this.dropdownMenu.appendChild(item);
    });

    // Group: Custom Backstage Vault (.cube)
    const customLuts = lutManager.customLuts || [];
    if (customLuts.length > 0) {
      const customGroupHeader = document.createElement('div');
      customGroupHeader.className = 'lut-dropdown-group-header';
      customGroupHeader.textContent = 'Custom Backstage Vault (.cube)';
      this.dropdownMenu.appendChild(customGroupHeader);

      customLuts.forEach(c => {
        const item = this.createDropdownItem(c.id, `${c.title} (${c.size}³ Custom .cube)`, '#9D7BFC', c);
        this.dropdownMenu.appendChild(item);
      });
    }
  }

  createDropdownItem(id, label, colorTag, lutObj) {
    const isSelected = (!id && !lutManager.activeLut) || (lutManager.activeLut && lutManager.activeLut.id === id);
    const item = document.createElement('div');
    item.className = `lut-dropdown-item ${isSelected ? 'is-selected' : ''}`;
    item.dataset.lutId = id;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');

    item.innerHTML = `
      <span class="lut-dropdown-item__dot" style="background: ${colorTag || 'var(--text-faint)'};"></span>
      <span class="lut-dropdown-item__label">${label}</span>
      <span class="lut-dropdown-item__check">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </span>
    `;

    // ── CRITICAL FEATURE: Live Preview on Mouse Cursor Hover ──
    item.addEventListener('mouseenter', () => {
      this.clearHoverHighlight();
      item.classList.add('is-hovered');
      const targetLut = id ? (lutObj || lutManager.findLutById(id)) : null;
      lutManager.previewLut(targetLut);
    });

    // Click to commit
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      this.commitSelection(id);
    });

    this.menuItems.push(item);
    return item;
  }

  syncUI() {
    // 1. Slider & Readouts
    if (this.sliderEl) {
      this.sliderEl.value = lutManager.intensity;
      this.updateIntensityDisplay(lutManager.intensity);
    }

    // 2. Dropdown Button Text
    if (this.dropdownText) {
      if (lutManager.activeLut) {
        const lut = lutManager.activeLut;
        const typeStr = lut.isBuiltin ? '' : ` (${lut.size}³ Custom)`;
        this.dropdownText.textContent = `${lut.title}${typeStr}`;
      } else {
        this.dropdownText.textContent = 'None (Original Photograph)';
      }
    }

    // 3. Dropdown Menu Selected Item
    if (this.dropdownMenu) {
      const activeId = lutManager.activeLut ? lutManager.activeLut.id : '';
      const items = this.dropdownMenu.querySelectorAll('.lut-dropdown-item');
      items.forEach(it => {
        const isSel = it.dataset.lutId === activeId;
        it.classList.toggle('is-selected', isSel);
        it.setAttribute('aria-selected', isSel ? 'true' : 'false');
      });

      // If custom luts count changed, re-render dropdown items
      const expectedCount = 1 + (lutManager.builtinPresets?.length || 0) + (lutManager.customLuts?.length || 0);
      if (this.menuItems.length !== expectedCount) {
        this.renderDropdownMenu();
      }
    }

    // 4. Pill Strip Active State
    if (this.stripEl) {
      const pills = this.stripEl.querySelectorAll('.lut-pill-item');
      const activeId = lutManager.activeLut ? lutManager.activeLut.id : '';
      pills.forEach(p => {
        p.classList.toggle('is-active', p.dataset.lutId === activeId);
      });

      const totalPills = pills.length;
      const expectedTotal = 1 + (lutManager.builtinPresets?.length || 0) + (lutManager.customLuts?.length || 0);
      if (totalPills !== expectedTotal) {
        this.renderPills();
      }
    }

    // 5. Bypass button state
    if (this.btnBypass) {
      this.btnBypass.classList.toggle('tool-btn--accent', lutManager.isBypassed);
    }
  }
}
