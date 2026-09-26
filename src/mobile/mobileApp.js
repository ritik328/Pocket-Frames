/**
 * Pocket Frames — Android Mobile Experience Coordinator
 * Powers the liquid-glass mobile navigation, editor, AI analysis, 3D LUT grading, and 45s video export.
 */
import { store } from '../state.js';
import { videoManager } from '../video/videoManager.js';
import { downloadFrame } from '../export/exportEngine.js';
import { loadUserImage } from '../image/imageLoader.js';
import { lutManager } from '../lut/lutManager.js';

export class MobileAppCoordinator {
  constructor() {
    this.container = document.getElementById('mobileAppContainer');
    this.phone = document.getElementById('mobPhone');
    if (!this.container || !this.phone) return;

    this.current = 'scr-splash';
    this.history = [];
    this.deferredInstallPrompt = null;
    this.onbSlide = 0;

    this.samplePhotos = [
      { id: 'p1', title: 'Prismatik', score: 8.2, type: 'print' },
      { id: 'p2', title: 'Crossing, 6:12 PM', score: 7.6, type: 'video' },
      { id: 'p3', title: 'Window Light', score: 8.0, type: 'print' },
      { id: 'p4', title: 'Ridge Layers', score: 7.9, type: 'print' },
      { id: 'p5', title: 'Concrete Study', score: 7.4, type: 'video' },
      { id: 'p6', title: 'Dew Edge', score: 8.4, type: 'print' }
    ];

    this.captions = {
      minimal: 'Shifting spectra in the dark.',
      cinematic: 'Light leans diagonal — a quiet frame suspended between two nights.',
      documentary: 'Day 18: chasing prisms off shop glass, downtown, just after rain.'
    };

    this.luts = {
      original: { name: 'Original', s: 1, c: 1, b: 1, sep: 0, g: 0, h: 0 },
      warm: { name: 'Warm Film', s: 1.12, c: 1.06, b: 1.03, sep: 0.18, g: 0, h: -4 },
      noir: { name: 'Noir', s: 0, c: 1.28, b: 0.96, sep: 0, g: 1, h: 0 },
      teal: { name: 'Teal & Orange', s: 1.28, c: 1.12, b: 1.0, sep: 0, g: 0, h: -10 },
      fade: { name: 'Fade', s: 0.78, c: 0.85, b: 1.1, sep: 0.08, g: 0, h: 0 },
      vivid: { name: 'Vivid', s: 1.5, c: 1.12, b: 1.02, sep: 0, g: 0, h: 0 }
    };

    this.state = {
      photo: 'p1',
      userMedia: null, // Holds user uploaded file/element if provided
      zoom: 1,
      ox: 0,
      oy: 0,
      guides: false,
      frame: 'matte',
      lut: 'warm',
      lutInt: 80,
      favs: { p3: true, p6: true },
      fmt: 'mp4',
      fps: 30,
      dur: 45,
      size: '4:5',
      cap: 'minimal',
      homeFilter: 'all',
      libFilter: 'all',
      libQuery: ''
    };

    this.toastTimer = null;
    this.expTimer = null;
    this.NAV_SCREENS = ['scr-home', 'scr-library', 'scr-ai', 'scr-settings'];

    this.init();
  }

  init() {
    this.renderGrids();
    this.buildLutGrid();
    this.syncExport();
    this.bindEvents();
    this.bindPwaInstall();
    this.initClock();
    this.initFit();

    // Start with splash screen
    const splash = document.getElementById('scr-splash');
    if (splash) splash.classList.add('active');
    this.setNav('scr-splash');

    const splashT = setTimeout(() => {
      if (this.current === 'scr-splash') this.go('scr-onboard');
    }, 1600);

    splash?.addEventListener('click', () => {
      clearTimeout(splashT);
      if (this.current === 'scr-splash') this.go('scr-onboard');
    });

    // Subscribe to central store to sync user uploaded media
    store.subscribe((appState, changeType) => {
      if (changeType === 'image' && appState.image) {
        this.loadUserMediaIntoMobile(appState.image);
      }
    });
  }

