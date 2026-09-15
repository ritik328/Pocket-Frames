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

    // Discrete mouse wheel scrolling: 1 notch = EXACTLY 1 day (never skips 1 to 3)
    let wheelAccumulator = 0;
    let lastWheelStepTime = 0;
    let wheelResetTimer = null;
    const STEP_COOLDOWN_MS = 140; // Lock out burst events from the same physical notch
    const WHEEL_THRESHOLD = 40;

    const onWheelStep = (e) => {
      e.preventDefault();
      const now = performance.now();

      // If we stepped within the refractory period, drop any trailing events from the same notch
      if (now - lastWheelStepTime < STEP_COOLDOWN_MS) {
        wheelAccumulator = 0;
        return;
      }

      wheelAccumulator += e.deltaY;

      if (Math.abs(wheelAccumulator) >= WHEEL_THRESHOLD) {
        const step = wheelAccumulator > 0 ? 1 : -1;
        wheelAccumulator = 0;
        lastWheelStepTime = now;
        const nextDay = Math.max(1, Math.min(this.totalDays, this.selectedDay + step));
        if (nextDay !== this.selectedDay) {
          triggerPickerTick();
          this.scrollToDay(nextDay, true);
        }
      }

      clearTimeout(wheelResetTimer);
      wheelResetTimer = setTimeout(() => {
        wheelAccumulator = 0;
      }, 160);
    };

    if (this.wheelList) {
      this.wheelList.addEventListener('wheel', onWheelStep, { passive: false });
    }
    const wheelContainer = this.modal?.querySelector('.day-wheel-container');
    if (wheelContainer && wheelContainer !== this.wheelList) {
      wheelContainer.addEventListener('wheel', onWheelStep, { passive: false });
    }

    // Drag-to-scroll support for desktop mouse and mobile touch
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const onPointerDown = (e) => {
      isDragging = true;
      startY = e.clientY || e.touches?.[0]?.clientY || 0;
      startScrollTop = this.wheelList.scrollTop;
      this.wheelList.style.scrollBehavior = 'auto';
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const currentY = e.clientY || e.touches?.[0]?.clientY || 0;
      const delta = startY - currentY;
      this.wheelList.scrollTop = startScrollTop + delta;
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      this.snapToNearest();
    };

    this.wheelList.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    this.wheelList.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

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
    if (this.isProgrammaticScroll) return;

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
    if (this.isProgrammaticScroll) return;
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
    this.lastSnappedIndex = clamped;
    const targetScroll = (clamped - 1) * this.itemHeight;

    if (smooth) {
      this.isProgrammaticScroll = true;
      clearTimeout(this.progScrollTimer);
      this.progScrollTimer = setTimeout(() => {
        this.isProgrammaticScroll = false;
      }, 160);
    } else {
      this.isProgrammaticScroll = false;
    }

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
