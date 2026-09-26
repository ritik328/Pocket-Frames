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
      document.querySelectorAll('#mobileAppContainer .mob-nbtn[data-nav-to], #mobileAppContainer .nbtn[data-nav-to]').forEach((b) => {
        b.classList.toggle('on', b.dataset.navTo === id);
      });
      this.movePill(id);
    }
  }

  movePill(id) {
    const btn = document.querySelector(`#mobileAppContainer .mob-nbtn[data-nav-to="${id}"]`) || document.querySelector(`#mobileAppContainer .nbtn[data-nav-to="${id}"]`);
    const pill = document.getElementById('mobNavPill') || document.getElementById('navPill');
    if (!btn || !pill) return;
    requestAnimationFrame(() => {
      pill.style.left = (btn.offsetLeft + btn.offsetWidth / 2 - 23) + 'px';
      pill.classList.remove('squish');
      void pill.offsetWidth;
      pill.classList.add('squish');
    });
  }

  go(id, opts = {}) {
    if (id === this.current) return;
    const from = document.getElementById(this.current);
    const to = document.getElementById(id);
    if (!to) return;

    // Reset any dangling classes across all screens
    document.querySelectorAll('#mobileAppContainer .mob-screen, #mobileAppContainer .screen').forEach((s) => {
      if (s.id !== id && s !== from) {
        s.classList.remove('active', 'exit-fwd', 'exit-back', 'pre-fwd', 'pre-back');
      }
    });

    const dir = opts.back ? 'back' : 'fwd';

    to.classList.add(dir === 'fwd' ? 'pre-fwd' : 'pre-back');
    to.classList.add('active');
    void to.offsetWidth; // Reflow commit to ensure hardware accelerated transition
    to.classList.remove('pre-fwd', 'pre-back');

    if (from) {
      from.classList.add(dir === 'fwd' ? 'exit-fwd' : 'exit-back');
      from.classList.remove('active');
      setTimeout(() => {
        from.classList.remove('exit-fwd', 'exit-back');
      }, 460);
    }

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
      <button class="mob-pcard pcard" data-open-photo="${p.id}" data-type="${p.type}" data-title="${p.title.toLowerCase()}">
        <i class="mob-pthumb pthumb photo-bg ${p.id}"></i>
        ${p.type === 'video' ? `<span class="mob-playdot playdot"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg></span>` : ''}
        <span class="mob-fav fav ${isFav ? 'on' : ''}" data-fav="${p.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 14c1.5-1.5 3-3.3 3-5.5A4.5 4.5 0 0 0 17.5 4c-1.8 0-3 .9-4 2.1a1.9 1.9 0 0 0-3 0C9.5 4.9 8.3 4 6.5 4A4.5 4.5 0 0 0 2 8.5c0 2.2 1.5 4 3 5.5l7 6.6z"/>
          </svg>
        </span>
        <div class="mob-pmeta pmeta">
          <b>${p.title}</b>
          <span class="mob-score score">★ ${p.score.toFixed(1)}</span>
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
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[PWA] Service Worker registered successfully');
        reg.update().catch(() => {});
      }).catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Service Worker controller updated');
      });
    }
  }

  async executeExport() {
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
        ? `${sizeMap[this.state.size]} • ${this.state.fps} FPS • H.264`
        : `${sizeMap[this.state.size]} • JPEG • quality 96`;
    }
    if (expTitle) {
      expTitle.textContent = isVideo ? 'Rendering frames…' : 'Capturing still…';
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
      p += isVideo ? 2.2 : 9;
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
              : `Prismatik_${this.state.size.replace(':', 'x')}.jpg • quality 96`;
          }
        }, 260);
      }
      if (expFill) expFill.style.width = `${p}%`;
      if (expPct) expPct.textContent = `${Math.round(p)}%`;
    }, 55);
  }

  bindEvents() {
    const container = this.container;
    if (!container) return;

    // Central Universal Click Dispatcher: captures ALL taps inside #mobileAppContainer with 0ms delay
    document.addEventListener('click', (e) => {
      const inMob = e.target.closest('#mobileAppContainer');
      if (!inMob) return;

      // 1. Onboarding Next button
      const onbNext = e.target.closest('#mobOnbNext, #onbNext');
      if (onbNext) {
        e.preventDefault();
        e.stopPropagation();
        if (this.onbSlide === 0) {
          this.onbSlide = 1;
          document.querySelectorAll('#mobileAppContainer .mob-onb-slide, #mobileAppContainer .onb-slide').forEach(s => s.classList.toggle('active', s.dataset.slide === '1'));
          document.querySelectorAll('#mobileAppContainer #mobOnbDots i, #mobileAppContainer #onbDots i').forEach((d, i) => d.classList.toggle('on', i === 1));
          onbNext.innerHTML = 'Get started <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
        } else {
          this.go('scr-home', { root: true });
        }
        return;
      }

      // 2. Onboarding Skip button
      const onbSkip = e.target.closest('#mobOnbSkip, #onbSkip');
      if (onbSkip) {
        e.preventDefault();
        e.stopPropagation();
        this.go('scr-home', { root: true });
        return;
      }

      // 3. Onboarding slide dots
      const onbDot = e.target.closest('#mobOnbDots i, #onbDots i');
      if (onbDot) {
        e.preventDefault();
        const dots = [...(onbDot.parentElement?.children || [])];
        const idx = dots.indexOf(onbDot);
        this.onbSlide = idx >= 0 ? idx : 0;
        document.querySelectorAll('#mobileAppContainer .mob-onb-slide, #mobileAppContainer .onb-slide').forEach(s => s.classList.toggle('active', s.dataset.slide === String(this.onbSlide)));
        dots.forEach((d, i) => d.classList.toggle('on', i === this.onbSlide));
        const btnNext = document.getElementById('mobOnbNext') || document.getElementById('onbNext');
        if (btnNext) {
          btnNext.innerHTML = this.onbSlide === 1
            ? 'Get started <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>'
            : 'Next <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
        }
        return;
      }

      // 4. Favorites toggle on cards
      const favBtn = e.target.closest('.mob-fav, .fav, [data-fav]');
      if (favBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = favBtn.dataset.fav || favBtn.closest('[data-open-photo]')?.dataset.openPhoto;
        if (id) {
          this.state.favs[id] = !this.state.favs[id];
          this.renderGrids();
          this.toast(this.state.favs[id] ? 'Added to favorites' : 'Removed from favorites');
        }
        return;
      }

      // 5. Open photo card
      const op = e.target.closest('[data-open-photo]');
      if (op) {
        e.preventDefault();
        e.stopPropagation();
        this.closeSheet();
        this.openEditor(op.dataset.openPhoto);
        return;
      }

      // 6. Dedicated FAB (+) button
      const fabBtn = e.target.closest('#mobFab, #fab, .mob-fab, .fab');
      if (fabBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.openSheet();
        return;
      }

      // 7. Navigation link or navbar button
      const nt = e.target.closest('[data-nav-to]');
      if (nt) {
        e.preventDefault();
        e.stopPropagation();
        const targetScreen = nt.dataset.navTo;
        if (targetScreen) {
          this.go(targetScreen, { root: this.NAV_SCREENS.includes(targetScreen) });
        }
        return;
      }

      // 8. Back button
      const backBtn = e.target.closest('[data-back]');
      if (backBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.back();
        return;
      }

      // 9. Toast button / notification icon
      const tt = e.target.closest('[data-toast]');
      if (tt) {
        e.preventDefault();
        e.stopPropagation();
        this.toast(tt.dataset.toast);
        return;
      }

      // 10. Sheet Veil click to dismiss
      const veil = e.target.closest('#mobSheetVeil, #sheetVeil');
      if (veil) {
        e.preventDefault();
        this.closeSheet();
        return;
      }

      // 11. Camera button in bottom sheet
      const btnCam = e.target.closest('#mobBtnCamera');
      if (btnCam) {
        e.preventDefault();
        this.closeSheet();
        const fi = document.getElementById('mobNativeFileInput');
        if (fi) {
          fi.setAttribute('capture', 'environment');
          fi.click();
        }
        return;
      }

      // 12. Import button in bottom sheet
      const btnImp = e.target.closest('#mobBtnImport');
      if (btnImp) {
        e.preventDefault();
        this.closeSheet();
        const fi = document.getElementById('mobNativeFileInput');
        if (fi) {
          fi.removeAttribute('capture');
          fi.click();
        }
        return;
      }

      // 13. Chips (Home filter, Library filter, FPS, Size)
      const chip = e.target.closest('.mob-chips .mob-chip, .chips .chip');
      if (chip) {
        e.preventDefault();
        const parent = chip.closest('.mob-chips, .chips');
        if (parent) {
          parent.querySelectorAll('.mob-chip, .chip').forEach(c => c.classList.remove('on'));
          chip.classList.add('on');
          const filter = chip.dataset.filter;
          if (parent.id === 'mobHomeChips' || parent.id === 'homeChips') {
            this.state.homeFilter = filter;
            this.renderGrids();
          } else if (parent.id === 'mobLibChips' || parent.id === 'libChips') {
            this.state.libFilter = filter;
            this.renderGrids();
          } else if (parent.id === 'mobFpsChips') {
            this.state.fps = parseInt(chip.dataset.fps, 10);
            this.syncExport();
          } else if (parent.id === 'mobSizeChips') {
            this.state.size = chip.dataset.size;
            this.syncExport();
            if (this.current === 'scr-editor') this.renderEditor();
            else this.applyLUT();
          }
        }
        return;
      }

      // 14. Editor Guides toggle
      const tGuides = e.target.closest('#mobTGuides, #tGuides');
      if (tGuides) {
        e.preventDefault();
        this.state.guides = !this.state.guides;
        this.renderEditor();
        return;
      }

      // 15. Editor Reset button
      const tReset = e.target.closest('#mobTReset, #tReset');
      if (tReset) {
        e.preventDefault();
        this.state.zoom = 1;
        this.state.ox = 0;
        this.state.oy = 0;
        this.renderEditor();
        this.toast('Position & zoom reset');
        return;
      }

      // 16. Editor Frame selector
      const fBtn = e.target.closest('[data-frame]');
      if (fBtn) {
        e.preventDefault();
        this.state.frame = fBtn.dataset.frame;
        this.renderEditor();
        return;
      }

      // 17. AI Refresh button
      const aiRef = e.target.closest('#mobAiRefresh, #aiRefresh');
      if (aiRef) {
        e.preventDefault();
        this.animateAI();
        this.toast('Re-analyzing with Gemini Vision…');
        return;
      }

      // 18. AI Apply Recommendation
      const applyRec = e.target.closest('#mobApplyRec, #applyRec');
      if (applyRec) {
        e.preventDefault();
        this.state.zoom = 1.02;
        const clip = document.getElementById('mobClip');
        const h = clip?.getBoundingClientRect().height || 340;
        this.state.oy = -0.06 * h;
        this.state.ox = 0;
        this.renderEditor();
        this.toast('Recommendation applied to canvas ✓');
        this.go('scr-editor', { back: true });
        return;
      }

      // 19. AI Dismiss Recommendation
      const ignRec = e.target.closest('#mobIgnoreRec, #ignoreRec');
      if (ignRec) {
        e.preventDefault();
        this.toast('Recommendation dismissed');
        return;
      }

      // 20. Post Caption Segment
      const capBtn = e.target.closest('#mobCapSeg button');
      if (capBtn) {
        e.preventDefault();
        document.querySelectorAll('#mobCapSeg button').forEach(b => b.classList.remove('on'));
        capBtn.classList.add('on');
        this.state.cap = capBtn.dataset.cap;
        const capTxt = document.getElementById('mobCaptionText');
        if (capTxt) capTxt.textContent = this.captions[this.state.cap];
        return;
      }

      // 21. Post Copy buttons
      const copyBtn = e.target.closest('[data-copy]');
      if (copyBtn) {
        e.preventDefault();
        const k = copyBtn.dataset.copy;
        const tagText = () => [...document.querySelectorAll('#mobHtagWrap .mob-htag')].map(h => h.textContent).join(' ');
        if (k === 'caption') this.copyText(this.captions[this.state.cap], 'Caption copied');
        if (k === 'tags') this.copyText(tagText(), 'Hashtags copied');
        if (k === 'story') this.copyText('DAY 18/47 — Shot on OPPO Find X9', 'Story note copied');
        if (k === 'alt') this.copyText('An abstract close-up photograph featuring a diagonal gradient of warm orange, white, and deep blue light.', 'Alt text copied');
        return;
      }

      // 22. Copy All button
      const copyAll = e.target.closest('#mobCopyAll, #copyAll');
      if (copyAll) {
        e.preventDefault();
        const tagText = () => [...document.querySelectorAll('#mobHtagWrap .mob-htag')].map(h => h.textContent).join(' ');
        this.copyText(
          `${this.captions[this.state.cap]}\n\n${tagText()}\n\nDAY 18/47 — Shot on OPPO Find X9\n\nAlt: An abstract close-up photograph featuring a diagonal gradient of warm orange, white, and deep blue light.`,
          'Entire post package copied ✓'
        );
        return;
      }

      // 23. Export Format Segment
      const fmtBtn = e.target.closest('#mobFmtSeg button');
      if (fmtBtn) {
        e.preventDefault();
        document.querySelectorAll('#mobFmtSeg button').forEach(b => b.classList.remove('on'));
        fmtBtn.classList.add('on');
        this.state.fmt = fmtBtn.dataset.fmt;
        this.syncExport();
        return;
      }

      // 24. Start Export button
      const startExp = e.target.closest('#mobStartExport, #startExport');
      if (startExp) {
        e.preventDefault();
        this.executeExport();
        return;
      }

      // 25. Export Done button
      const expDone = e.target.closest('#mobExpDone, #expDone');
      if (expDone) {
        e.preventDefault();
        document.getElementById('mobExpVeil')?.classList.remove('on');
        this.toast('Saved to Gallery ✓');
        this.back();
        return;
      }

      // 26. LUT preset swatch
      const swatch = e.target.closest('.mob-swatch');
      if (swatch) {
        e.preventDefault();
        const k = swatch.dataset.lut;
        if (k && this.luts[k]) {
          this.state.lut = k;
          document.querySelectorAll('#mobLutGrid .mob-swatch').forEach(x => x.classList.toggle('on', x === swatch));
          this.applyLUT();
          this.toast(`Grade: ${this.luts[k].name}`);
        }
        return;
      }
    });

    // Library search live input
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

    // Export duration range
    const durRange = document.getElementById('mobDurRange');
    const durVal = document.getElementById('mobDurVal');
    if (durRange) {
      durRange.addEventListener('input', (e) => {
        this.state.dur = Math.min(45, parseInt(e.target.value, 10));
        if (durVal) durVal.textContent = `${this.state.dur}.0s`;
        this.syncExport();
      });
    }

    // Theme Switcher physics
    const switcher = document.getElementById('mobThemeSwitcher') || document.getElementById('themeSwitcher');
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
        document.body.dataset.theme = t;
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

    // Native file input connection for Camera & Import
    const mobFileInput = document.getElementById('mobNativeFileInput');
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

  }
}

export let mobileApp = null;
export function initMobileApp() {
  if (!mobileApp) {
    mobileApp = new MobileAppCoordinator();
  }
  return mobileApp;
}