  toast(msg) {
    const t = document.getElementById('mobToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
  }

  setNav(id) {
    if (!this.phone) return;
    const isNav = this.NAV_SCREENS.includes(id);
    this.phone.dataset.nav = isNav ? 'on' : 'off';
    if (isNav) {
      document.querySelectorAll('#mobileAppContainer .mob-nbtn[data-nav-to]').forEach((b) => {
        b.classList.toggle('on', b.dataset.navTo === id);
      });
      this.movePill(id);
    }
  }

  movePill(id) {
    const btn = document.querySelector(`#mobileAppContainer .mob-nbtn[data-nav-to="${id}"]`);
    const pill = document.getElementById('mobNavPill');
    if (!btn || !pill) return;
    requestAnimationFrame(() => {
      pill.style.left = (btn.offsetLeft + btn.offsetWidth / 2 - 23) + 'px';
      pill.classList.add('squish');
      setTimeout(() => pill.classList.remove('squish'), 420);
    });
  }

  go(id, opts = {}) {
    if (id === this.current) return;
    const from = document.getElementById(this.current);
    const to = document.getElementById(id);
    if (!to) return;

    // Reset any dangling classes across all screens
    document.querySelectorAll('#mobileAppContainer .mob-screen').forEach((s) => {
      if (s.id !== id && s !== from) {
        s.classList.remove('active', 'exit-fwd', 'exit-back', 'pre-fwd', 'pre-back');
      }
    });

    const dir = opts.back ? 'back' : 'fwd';

    if (from) {
      from.classList.add(dir === 'fwd' ? 'exit-fwd' : 'exit-back');
      from.classList.remove('active');
      setTimeout(() => {
        from.classList.remove('exit-fwd', 'exit-back');
      }, 460);
    }

    to.classList.add(dir === 'fwd' ? 'pre-fwd' : 'pre-back');
    to.classList.add('active');
    to.classList.remove('pre-fwd', 'pre-back');

    if (!opts.back && !opts.root) this.history.push(this.current);
    if (opts.root) this.history = [];
    this.current = id;
    this.setNav(id);

    if (id === 'scr-ai') this.animateAI();
    if (id === 'scr-editor') this.renderEditor();
    if (id === 'scr-lut') this.applyLUT();
  }

  back() {
    if (this.history.length) {
      this.go(this.history.pop(), { back: true });
    } else {
      this.go('scr-home', { back: true, root: true });
    }
  }

  cardHTML(p) {
    const isFav = Boolean(this.state.favs[p.id]);
    return `
      <button class="mob-pcard" data-open-photo="${p.id}" data-type="${p.type}" data-title="${p.title.toLowerCase()}">
        <i class="mob-pthumb photo-bg ${p.id}"></i>
        ${p.type === 'video' ? `<span class="mob-playdot"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg></span>` : ''}
        <span class="mob-fav ${isFav ? 'on' : ''}" data-fav="${p.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 14c1.5-1.5 3-3.3 3-5.5A4.5 4.5 0 0 0 17.5 4c-1.8 0-3 .9-4 2.1a1.9 1.9 0 0 0-3 0C9.5 4.9 8.3 4 6.5 4A4.5 4.5 0 0 0 2 8.5c0 2.2 1.5 4 3 5.5l7 6.6z"/>
          </svg>
        </span>
        <div class="mob-pmeta">
          <b>${p.title}</b>
          <span class="mob-score">★ ${p.score.toFixed(1)}</span>
        </div>
      </button>
    `;
  }

  matchPhoto(p, filter) {
    if (filter === 'fav') return Boolean(this.state.favs[p.id]);
    if (filter === 'video' || filter === 'print') return p.type === filter;
    return true;
  }

  renderGrids() {
    const homeGrid = document.getElementById('mobHomeGrid');
    const libGrid = document.getElementById('mobLibGrid');
    const sheetGrid = document.getElementById('mobSheetGrid');
    const libCount = document.getElementById('mobLibCount');

    const home = this.samplePhotos.filter(p => this.matchPhoto(p, this.state.homeFilter)).slice(0, 4);
    if (homeGrid) {
      homeGrid.innerHTML = home.map(p => this.cardHTML(p)).join('') || '<p class="mob-hint" style="grid-column:1/-1">Nothing here yet</p>';
    }

    const lib = this.samplePhotos.filter(p => this.matchPhoto(p, this.state.libFilter) && p.title.toLowerCase().includes(this.state.libQuery));
    if (libGrid) {
      libGrid.innerHTML = lib.map(p => this.cardHTML(p)).join('') || '<p class="mob-hint" style="grid-column:1/-1">No matches found</p>';
    }
    if (libCount) {
      libCount.textContent = `${lib.length} item${lib.length === 1 ? '' : 's'}`;
    }

    if (sheetGrid) {
      sheetGrid.innerHTML = this.samplePhotos.map(p => this.cardHTML(p)).join('');
    }
  }

  openEditor(id) {
    this.state.photo = id;
    this.state.userMedia = null;
    this.state.zoom = 1;
    this.state.ox = 0;
    this.state.oy = 0;
    this.go('scr-editor');
  }

  loadUserMediaIntoMobile(mediaData) {
    this.state.userMedia = mediaData;
    this.state.zoom = 1;
    this.state.ox = 0;
    this.state.oy = 0;
    const isVideo = mediaData.type === 'video' || mediaData.isVideo;
    this.state.fmt = isVideo ? 'mp4' : 'jpeg';
    this.go('scr-editor');
    this.toast(isVideo ? 'Video loaded into mobile frame!' : 'Photo loaded into mobile frame!');
  }

  clampOffsets() {
    const clip = document.getElementById('mobClip');
    if (!clip) return;
    const r = clip.getBoundingClientRect();
    const mx = ((this.state.zoom - 1) * r.width) / 2;
    const my = ((this.state.zoom - 1) * r.height) / 2;
    this.state.ox = Math.max(-mx, Math.min(mx, this.state.ox));
    this.state.oy = Math.max(-my, Math.min(my, this.state.oy));
  }

  renderEditor() {
    const edPhoto = document.getElementById('mobEdPhoto');
    const edTitle = document.getElementById('mobEdTitle');
    const edSub = document.getElementById('mobEdSub');
    const frameBox = document.getElementById('mobFrameBox');
    const guides = document.getElementById('mobGuides');
    const tGuides = document.getElementById('mobTGuides');
    const zoomRange = document.getElementById('mobZoomRange');
    const zoomVal = document.getElementById('mobZoomVal');
    const frameMeta = document.getElementById('mobFrameMeta');

    const p = this.samplePhotos.find(x => x.id === this.state.photo) || { title: 'User Upload' };
    const title = this.state.userMedia?.filename || p.title;

    if (edTitle) edTitle.textContent = title;
    const aiPhotoName = document.getElementById('mobAiPhotoName');
    if (aiPhotoName) aiPhotoName.textContent = title;

    const sizeLabels = { '4:5': '1080 × 1350 • 4:5', '1:1': '1080 × 1080 • 1:1', '9:16': '1080 × 1920 • 9:16' };
    const frameCap = this.state.frame.charAt(0).toUpperCase() + this.state.frame.slice(1);
    if (edSub) edSub.textContent = `${sizeLabels[this.state.size] || '4:5'} • ${frameCap}`;

    if (frameBox) frameBox.className = `mob-frame ${this.state.frame}`;
    if (guides) guides.classList.toggle('show', this.state.guides);
    if (tGuides) tGuides.classList.toggle('on', this.state.guides);

    document.querySelectorAll('#mobileAppContainer [data-frame]').forEach((b) => {
      b.classList.toggle('on', b.dataset.frame === this.state.frame);
    });

    if (zoomRange) zoomRange.value = Math.round(this.state.zoom * 100);
    if (zoomVal) zoomVal.textContent = `${this.state.zoom.toFixed(2)}×`;

    const lutName = this.luts[this.state.lut]?.name.toUpperCase() || 'WARM FILM';
    if (frameMeta) frameMeta.textContent = `POCKET FRAMES • ${this.state.size} • LUT: ${lutName}`;

    // Handle user image or video vs sample gradient
    if (edPhoto) {
      if (this.state.userMedia && this.state.userMedia.element) {
        edPhoto.className = 'mob-photo-view';
        edPhoto.innerHTML = '';
        const elem = this.state.userMedia.element;
        if (elem.tagName?.toLowerCase() === 'video') {
          elem.style.width = '100%';
          elem.style.height = '100%';
          elem.style.objectFit = 'cover';
          elem.autoplay = true;
          elem.loop = true;
          elem.muted = true;
          elem.playsInline = true;
          if (elem.parentNode !== edPhoto) {
            edPhoto.appendChild(elem);
            elem.play().catch(() => {});
          }
        } else {
          edPhoto.style.backgroundImage = `url(${elem.src || this.state.userMedia.url || ''})`;
          edPhoto.style.backgroundSize = 'cover';
          edPhoto.style.backgroundPosition = 'center';
        }
      } else {
        edPhoto.innerHTML = '';
        edPhoto.style.backgroundImage = '';
        edPhoto.className = `mob-photo-view photo-bg ${this.state.photo}`;
      }
    }

    this.clampOffsets();
    this.applyTransform();
    this.applyLUT();
  }

  applyTransform() {
    const edPhoto = document.getElementById('mobEdPhoto');
    if (!edPhoto) return;
    edPhoto.style.transform = `translate(${this.state.ox}px, ${this.state.oy}px) scale(${this.state.zoom})`;
  }

  filterFor(key, intensity) {
    const L = this.luts[key] || this.luts.warm;
    const k = (intensity ?? 80) / 100;
    const m = (v) => 1 + (v - 1) * k;
    return `saturate(${m(L.s)}) contrast(${m(L.c)}) brightness(${m(L.b)}) sepia(${L.sep * k}) grayscale(${L.g * k}) hue-rotate(${L.h * k}deg)`;
  }

  applyLUT() {
    const f = this.filterFor(this.state.lut, this.state.lutInt);
    const edPhoto = document.getElementById('mobEdPhoto');
    const lutPrev = document.getElementById('mobLutPrev');
    const expPrev = document.getElementById('mobExpPrev');
    const lutName = document.getElementById('mobLutName');
    const frameMeta = document.getElementById('mobFrameMeta');

    if (edPhoto) edPhoto.style.filter = f;
    if (lutPrev) lutPrev.style.filter = f;
    if (expPrev) expPrev.style.filter = f;
    if (lutName) lutName.textContent = this.luts[this.state.lut]?.name || 'Warm Film';
    if (frameMeta) {
      frameMeta.textContent = `POCKET FRAMES • ${this.state.size} • LUT: ${(this.luts[this.state.lut]?.name || '').toUpperCase()}`;
    }
  }

  buildLutGrid() {
    const grid = document.getElementById('mobLutGrid');
    if (!grid) return;
    grid.innerHTML = Object.entries(this.luts).map(([k, L]) => `
      <button class="mob-swatch ${this.state.lut === k ? 'on' : ''}" data-lut="${k}">
        <i class="sw-img photo-bg p1" style="filter:${this.filterFor(k, 100)}"></i>
        <b>${L.name}</b>
      </button>
    `).join('');

    grid.querySelectorAll('.mob-swatch').forEach((s) => {
      s.addEventListener('click', () => {
        this.state.lut = s.dataset.lut;
        grid.querySelectorAll('.mob-swatch').forEach(x => x.classList.toggle('on', x === s));
        this.applyLUT();
        this.toast(`Grade: ${this.luts[this.state.lut].name}`);
      });
    });
  }

  animateAI() {
    const ring = document.getElementById('mobRingVal');
    const C = 314.16;
    if (!ring) return;
    ring.style.transition = 'none';
    ring.style.strokeDashoffset = C.toString();

    document.querySelectorAll('#mobAiBars .fill').forEach((f) => {
      f.style.transition = 'none';
      f.style.width = '0';
    });

    requestAnimationFrame(() => requestAnimationFrame(() => {
      ring.style.transition = '';
      ring.style.strokeDashoffset = (C * (1 - 8.2 / 10)).toString();
      document.querySelectorAll('#mobAiBars .fill').forEach((f) => {
        f.style.transition = '';
        f.style.width = `${f.dataset.w}%`;
      });
    }));
  }

  copyText(txt, msg) {
    const done = () => this.toast(msg || 'Copied to clipboard');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        ta.remove();
        done();
      });
    } else {
      done();
    }
  }

  syncExport() {
    const expSub = document.getElementById('mobExpSub');
    const mp4Opts = document.getElementById('mobMp4Opts');
    const expPrevTag = document.getElementById('mobExpPrevTag');
    const isVideo = this.state.fmt === 'mp4';

    if (expSub) {
      expSub.textContent = isVideo
        ? `Framed video • MP4 • ${this.state.fps} FPS • ${this.state.dur}s`
        : `Still photo • JPEG • ${this.state.size}`;
    }
    if (mp4Opts) mp4Opts.style.display = isVideo ? '' : 'none';
    if (expPrevTag) {
      expPrevTag.textContent = `${this.state.size} • ${(this.luts[this.state.lut]?.name || '').toUpperCase()}`;
    }
  }

  openSheet() {
    document.getElementById('mobSheet')?.classList.add('on');
    document.getElementById('mobSheetVeil')?.classList.add('on');
  }

  closeSheet() {
    document.getElementById('mobSheet')?.classList.remove('on');
    document.getElementById('mobSheetVeil')?.classList.remove('on');
  }

  initClock() {
    const clock = document.getElementById('mobClock');
    const tick = () => {
      const d = new Date();
      if (clock) clock.textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    tick();
    setInterval(tick, 20000);
  }

  initFit() {
    const device = document.getElementById('mobDevice');
    const fit = () => {
      if (!device) return;
      if (window.innerWidth <= 768) {
        device.style.transform = 'none';
        return;
      }
      const s = Math.min((window.innerWidth - 20) / 412, (window.innerHeight - 70) / 866, 1);
      device.style.transform = `scale(${s})`;
    };
    window.addEventListener('resize', fit);
    fit();
  }

  bindPwaInstall() {
    // Intercept PWA beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      const installRow = document.getElementById('mobPwaInstallRow');
      if (installRow) installRow.style.display = 'flex';
    });

    const installBtn = document.getElementById('mobBtnInstallPwa');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (this.deferredInstallPrompt) {
          this.deferredInstallPrompt.prompt();
          const { outcome } = await this.deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            this.toast('Pocket Frames installed! ✓');
          }
          this.deferredInstallPrompt = null;
        } else {
          this.toast('To install: Tap browser menu ⋮ and select "Add to Home screen"');
        }
      });
    }

    // Register service worker if available
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('/sw.js').then(() => {
        console.log('[PWA] Service Worker registered successfully');
      }).catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
    }
  }

  bindEvents() {
    const container = this.container;
    if (!container) return;

    // Dedicated zero-lag navbar button handlers
    const navButtons = container.querySelectorAll('.mob-nbtn');
    navButtons.forEach((btn) => {
      let touchMoved = false;
      const triggerNav = (e) => {
        if (e) {
          e.stopPropagation();
          if (e.cancelable) e.preventDefault();
        }
        if (btn.id === 'mobFab') {
          this.openSheet();
          return;
        }
        const targetScreen = btn.dataset.navTo;
        if (targetScreen) {
          this.go(targetScreen, { root: this.NAV_SCREENS.includes(targetScreen) });
        }
      };

      btn.addEventListener('touchstart', () => { touchMoved = false; }, { passive: true });
      btn.addEventListener('touchmove', () => { touchMoved = true; }, { passive: true });
      btn.addEventListener('touchend', (e) => {
        if (!touchMoved) triggerNav(e);
      });
      btn.addEventListener('click', (e) => {
        triggerNav(e);
      });
    });

    // Global tap delegate for cards, faves, open photo, back, toasts
    const handleTapAction = (target) => {
      const favBtn = target.closest('.mob-fav');
      if (favBtn) {
        const id = favBtn.dataset.fav;
        this.state.favs[id] = !this.state.favs[id];
        this.renderGrids();
        this.toast(this.state.favs[id] ? 'Added to favorites' : 'Removed from favorites');
        return true;
      }

      const op = target.closest('[data-open-photo]');
      if (op) {
        this.closeSheet();
        this.openEditor(op.dataset.openPhoto);
        return true;
      }

      const nt = target.closest('[data-nav-to]');
      if (nt && !nt.classList.contains('mob-nbtn')) {
        this.go(nt.dataset.navTo, { root: this.NAV_SCREENS.includes(nt.dataset.navTo) });
        return true;
      }

      const backBtn = target.closest('[data-back]');
      if (backBtn) {
        this.back();
        return true;
      }

      const tt = target.closest('[data-toast]');
      if (tt) {
        this.toast(tt.dataset.toast);
        return true;
      }

      return false;
    };

    container.addEventListener('click', (e) => {
      handleTapAction(e.target);
    });

    let containerTouchMoved = false;
    container.addEventListener('touchstart', () => { containerTouchMoved = false; }, { passive: true });
    container.addEventListener('touchmove', () => { containerTouchMoved = true; }, { passive: true });
    container.addEventListener('touchend', (e) => {
      if (containerTouchMoved) return;
      const interactive = e.target.closest('[data-open-photo], [data-back], [data-toast], [data-nav-to], .mob-fav');
      if (interactive && !interactive.classList.contains('mob-nbtn')) {
        if (e.cancelable) e.preventDefault();
        handleTapAction(e.target);
      }
    });


    // Chips filter binding
    const bindChips = (sel, cb) => {
      container.querySelectorAll(`${sel} .mob-chip`).forEach((c) => {
        c.addEventListener('click', () => {
          container.querySelectorAll(`${sel} .mob-chip`).forEach(x => x.classList.remove('on'));
          c.classList.add('on');
          cb(c.dataset.filter);
        });
      });
    };
    bindChips('#mobHomeChips', (f) => { this.state.homeFilter = f; this.renderGrids(); });
    bindChips('#mobLibChips', (f) => { this.state.libFilter = f; this.renderGrids(); });

    // Library search
    const libSearch = document.getElementById('mobLibSearch');
    if (libSearch) {
      libSearch.addEventListener('input', (e) => {
        this.state.libQuery = e.target.value.toLowerCase().trim();
        this.renderGrids();
      });
    }

    // Canvas touch drag / pan
    const clip = document.getElementById('mobClip');
    let drag = null;
    if (clip) {
      clip.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, y: e.clientY, ox: this.state.ox, oy: this.state.oy };
        clip.setPointerCapture(e.pointerId);
      });
      clip.addEventListener('pointermove', (e) => {
        if (!drag) return;
        this.state.ox = drag.ox + (e.clientX - drag.x);
        this.state.oy = drag.oy + (e.clientY - drag.y);
        this.clampOffsets();
        this.applyTransform();
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => {
        clip.addEventListener(ev, () => { drag = null; });
      });
    }

    // Zoom slider
    const zoomRange = document.getElementById('mobZoomRange');
    const zoomVal = document.getElementById('mobZoomVal');
    if (zoomRange) {
      zoomRange.addEventListener('input', (e) => {
        this.state.zoom = parseFloat(e.target.value) / 100;
        if (zoomVal) zoomVal.textContent = `${this.state.zoom.toFixed(2)}×`;
        this.clampOffsets();
        this.applyTransform();
      });
    }

    // Tool buttons (Guides, Reset, Frames)
    document.getElementById('mobTGuides')?.addEventListener('click', () => {
      this.state.guides = !this.state.guides;
      this.renderEditor();
    });
    document.getElementById('mobTReset')?.addEventListener('click', () => {
      this.state.zoom = 1;
      this.state.ox = 0;
      this.state.oy = 0;
      this.renderEditor();
      this.toast('Position & zoom reset');
    });
    container.querySelectorAll('[data-frame]').forEach((b) => {
      b.addEventListener('click', () => {
        this.state.frame = b.dataset.frame;
        this.renderEditor();
      });
    });

    // LUT intensity
    const lutInt = document.getElementById('mobLutInt');
    const lutIntVal = document.getElementById('mobLutIntVal');
    if (lutInt) {
      lutInt.addEventListener('input', (e) => {
        this.state.lutInt = parseInt(e.target.value, 10);
        if (lutIntVal) lutIntVal.textContent = `${this.state.lutInt}%`;
        this.applyLUT();
      });
    }
    const lutHold = document.getElementById('mobLutHold');
    if (lutHold) {
      lutHold.addEventListener('pointerdown', () => {
        const p = document.getElementById('mobLutPrev');
        if (p) p.style.filter = 'none';
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => {
        lutHold.addEventListener(ev, () => this.applyLUT());
      });
    }

    // AI actions
    document.getElementById('mobAiRefresh')?.addEventListener('click', () => {
      this.animateAI();
      this.toast('Re-analyzing with Gemini Vision…');
    });
    document.getElementById('mobApplyRec')?.addEventListener('click', () => {
      this.state.zoom = 1.02;
      const h = clip?.getBoundingClientRect().height || 340;
      this.state.oy = -0.06 * h;
      this.state.ox = 0;
      this.renderEditor();
      this.toast('Recommendation applied to canvas ✓');
      this.go('scr-editor', { back: true });
    });
    document.getElementById('mobIgnoreRec')?.addEventListener('click', () => {
      this.toast('Recommendation dismissed');
    });

    // Post captions
    container.querySelectorAll('#mobCapSeg button').forEach((b) => {
      b.addEventListener('click', () => {
        container.querySelectorAll('#mobCapSeg button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        this.state.cap = b.dataset.cap;
        const capTxt = document.getElementById('mobCaptionText');
        if (capTxt) capTxt.textContent = this.captions[this.state.cap];
      });
    });
    const tagText = () => [...container.querySelectorAll('#mobHtagWrap .mob-htag')].map(h => h.textContent).join(' ');
    container.querySelectorAll('[data-copy]').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.copy;
        if (k === 'caption') this.copyText(this.captions[this.state.cap], 'Caption copied');
        if (k === 'tags') this.copyText(tagText(), 'Hashtags copied');
        if (k === 'story') this.copyText('DAY 18/47 — Shot on OPPO Find X9', 'Story note copied');
        if (k === 'alt') this.copyText('An abstract close-up photograph featuring a diagonal gradient of warm orange, white, and deep blue light.', 'Alt text copied');
      });
    });
    document.getElementById('mobCopyAll')?.addEventListener('click', () => {
      this.copyText(
        `${this.captions[this.state.cap]}\n\n${tagText()}\n\nDAY 18/47 — Shot on OPPO Find X9\n\nAlt: An abstract close-up photograph featuring a diagonal gradient of warm orange, white, and deep blue light.`,
        'Entire post package copied ✓'
      );
    });

    // Export formats & limits
    container.querySelectorAll('#mobFmtSeg button').forEach((b) => {
      b.addEventListener('click', () => {
        container.querySelectorAll('#mobFmtSeg button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        this.state.fmt = b.dataset.fmt;
        this.syncExport();
      });
    });
    const durRange = document.getElementById('mobDurRange');
    const durVal = document.getElementById('mobDurVal');
    if (durRange) {
      durRange.addEventListener('input', (e) => {
        // Enforce maximum 45.0s limit
        this.state.dur = Math.min(45, parseInt(e.target.value, 10));
        if (durVal) durVal.textContent = `${this.state.dur}.0s`;
        this.syncExport();
      });
    }
    container.querySelectorAll('#mobFpsChips .mob-chip').forEach((c) => {
      c.addEventListener('click', () => {
        container.querySelectorAll('#mobFpsChips .mob-chip').forEach(x => x.classList.remove('on'));
        c.classList.add('on');
        this.state.fps = parseInt(c.dataset.fps, 10);
        this.syncExport();
      });
    });
    container.querySelectorAll('#mobSizeChips .mob-chip').forEach((c) => {
      c.addEventListener('click', () => {
        container.querySelectorAll('#mobSizeChips .mob-chip').forEach(x => x.classList.remove('on'));
        c.classList.add('on');
        this.state.size = c.dataset.size;
        this.syncExport();
        if (this.current === 'scr-editor') this.renderEditor();
        else this.applyLUT();
      });
    });

    // Start Export button
    const startExp = document.getElementById('mobStartExport');
    if (startExp) {
      startExp.addEventListener('click', async () => {
        const veil = document.getElementById('mobExpVeil');
        const prog = document.getElementById('mobExpBoxProg');
        const doneB = document.getElementById('mobExpBoxDone');
        const expFill = document.getElementById('mobExpFill');
        const expPct = document.getElementById('mobExpPct');
        const expTitle = document.getElementById('mobExpTitle');
        const expMsg = document.getElementById('mobExpMsg');
        const doneName = document.getElementById('mobExpDoneName');

        if (veil) veil.classList.add('on');
        if (prog) prog.style.display = '';
        if (doneB) doneB.style.display = 'none';

        const isVideo = this.state.fmt === 'mp4';
        const sizeMap = { '4:5': '1080 × 1350', '1:1': '1080 × 1080', '9:16': '1080 × 1920' };

        if (expMsg) {
          expMsg.textContent = isVideo
            ? `${sizeMap[this.state.size]} • ${this.state.fps} FPS • H.264 HD`
            : `${sizeMap[this.state.size]} • JPEG • 99% Archival`;
        }
        if (expTitle) {
          expTitle.textContent = isVideo ? 'Recording framed video…' : 'Rendering master frame…';
        }

        // If user loaded real media into Pocket Frames, execute real export engine
        const appState = store.getState();
        const hasRealVideo = isVideo && appState.image && (appState.image.type === 'video' || appState.image.isVideo);

        if (hasRealVideo) {
          try {
            const swAudio = document.getElementById('mobSwAudio')?.checked ?? true;
            const result = await videoManager.exportFramedVideo(appState, {
              duration: Math.min(45.0, this.state.dur),
              fps: this.state.fps || 30,
              includeAudio: swAudio,
              width: 1080,
              height: 1350
            }, (progress) => {
              if (expFill) expFill.style.width = `${progress.percent}%`;
              if (expPct) expPct.textContent = `${progress.percent}%`;
            });

            // Trigger real download to phone
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2500);

            if (prog) prog.style.display = 'none';
            if (doneB) doneB.style.display = '';
            if (doneName) doneName.textContent = `${result.filename} (${this.state.dur}s max)`;
            return;
          } catch (err) {
            this.toast(`Export notice: ${err.message}`);
          }
        }

        // Animated progress for still export or sample demonstration
        let p = 0;
        if (expFill) expFill.style.width = '0%';
        if (expPct) expPct.textContent = '0%';
        clearInterval(this.expTimer);

        this.expTimer = setInterval(() => {
          p += isVideo ? 2.8 : 10;
          if (p >= 100) {
            p = 100;
            clearInterval(this.expTimer);

            // If real photo loaded, download it
            if (!isVideo && appState.image) {
              downloadFrame(appState).catch(() => {});
            }

            setTimeout(() => {
              if (prog) prog.style.display = 'none';
              if (doneB) doneB.style.display = '';
              if (doneName) {
                doneName.textContent = isVideo
                  ? `Prismatik_${this.state.size.replace(':', 'x')}.mp4 • ${this.state.dur}s • ${this.state.fps} FPS`
                  : `Prismatik_${this.state.size.replace(':', 'x')}.jpg • quality 99%`;
              }
            }, 260);
          }
          if (expFill) expFill.style.width = `${p}%`;
          if (expPct) expPct.textContent = `${Math.round(p)}%`;
        }, 55);
      });
    }

    document.getElementById('mobExpDone')?.addEventListener('click', () => {
      document.getElementById('mobExpVeil')?.classList.remove('on');
      this.toast('Saved to Gallery ✓');
      this.back();
    });

    // Theme Switcher physics
    const switcher = document.getElementById('mobThemeSwitcher');
    if (switcher) {
      const trackPrevious = (el) => {
        const radios = el.querySelectorAll('input[type="radio"]');
        let previousValue = null;
        const initiallyChecked = el.querySelector('input[type="radio"]:checked');
        if (initiallyChecked) {
          previousValue = initiallyChecked.getAttribute('c-option');
          el.setAttribute('c-previous', previousValue);
        }
        radios.forEach((radio) => radio.addEventListener('change', () => {
          if (radio.checked) {
            el.setAttribute('c-previous', previousValue ?? '');
            previousValue = radio.getAttribute('c-option');
          }
        }));
      };
      trackPrevious(switcher);

      const setTheme = (t, silent) => {
        container.dataset.theme = t;
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('pocketframes-theme', t);
        if (!silent) this.toast(t === 'dark' ? 'Dark mode on 🌙' : 'Light mode on ☀️');
        const r = switcher.querySelector(`input[value="${t}"]`);
        if (r && !r.checked) r.checked = true;
      };

      switcher.addEventListener('change', (e) => {
        if (e.target.name === 'theme') setTheme(e.target.value);
      });
    }

    // Bottom sheet controls
    const sheetVeil = document.getElementById('mobSheetVeil');
    if (sheetVeil) {
      sheetVeil.addEventListener('click', () => this.closeSheet());
      sheetVeil.addEventListener('touchend', (e) => {
        if (e.cancelable) e.preventDefault();
        this.closeSheet();
      });
    }

    // Native file input connection for Camera & Import
    const mobFileInput = document.getElementById('mobNativeFileInput');
    const btnCamera = document.getElementById('mobBtnCamera');
    const btnImport = document.getElementById('mobBtnImport');

    if (btnCamera && mobFileInput) {
      btnCamera.addEventListener('click', () => {
        this.closeSheet();
        mobFileInput.setAttribute('capture', 'environment');
        mobFileInput.click();
      });
    }

    if (btnImport && mobFileInput) {
      btnImport.addEventListener('click', () => {
        this.closeSheet();
        mobFileInput.removeAttribute('capture');
        mobFileInput.click();
      });
    }

    if (mobFileInput) {
      mobFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        this.toast('Loading your file...');
        try {
          const loaded = await loadUserImage(file);
          store.setImage(loaded);
          this.loadUserMediaIntoMobile(loaded);
        } catch (err) {
          this.toast(`Error: ${err.message}`);
        }
      });
    }

    // Onboarding slides listeners
    let onbMoved = false;
    const advanceOnboard = (e) => {
      if (e) {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
      }
      if (this.onbSlide === 0) {
        this.onbSlide = 1;
        container.querySelectorAll('.mob-onb-slide').forEach(s => s.classList.toggle('active', s.dataset.slide === '1'));
        container.querySelectorAll('#mobOnbDots i').forEach((d, i) => d.classList.toggle('on', i === 1));
        const btn = document.getElementById('mobOnbNext');
        if (btn) btn.innerHTML = `Get started <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;
      } else {
        this.go('scr-home', { root: true });
      }
    };
    const skipOnboard = (e) => {
      if (e) {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
      }
      this.go('scr-home', { root: true });
    };

    const onbNext = document.getElementById('mobOnbNext');
    if (onbNext) {
      onbNext.addEventListener('touchstart', () => { onbMoved = false; }, { passive: true });
      onbNext.addEventListener('touchmove', () => { onbMoved = true; }, { passive: true });
      onbNext.addEventListener('touchend', (e) => { if (!onbMoved) advanceOnboard(e); });
      onbNext.addEventListener('click', advanceOnboard);
    }
    const onbSkip = document.getElementById('mobOnbSkip');
    if (onbSkip) {
      onbSkip.addEventListener('touchstart', () => { onbMoved = false; }, { passive: true });
      onbSkip.addEventListener('touchmove', () => { onbMoved = true; }, { passive: true });
      onbSkip.addEventListener('touchend', (e) => { if (!onbMoved) skipOnboard(e); });
      onbSkip.addEventListener('click', skipOnboard);
    }

  }
}

export let mobileApp = null;
export function initMobileApp() {
  if (!mobileApp) {
    mobileApp = new MobileAppCoordinator();
  }
  return mobileApp;
}
