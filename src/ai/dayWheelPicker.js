/**
 * Pocket Frames - iOS Timeframe Wheel Day Picker
 * Matches the Apple iOS cylindrical drum scroll picker with amber center highlight,
 * audio clicks, and haptic feedback.
 */

import { triggerPickerTick, playApplyConfirmSound } from '../utils/appleHapticAudio.js';

export class DayWheelPicker {
  constructor(options = {}) {
    this.totalDays = options.totalDays || 47;
    this.selectedDay = options.initialDay || 18;
    this.onApply = options.onApply || (() => {});
    this.itemHeight = 52; // Height of each row in pixels

    this.modal = document.getElementById('dayWheelModal');
    this.wheelList = document.getElementById('wheelDaysList');
    this.btnApply = document.getElementById('btnApplyDayWheel');
    this.btnClose = document.getElementById('btnCloseDayWheel');

    this.isScrolling = false;
    this.scrollTimeout = null;
    this.lastSnappedIndex = -1;

    this.init();
  }

  init() {
    if (!this.modal || !this.wheelList) return;

    this.renderDays();
    this.bindEvents();
  }

  renderDays() {
    this.wheelList.innerHTML = '';

    // Spacer at top to allow first items to reach center
    const topSpacer = document.createElement('div');
    topSpacer.className = 'wheel-spacer';
    this.wheelList.appendChild(topSpacer);

    for (let day = 1; day <= this.totalDays; day++) {
      const item = document.createElement('div');
      item.className = 'wheel-item';
      item.dataset.day = day;
      item.innerHTML = `<span class="wheel-item-text">Day ${day}</span>`;

      item.addEventListener('click', () => {
        this.scrollToDay(day, true);
      });

      this.wheelList.appendChild(item);
    }

    // Spacer at bottom to allow last items to reach center
    const bottomSpacer = document.createElement('div');
    bottomSpacer.className = 'wheel-spacer';
    this.wheelList.appendChild(bottomSpacer);
  }

  bindEvents() {
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.close());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    if (this.btnApply) {
      this.btnApply.addEventListener('click', () => {
        playApplyConfirmSound();
        this.onApply(this.selectedDay);
        this.close();
      });
    }

    // Wheel Scroll Listener with Haptic Audio Ticks
    if (this.wheelList) {
      this.wheelList.addEventListener('scroll', () => {
        this.handleScroll();
      }, { passive: true });
    }

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (this.modal && !this.modal.classList.contains('hidden')) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.scrollToDay(Math.max(1, this.selectedDay - 1), true);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.scrollToDay(Math.min(this.totalDays, this.selectedDay + 1), true);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (this.btnApply) this.btnApply.click();
        } else if (e.key === 'Escape') {
          this.close();
        }
      }
    });
  }

  handleScroll() {
    const scrollTop = this.wheelList.scrollTop;
    const rawIndex = Math.round(scrollTop / this.itemHeight);
    const dayIndex = Math.min(Math.max(1, rawIndex + 1), this.totalDays);

    if (dayIndex !== this.lastSnappedIndex) {
      this.lastSnappedIndex = dayIndex;
      this.selectedDay = dayIndex;
      triggerPickerTick();
      this.updateItemStyles(dayIndex);
    }

    // Snap cleanly after momentum scrolling finishes
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      this.snapToNearest();
    }, 120);
  }

  snapToNearest() {
    const targetScroll = (this.selectedDay - 1) * this.itemHeight;
    if (Math.abs(this.wheelList.scrollTop - targetScroll) > 1) {
      this.wheelList.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  }

  updateItemStyles(activeDay) {
    const items = this.wheelList.querySelectorAll('.wheel-item');
    items.forEach((item) => {
      const day = parseInt(item.dataset.day, 10);
      const diff = Math.abs(day - activeDay);

      item.classList.remove('selected', 'near-1', 'near-2', 'far');

      if (diff === 0) {
        item.classList.add('selected');
      } else if (diff === 1) {
        item.classList.add('near-1');
      } else if (diff === 2) {
        item.classList.add('near-2');
      } else {
        item.classList.add('far');
      }
    });
  }

  scrollToDay(day, smooth = false) {
    const clamped = Math.min(Math.max(1, day), this.totalDays);
    this.selectedDay = clamped;
    const targetScroll = (clamped - 1) * this.itemHeight;

    this.wheelList.scrollTo({
      top: targetScroll,
      behavior: smooth ? 'smooth' : 'auto'
    });

    this.updateItemStyles(clamped);
  }

  open(currentDay = 18) {
    if (!this.modal) return;
    this.selectedDay = currentDay;
    this.modal.classList.remove('hidden');

    // Need RAF to ensure container is laid out before scrolling
    requestAnimationFrame(() => {
      this.scrollToDay(this.selectedDay, false);
      this.updateItemStyles(this.selectedDay);
    });
  }

  close() {
    if (this.modal) {
      this.modal.classList.add('hidden');
    }
  }
}
