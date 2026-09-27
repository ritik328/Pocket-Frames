/**
 * Pocket Frames — Android Mobile Experience Coordinator
 * Powers the adaptive liquid-glass navigation, context sheets, pull-to-refresh,
 * accessibility scaling, AI insights, 3D LUT grading, and 45s video export.
 */
import { store } from '../state.js';
import { videoManager } from '../video/videoManager.js';
import { downloadFrame } from '../export/exportEngine.js';
import { loadUserImage } from '../image/imageLoader.js';
import { lutManager } from '../lut/lutManager.js';

const storage = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }
};

const SCREEN_NAMES = {
  'scr-splash': 'Splash',
  'scr-onboard': 'Welcome',
  'scr-home': 'Home',
  'scr-library': 'Library',
  'scr-editor': 'Editor',
  'scr-ai': 'Insights',
  'scr-post': 'Post',
  'scr-export': 'Export',
  'scr-lut': 'Color Lab',
  'scr-settings': 'Settings'
};

export class MobileAppCoordinator {
  constructor() {
    this.container = document.getElementById('mobileAppContainer');
    this.phone = document.getElementById('phone') || document.getElementById('mobPhone');
    if (!this.container || !this.phone) return;

    this.current = 'scr-splash';
    this.history = [];
    this.deferredInstallPrompt = null;
    this.onbSlide = 0;
    this.alertFn = null;
    this.toastTimer = null;
    this.expTimer = null;
    this.lpTimer = null;
    this.lpStart = null;
    this.lpSuppress = false;
    this.ctxId = null;

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
      userMedia: null,
      zoom: 1,
      ox: 0,
      oy: 0,
      guides: false,
      frame: 'matte',
      lut: 'warm',
      lutInt: 80,
      favs: storage.get('pf-favs', { p3: true, p6: true }),
      edMap: storage.get('pf-ed', {}),
      fmt: 'mp4',
      fps: 30,
      dur: 45,
      size: '4:5',
      cap: 'minimal',
      homeFilter: 'all',
      libFilter: 'all',
      libQuery: ''
    };

    this.NAV_SCREENS = ['scr-home', 'scr-library', 'scr-ai', 'scr-settings'];

    this.init();
  }

  init() {
    this.skeletonGrid(document.getElementById('homeGrid'), 4);
    this.skeletonGrid(document.getElementById('libGrid'), 6);
    this.buildLutGrid();
    this.syncExport();

    setTimeout(() => this.renderGrids(), 450);

    this.bindEvents();
    this.bindPTR('#homeBody', '#ptrHome', 'Feed updated');
    this.bindPTR('#libBody', '#ptrLib', 'Library updated');
    this.bindPwaInstall();
    this.initClock();
    this.initFit();
    this.adaptiveNav();

    // Theme & Accessibility defaults from storage
    const initialTheme = storage.get('pf-theme', localStorage.getItem('pocketframes-theme') || 'light');
    this.setTheme(initialTheme, true);
    this.setTextSize(storage.get('pf-ts', 'm'));
    this.setReduce(storage.get('pf-rm', window.matchMedia('(prefers-reduced-motion: reduce)').matches));

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

    // Subscribe to central desktop store to sync user media when uploaded
    store.subscribe((appState, changeType) => {
      if (changeType === 'image' && appState.image) {
        this.loadUserMediaIntoMobile(appState.image);
      }
    });
  }

  /* ================= ADAPTIVE LIQUID-GLASS NAV ================= */
  adaptiveNav() {
    const nav = document.getElementById('glassnav');
    const phone = this.phone;
    if (!nav || !phone) return;

    let raf = null, last = 0;
    const sample = (ts) => {
      raf = requestAnimationFrame(sample);
      if (ts - last < 100) return; // ~10fps — lightweight
      last = ts;
      if (phone.dataset.nav !== 'on') return;

      // Determine luminance behind the floating navbar
      const isDarkTheme = document.body.dataset.theme === 'dark' || this.container.dataset.theme === 'dark';
      let avgLum = isDarkTheme ? 40 : 210;

      // If user is editing or previewing a photo/video directly over the nav
      const edPhoto = document.getElementById('edPhoto');
      if (this.current === 'scr-editor' && edPhoto) {
        avgLum = 85; // Media screen is darker
      }

      const t = avgLum / 255;
      const tint = (0.42 + t * 0.38).toFixed(3);
      const blur = (22 + (1 - t) * 10).toFixed(0);
      const legibility = avgLum > 140 ? '#ffffff' : '#101012';

      nav.style.setProperty('--nav-tint', tint);
      nav.style.setProperty('--nav-blur', `${blur}px`);
      nav.style.setProperty('--nav-legibility', legibility);
    };
    raf = requestAnimationFrame(sample);
  }

  /* ================= TOAST NOTIFICATION WITH UNDO ================= */
  toast(msg, actionLabel, actionFn) {
    const t = document.getElementById('toast') || document.getElementById('mobToast');
    if (!t) return;
    t.innerHTML = `<span id="toastMsg">${msg}</span>` + (actionLabel ? `<button type="button" class="t-act" id="toastAct">${actionLabel}</button>` : '');
    const actBtn = t.querySelector('#toastAct');
    if (actBtn && actionFn) {
      actBtn.onclick = (e) => {
        e.stopPropagation();
        t.classList.remove('on');
        actionFn();
      };
    }
    t.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('on'), actionLabel ? 3600 : 1800);
  }

  /* ================= CONFIRMATION MODAL ================= */
  showAlert(title, msg, okLabel, fn) {
    const veil = document.getElementById('alertVeil');
    const alTitle = document.getElementById('alTitle');
    const alMsg = document.getElementById('alMsg');
    const alOk = document.getElementById('alOk');
    if (!veil || !alTitle || !alMsg || !alOk) return;

    alTitle.textContent = title;
    alMsg.textContent = msg;
    alOk.textContent = okLabel;
    this.alertFn = fn;
    veil.classList.add('on');
  }

  /* ================= NAVIGATION & ROUTING ================= */
  setNav(id) {
    if (!this.phone) return;
    const isNav = this.NAV_SCREENS.includes(id);
    this.phone.dataset.nav = isNav ? 'on' : 'off';
    if (isNav) {
      document.querySelectorAll('#mobileAppContainer .nbtn[data-nav-to]').forEach((b) => {
        b.classList.toggle('on', b.dataset.navTo === id);
      });
      this.movePill(id);
    }
  }

  movePill(id) {
    const btn = document.querySelector(`#mobileAppContainer .nbtn[data-nav-to="${id}"]`);
    const pill = document.getElementById('navPill') || document.getElementById('mobNavPill');
    if (!btn || !pill) return;
    requestAnimationFrame(() => {
      pill.style.left = `${btn.offsetLeft + btn.offsetWidth / 2 - 24}px`;
      pill.classList.remove('squish');
      void pill.offsetWidth;
      pill.classList.add('squish');
    });
  }

  saveEditorState() {
    this.state.edMap[this.state.photo] = {
      zoom: this.state.zoom,
      ox: this.state.ox,
      oy: this.state.oy,
      frame: this.state.frame
    };
    storage.set('pf-ed', this.state.edMap);
  }

  go(id, opts = {}) {
    if (id === this.current) return;
    if (this.current === 'scr-editor') this.saveEditorState();

    const from = document.getElementById(this.current);
    const to = document.getElementById(id);
    if (!to) return;

    const dir = opts.back ? 'back' : 'fwd';
    const prevName = SCREEN_NAMES[this.current] || 'Home';

    to.classList.add(dir === 'fwd' ? 'pre-fwd' : 'pre-back');
    to.classList.add('active');
    void to.offsetWidth;
    to.classList.remove('pre-fwd', 'pre-back');

    if (from) {
      from.classList.add(dir === 'fwd' ? 'exit-fwd' : 'exit-back');
      from.classList.remove('active');
      setTimeout(() => from.classList.remove('exit-fwd', 'exit-back'), 460);
    }

    // Update breadcrumb back label
    document.querySelectorAll('#mobileAppContainer .back-label').forEach((s) => {
      s.textContent = prevName;
    });

    if (!opts.back && !opts.root) this.history.push(this.current);
    if (opts.root) this.history = [];

    this.current = id;
    this.setNav(id);

    if (id === 'scr-ai') this.animateAI();
    if (id === 'scr-editor') this.renderEditor();
    if (id === 'scr-lut') this.applyLUT();
  }

  back() {
    if (this.history.length > 0) {
      this.go(this.history.pop(), { back: true });
    } else {
      this.go('scr-home', { back: true, root: true });
    }
  }

  /* ================= PULL TO REFRESH ================= */
  bindPTR(bodySel, ptrSel, msg) {
    const bodyEl = document.querySelector(bodySel);
    const ptr = document.querySelector(ptrSel);
    if (!bodyEl || !ptr) return;

    let startY = null, h = 0;
    bodyEl.addEventListener('pointerdown', (e) => {
      if (bodyEl.scrollTop <= 2) startY = e.clientY;
    });

    bodyEl.addEventListener('pointermove', (e) => {
      if (startY == null) return;
      const dy = e.clientY - startY;
      if (dy > 0 && bodyEl.scrollTop <= 2) {
        h = Math.min(64, dy * 0.45);
        ptr.style.height = `${h}px`;
        ptr.classList.toggle('ready', h > 44);
      } else if (startY != null && dy <= 0) {
        ptr.style.height = '0px';
      }
    });

    const end = () => {
      if (startY == null) return;
      if (h > 44) {
        ptr.style.height = '44px';
        ptr.classList.add('spin-on');
        setTimeout(() => {
          this.skeletonGrid(document.getElementById('homeGrid'), 4);
          this.skeletonGrid(document.getElementById('libGrid'), 6);
          setTimeout(() => {
            this.renderGrids();
            this.toast(msg);
          }, 550);
          ptr.classList.remove('spin-on', 'ready');
          ptr.style.height = '0px';
        }, 650);
      } else {
        ptr.style.height = '0px';
        ptr.classList.remove('ready');
      }
      startY = null;
      h = 0;
    };

    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => {
      bodyEl.addEventListener(ev, end);
    });
  }

  /* ================= SKELETONS & EMPTY STATES ================= */
  skeletonGrid(el, n) {
    if (!el) return;
    el.innerHTML = Array(n)
      .fill('<div class="skel-card"><div class="skel thumb"></div><div class="skel line"></div><div class="skel line short"></div></div>')
      .join('');
  }

  emptyHTML(title, sub, actionLabel, actionId) {
    return `<div class="empty">
      <div class="e-ic">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
        </svg>
      </div>
      <b>${title}</b>
      <span>${sub}</span>
      ${actionLabel ? `<button type="button" class="chip on" data-empty-action="${actionId}">${actionLabel}</button>` : ''}
    </div>`;
  }

  /* ================= CARD RENDERING ================= */
  cardHTML(p) {
    const isFav = !!this.state.favs[p.id];
    return `<button type="button" class="pcard" data-open-photo="${p.id}" data-long="${p.id}" aria-label="${p.title}">
      <i class="pthumb photo-bg ${p.id}"></i>
      ${p.type === 'video' ? `<span class="playdot"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg></span>` : ''}
      <span class="fav ${isFav ? 'on' : ''}" data-fav="${p.id}" role="checkbox" aria-checked="${isFav}" aria-label="Favorite">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 14c1.5-1.5 3-3.3 3-5.5A4.5 4.5 0 0 0 17.5 4c-1.8 0-3 .9-4 2.1a1.9 1.9 0 0 0-3 0C9.5 4.9 8.3 4 6.5 4A4.5 4.5 0 0 0 2 8.5c0 2.2 1.5 4 3 5.5l7 6.6z"/>
        </svg>
      </span>
      <div class="pmeta">
        <b>${p.title}</b>
        <span class="score">★ ${p.score.toFixed(1)}</span>
      </div>
    </button>`;
  }

  matchFilter(p, filter) {
    if (filter === 'fav') return !!this.state.favs[p.id];
    if (filter === 'video' || filter === 'print') return p.type === filter;
    return true;
  }

  renderGrids() {
    const homeGrid = document.getElementById('homeGrid');
    const libGrid = document.getElementById('libGrid');
    const sheetGrid = document.getElementById('sheetGrid');
    const libCountMini = document.getElementById('libCountMini');

    if (homeGrid) {
      const home = this.samplePhotos.filter((p) => this.matchFilter(p, this.state.homeFilter)).slice(0, 4);
      homeGrid.innerHTML = home.map((p) => this.cardHTML(p)).join('') ||
        this.emptyHTML('No favorites yet', 'Tap the heart on any frame to keep it here.', 'Show all', 'all');
    }

    if (libGrid) {
      const lib = this.samplePhotos.filter(
        (p) => this.matchFilter(p, this.state.libFilter) && p.title.toLowerCase().includes(this.state.libQuery)
      );
      libGrid.innerHTML = lib.map((p) => this.cardHTML(p)).join('') ||
        (this.state.libQuery
          ? this.emptyHTML('No matches', `Nothing titled “${this.state.libQuery}” in your library.`, 'Clear search', 'clear')
          : this.emptyHTML('Nothing here', 'Switch filters to see more frames.', 'Show all', 'all'));

      if (libCountMini) {
        libCountMini.textContent = `${lib.length} item${lib.length === 1 ? '' : 's'}`;
      }
    }

    if (sheetGrid) {
      sheetGrid.innerHTML = this.samplePhotos.map((p) => this.cardHTML(p)).join('');
    }
  }

  toggleFav(id) {
    const was = !!this.state.favs[id];
    this.state.favs[id] = !was;
    storage.set('pf-favs', this.state.favs);
    this.renderGrids();
    this.toast(was ? 'Removed from favorites' : 'Added to favorites', 'UNDO', () => {
      this.state.favs[id] = was;
      storage.set('pf-favs', this.state.favs);
      this.renderGrids();
    });
  }

  /* ================= CONTEXT SHEET (LONG PRESS) ================= */
  openCtx(id) {
    this.ctxId = id;
    const p = this.samplePhotos.find((x) => x.id === id);
    if (!p) return;

    const ctxTitle = document.getElementById('ctxTitle');
    const ctxSub = document.getElementById('ctxSub');
    const ctxFavLabel = document.getElementById('ctxFavLabel');
    const ctxSheet = document.getElementById('ctxSheet');
    const ctxVeil = document.getElementById('ctxVeil');

    if (ctxTitle) ctxTitle.textContent = p.title;
    if (ctxSub) ctxSub.textContent = `Score ${p.score.toFixed(1)} • ${p.type === 'video' ? 'Video' : 'Print'}`;
    if (ctxFavLabel) ctxFavLabel.textContent = this.state.favs[id] ? 'Remove from favorites' : 'Add to favorites';

    if (ctxSheet) ctxSheet.classList.add('on');
    if (ctxVeil) ctxVeil.classList.add('on');

    if (navigator.vibrate) navigator.vibrate(12);
  }

  closeSheets() {
    document.getElementById('sheet')?.classList.remove('on');
    document.getElementById('sheetVeil')?.classList.remove('on');
    document.getElementById('ctxSheet')?.classList.remove('on');
    document.getElementById('ctxVeil')?.classList.remove('on');
  }

  /* ================= EDITOR & CANVAS ================= */
  openEditor(id) {
    this.state.photo = id;
    const saved = this.state.edMap[id];
    this.state.zoom = saved ? saved.zoom : 1;
    this.state.ox = saved ? saved.ox : 0;
    this.state.oy = saved ? saved.oy : 0;
    this.state.frame = saved ? saved.frame : 'matte';
    this.go('scr-editor');
  }

  loadUserMediaIntoMobile(media) {
    this.state.userMedia = media;
    const edPhoto = document.getElementById('edPhoto');
    const lutPrev = document.getElementById('lutPrev');
    const expPrev = document.getElementById('expPrev');

    const bgVal = media.src ? `url(${media.src})` : '';
    if (edPhoto) {
      edPhoto.className = 'photo-view photo-bg';
      edPhoto.style.backgroundImage = bgVal;
    }
    if (lutPrev) lutPrev.style.backgroundImage = bgVal;
    if (expPrev) expPrev.style.backgroundImage = bgVal;

    const edTitle = document.getElementById('edTitle');
    const aiPhotoName = document.getElementById('aiPhotoName');
    if (edTitle) edTitle.textContent = media.name || 'Custom Media';
    if (aiPhotoName) aiPhotoName.textContent = media.name || 'Custom Media';
  }

  clampOffsets() {
    const clip = document.getElementById('clip');
    if (!clip) return;
    const r = clip.getBoundingClientRect();
    const mx = ((this.state.zoom - 1) * r.width) / 2;
    const my = ((this.state.zoom - 1) * r.height) / 2;
    this.state.ox = Math.max(-mx, Math.min(mx, this.state.ox));
    this.state.oy = Math.max(-my, Math.min(my, this.state.oy));
  }

  applyTransform() {
    const edPhoto = document.getElementById('edPhoto');
    if (!edPhoto) return;
    edPhoto.style.transform = `translate(${this.state.ox}px, ${this.state.oy}px) scale(${this.state.zoom})`;
  }

  setZoom(z) {
    this.state.zoom = Math.min(2.5, Math.max(1, z));
    const zoomRange = document.getElementById('zoomRange');
    const zoomVal = document.getElementById('zoomVal');
    if (zoomRange) zoomRange.value = Math.round(this.state.zoom * 100);
    if (zoomVal) zoomVal.textContent = `${this.state.zoom.toFixed(2)}×`;
    this.clampOffsets();
    this.applyTransform();
  }

  renderEditor() {
    const p = this.samplePhotos.find((x) => x.id === this.state.photo);
    const edPhoto = document.getElementById('edPhoto');
    const edTitle = document.getElementById('edTitle');
    const edSub = document.getElementById('edSub');
    const aiPhotoName = document.getElementById('aiPhotoName');
    const frameBox = document.getElementById('frameBox');
    const guides = document.getElementById('guides');
    const tGuides = document.getElementById('tGuides');
    const zoomRange = document.getElementById('zoomRange');
    const zoomVal = document.getElementById('zoomVal');
    const frameMeta = document.getElementById('frameMeta');

    if (p && !this.state.userMedia) {
      if (edPhoto) edPhoto.className = `photo-view photo-bg ${this.state.photo}`;
      if (edTitle) edTitle.textContent = p.title;
      if (aiPhotoName) aiPhotoName.textContent = p.title;
    }

    const capName = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const sizeLabel = { '4:5': '1080 × 1350 • 4:5', '1:1': '1080 × 1080 • 1:1', '9:16': '1080 × 1920 • 9:16' }[this.state.size];
    if (edSub) edSub.textContent = `${sizeLabel} • ${capName(this.state.frame)}`;
    if (frameBox) frameBox.className = `frame ${this.state.frame}`;

    if (guides) guides.classList.toggle('show', this.state.guides);
    if (tGuides) {
      tGuides.classList.toggle('on', this.state.guides);
      tGuides.setAttribute('aria-pressed', this.state.guides);
    }

    document.querySelectorAll('#mobileAppContainer [data-frame]').forEach((b) => {
      b.classList.toggle('on', b.dataset.frame === this.state.frame);
    });

    if (zoomRange) zoomRange.value = Math.round(this.state.zoom * 100);
    if (zoomVal) zoomVal.textContent = `${this.state.zoom.toFixed(2)}×`;
    if (frameMeta) {
      frameMeta.textContent = `POCKET FRAMES • ${this.state.size} • LUT: ${(this.luts[this.state.lut]?.name || '').toUpperCase()}`;
    }

    this.clampOffsets();
    this.applyTransform();
    this.applyLUT();
  }

  /* ================= 3D LUT COLOR LAB ================= */
  filterFor(key, int) {
    const L = this.luts[key] || this.luts.original;
    const k = int / 100;
    const m = (v) => 1 + (v - 1) * k;
    return `saturate(${m(L.s)}) contrast(${m(L.c)}) brightness(${m(L.b)}) sepia(${L.sep * k}) grayscale(${L.g * k}) hue-rotate(${L.h * k}deg)`;
  }

  applyLUT() {
    const f = this.filterFor(this.state.lut, this.state.lutInt);
    const edPhoto = document.getElementById('edPhoto');
    const lutPrev = document.getElementById('lutPrev');
    const expPrev = document.getElementById('expPrev');
    const lutName = document.getElementById('lutName');
    const frameMeta = document.getElementById('frameMeta');

    if (edPhoto) edPhoto.style.filter = f;
    if (lutPrev) lutPrev.style.filter = f;
    if (expPrev) expPrev.style.filter = f;
    if (lutName) lutName.textContent = this.luts[this.state.lut]?.name || '';
    if (frameMeta) {
      frameMeta.textContent = `POCKET FRAMES • ${this.state.size} • LUT: ${(this.luts[this.state.lut]?.name || '').toUpperCase()}`;
    }
  }

  buildLutGrid() {
    const grid = document.getElementById('lutGrid');
    if (!grid) return;
    grid.innerHTML = Object.entries(this.luts)
      .map(([k, L]) => `<button type="button" class="swatch ${this.state.lut === k ? 'on' : ''}" data-lut="${k}" aria-label="${L.name}">
        <i class="sw-img photo-bg p1" style="filter:${this.filterFor(k, 100)}"></i>
        <b>${L.name}</b>
      </button>`)
      .join('');
  }

  /* ================= AI INSIGHTS ================= */
  animateAI() {
    const ring = document.getElementById('ringVal');
    const C = 314.16;
    if (ring) {
      ring.style.transition = 'none';
      ring.style.strokeDashoffset = C;
    }
    document.querySelectorAll('#mobileAppContainer #aiBars .fill').forEach((f) => {
      f.style.transition = 'none';
      f.style.width = '0';
    });

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (ring) {
        ring.style.transition = '';
        ring.style.strokeDashoffset = C * (1 - 8.2 / 10);
      }
      document.querySelectorAll('#mobileAppContainer #aiBars .fill').forEach((f) => {
        f.style.transition = '';
        f.style.width = `${f.dataset.w}%`;
      });
    }));
  }

  /* ================= CLIPBOARD COPYING ================= */
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

  /* ================= EXPORT ENGINE ================= */
  syncExport() {
    const expSub = document.getElementById('expSub');
    const mp4Opts = document.getElementById('mp4Opts');
    const expPrevTag = document.getElementById('expPrevTag');
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

  async executeExport() {
    const veil = document.getElementById('expVeil');
    const prog = document.getElementById('expBoxProg');
    const doneB = document.getElementById('expBoxDone');
    const expFill = document.getElementById('expFill');
    const expPct = document.getElementById('expPct');
    const expTitle = document.getElementById('expTitle');
    const expMsg = document.getElementById('expMsg');
    const doneName = document.getElementById('expDoneName');

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

    // Check if user uploaded real media
    const appState = store.getState();
    const hasRealVideo = isVideo && appState.image && (appState.image.type === 'video' || appState.image.isVideo);

    if (hasRealVideo) {
      try {
        const swAudio = document.getElementById('swAudio')?.checked ?? true;
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

        // Trigger real download
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

    // Sample or photo animation
    let p = 0;
    if (expFill) expFill.style.width = '0%';
    if (expPct) expPct.textContent = '0%';
    clearInterval(this.expTimer);

    this.expTimer = setInterval(() => {
      p += isVideo ? 2.2 : 9;
      if (p >= 100) {
        p = 100;
        clearInterval(this.expTimer);

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

  /* ================= THEME & ACCESSIBILITY ================= */
  setTheme(t, silent) {
    if (document.body.dataset.theme !== t) {
      document.body.dataset.theme = t;
      this.container.dataset.theme = t;
      document.documentElement.setAttribute('data-theme', t);
      storage.set('pf-theme', t);
      localStorage.setItem('pocketframes-theme', t);
      if (!silent) this.toast(t === 'dark' ? 'Dark mode on 🌙' : 'Light mode on ☀️');
    }
    const switcher = document.getElementById('themeSwitcher');
    const r = switcher?.querySelector(`input[value="${t}"]`);
    if (r && !r.checked) r.checked = true;
  }

  setTextSize(ts) {
    this.phone.classList.remove('ts-s', 'ts-l');
    if (ts === 's') this.phone.classList.add('ts-s');
    if (ts === 'l') this.phone.classList.add('ts-l');
    document.querySelectorAll('#mobileAppContainer #tsSeg button').forEach((b) => {
      b.classList.toggle('on', b.dataset.ts === ts);
    });
    storage.set('pf-ts', ts);
  }

  setReduce(on) {
    document.body.classList.toggle('rm', on);
    this.container.classList.toggle('rm', on);
    const sw = document.getElementById('swReduce');
    if (sw) sw.checked = on;
    storage.set('pf-rm', on);
  }

  initClock() {
    const clock = document.getElementById('clock');
    const tick = () => {
      const d = new Date();
      if (clock) clock.textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    tick();
    setInterval(tick, 20000);
  }

  initFit() {
    const device = document.getElementById('device');
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
    // 1. Pick up prompt if captured early in <head>
    if (window.__deferredPrompt) {
      this.deferredInstallPrompt = window.__deferredPrompt;
      const installRow = document.getElementById('mobPwaInstallRow');
      if (installRow) installRow.style.display = 'block';
    }

    // 2. Listen for custom event or native beforeinstallprompt
    window.addEventListener('pwa-prompt-ready', (e) => {
      this.deferredInstallPrompt = e.detail || window.__deferredPrompt;
      const installRow = document.getElementById('mobPwaInstallRow');
      if (installRow) installRow.style.display = 'block';
      this.updatePwaInstallUi(false);
    });

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      window.__deferredPrompt = e;
      const installRow = document.getElementById('mobPwaInstallRow');
      if (installRow) installRow.style.display = 'block';
      this.updatePwaInstallUi(false);
    });

    // 3. Handle successful install
    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      window.__deferredPrompt = null;
      this.updatePwaInstallUi(true);
      this.toast('Pocket Frames installed! 🎉 Check your home screen');
    });

    // 4. Check initial standalone status
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.matchMedia('(display-mode: fullscreen)').matches ||
                         window.navigator.standalone === true ||
                         document.documentElement.classList.contains('is-standalone');
    this.updatePwaInstallUi(isStandalone);

    // 5. Direct click fallback on install button
    const installBtn = document.getElementById('mobBtnInstallPwa');
    if (installBtn) {
      installBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handlePwaInstallAction();
      });
    }

    // 6. Service worker registration fallback
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
        reg.update().catch(() => {});
      }).catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
    }
  }

  updatePwaInstallUi(isInstalled) {
    const installBtn = document.getElementById('mobBtnInstallPwa');
    const installRow = document.getElementById('mobPwaInstallRow');
    if (isInstalled) {
      if (installBtn) {
        installBtn.textContent = 'Installed ✓';
        installBtn.disabled = true;
        installBtn.style.opacity = '0.7';
        installBtn.style.pointerEvents = 'none';
      }
      if (installRow) {
        const sub = installRow.querySelector('span');
        if (sub) sub.textContent = 'Installed as standalone Android app';
      }
    } else if (this.deferredInstallPrompt || window.__deferredPrompt) {
      if (installBtn) {
        installBtn.textContent = 'Install 📲';
        installBtn.disabled = false;
        installBtn.style.opacity = '1';
        installBtn.style.pointerEvents = 'auto';
      }
    }
  }

  async handlePwaInstallAction() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.matchMedia('(display-mode: fullscreen)').matches ||
                         window.navigator.standalone === true ||
                         document.documentElement.classList.contains('is-standalone');

    if (isStandalone) {
      this.toast('Pocket Frames is already installed on your device! ✓');
      return;
    }

    const promptEvent = this.deferredInstallPrompt || window.__deferredPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          this.toast('Installing Pocket Frames to Home Screen… 🎉');
          this.deferredInstallPrompt = null;
          window.__deferredPrompt = null;
          this.updatePwaInstallUi(true);
        } else {
          this.toast('Installation dismissed');
        }
      } catch (err) {
        console.warn('[PWA] Prompt error:', err);
        this.toast('To install: Tap Chrome menu ⋮ and select "Add to Home screen"');
      }
    } else {
      // In case beforeinstallprompt hasn't fired yet or browser requires manual menu tap:
      this.toast('Tap Chrome menu ⋮ (top right) → "Add to Home screen" or "Install app"');
    }
  }

  /* ================= EVENT DELEGATION ================= */
  bindEvents() {
    // 1. Long Press Detection on Photo Cards
    document.addEventListener('pointerdown', (e) => {
      const inMob = e.target.closest('#mobileAppContainer');
      if (!inMob) return;
      const card = e.target.closest('[data-long], [data-open-photo]');
      if (!card) return;
      this.lpStart = { x: e.clientX, y: e.clientY };
      const id = card.dataset.long || card.dataset.openPhoto;
      this.lpTimer = setTimeout(() => {
        this.openCtx(id);
        this.lpSuppress = true;
        setTimeout(() => { this.lpSuppress = false; }, 220);
      }, 460);
    });

    ['pointerup', 'pointercancel'].forEach((ev) => {
      document.addEventListener(ev, () => {
        clearTimeout(this.lpTimer);
        this.lpStart = null;
      });
    });

    document.addEventListener('pointermove', (e) => {
      if (this.lpStart && (Math.abs(e.clientX - this.lpStart.x) > 9 || Math.abs(e.clientY - this.lpStart.y) > 9)) {
        clearTimeout(this.lpTimer);
      }
    });

    // 2. Central Universal Click Dispatcher
    document.addEventListener('click', (e) => {
      const inMob = e.target.closest('#mobileAppContainer');
      if (!inMob) return;

      // Desktop close button
      if (e.target.closest('#mobBtnClosePreview')) {
        this.container.classList.remove('force-mobile-preview');
        return;
      }

      // Favorite button
      const favBtn = e.target.closest('.fav, [data-fav]');
      if (favBtn) {
        e.stopPropagation();
        this.toggleFav(favBtn.dataset.fav);
        return;
      }

      if (this.lpSuppress) return;

      // Open Photo card
      const op = e.target.closest('[data-open-photo]');
      if (op) {
        this.closeSheets();
        this.openEditor(op.dataset.openPhoto);
        return;
      }

      // Screen navigation buttons
      const nt = e.target.closest('[data-nav-to]');
      if (nt) {
        this.go(nt.dataset.navTo, { root: this.NAV_SCREENS.includes(nt.dataset.navTo) });
        return;
      }

      // Breadcrumb Back button
      if (e.target.closest('[data-back]')) {
        this.back();
        return;
      }

      // Onboarding Next
      const onbNext = e.target.closest('#onbNext');
      if (onbNext) {
        if (this.onbSlide === 0) {
          this.onbSlide = 1;
          document.querySelectorAll('#mobileAppContainer .onb-slide').forEach((s) => s.classList.toggle('active', s.dataset.slide === '1'));
          document.querySelectorAll('#mobileAppContainer #onbDots i').forEach((d, i) => d.classList.toggle('on', i === 1));
          onbNext.childNodes[0].textContent = 'Get started ';
        } else {
          this.go('scr-home', { root: true });
        }
        return;
      }

      // Onboarding Skip
      if (e.target.closest('#onbSkip')) {
        this.go('scr-home', { root: true });
        return;
      }

      // FAB Button — opens New Frame sheet
      if (e.target.closest('#fab')) {
        document.getElementById('sheet')?.classList.add('on');
        document.getElementById('sheetVeil')?.classList.add('on');
        return;
      }

      // Sheet Veils (close sheets)
      if (e.target.id === 'sheetVeil' || e.target.id === 'ctxVeil') {
        this.closeSheets();
        return;
      }

      // Context sheet actions
      const ctxRow = e.target.closest('.ctx-row');
      if (ctxRow) {
        const action = ctxRow.dataset.ctx;
        const id = this.ctxId;
        this.closeSheets();
        if (action === 'open') this.openEditor(id);
        if (action === 'fav') this.toggleFav(id);
        if (action === 'ai') { this.state.photo = id; this.go('scr-ai'); }
        if (action === 'export') { this.state.photo = id; this.go('scr-export'); this.syncExport(); }
        return;
      }

      // Alert Dialog buttons
      if (e.target.id === 'alCancel' || e.target.id === 'alertVeil') {
        document.getElementById('alertVeil')?.classList.remove('on');
        return;
      }
      if (e.target.id === 'alOk') {
        document.getElementById('alertVeil')?.classList.remove('on');
        if (this.alertFn) this.alertFn();
        return;
      }

      // PWA Install button in Settings
      if (e.target.closest('#mobBtnInstallPwa')) {
        this.handlePwaInstallAction();
        return;
      }

      // Sign out button
      if (e.target.closest('#signOut')) {
        this.showAlert(
          'Sign out?',
          "Your frames stay on this device. You'll need to sign in again to sync.",
          'Sign out',
          () => this.toast('Signed out (demo)')
        );
        return;
      }

      // Toast triggers
      const tt = e.target.closest('[data-toast]');
      if (tt) {
        this.toast(tt.dataset.toast);
        return;
      }

      // Empty state recovery actions
      const ea = e.target.closest('[data-empty-action]');
      if (ea) {
        if (ea.dataset.emptyAction === 'clear') {
          const s = document.getElementById('libSearch');
          if (s) s.value = '';
          this.state.libQuery = '';
        }
        if (ea.dataset.emptyAction === 'all') {
          this.state.libFilter = 'all';
          this.state.homeFilter = 'all';
          document.querySelectorAll('#mobileAppContainer .chips .chip').forEach((c) => {
            c.classList.toggle('on', c.dataset.filter === 'all');
          });
        }
        this.renderGrids();
        return;
      }

      // Filter chips
      const chip = e.target.closest('#mobileAppContainer .chips .chip');
      if (chip) {
        const parent = chip.closest('.chips');
        if (parent) {
          parent.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
          chip.classList.add('on');
          if (parent.id === 'homeChips') {
            this.state.homeFilter = chip.dataset.filter;
            this.renderGrids();
          } else if (parent.id === 'libChips') {
            this.state.libFilter = chip.dataset.filter;
            this.renderGrids();
          } else if (parent.id === 'fpsChips') {
            this.state.fps = parseInt(chip.dataset.fps, 10);
            this.syncExport();
          } else if (parent.id === 'sizeChips') {
            this.state.size = chip.dataset.size;
            this.syncExport();
            if (this.current === 'scr-editor') this.renderEditor();
            else this.applyLUT();
          }
        }
        return;
      }

      // Frame layout buttons in editor
      const frBtn = e.target.closest('[data-frame]');
      if (frBtn) {
        this.state.frame = frBtn.dataset.frame;
        this.renderEditor();
        return;
      }

      // Editor reset & guides
      if (e.target.closest('#tReset')) {
        this.setZoom(1);
        this.state.ox = 0;
        this.state.oy = 0;
        this.renderEditor();
        this.toast('Position & zoom reset');
        return;
      }
      if (e.target.closest('#tGuides')) {
        this.state.guides = !this.state.guides;
        this.renderEditor();
        return;
      }

      // AI Refresh & Recommendation
      if (e.target.closest('#aiRefresh')) {
        this.animateAI();
        this.toast('Re-analyzing with Gemini Vision…');
        return;
      }
      if (e.target.closest('#applyRec')) {
        const prev = { zoom: this.state.zoom, ox: this.state.ox, oy: this.state.oy };
        this.state.zoom = 1.02;
        const clip = document.getElementById('clip');
        const h = clip ? clip.getBoundingClientRect().height : 340;
        this.state.oy = -0.06 * h;
        this.state.ox = 0;
        this.renderEditor();
        this.go('scr-editor', { back: true });
        this.toast('Recommendation applied', 'UNDO', () => {
          this.state.zoom = prev.zoom;
          this.state.ox = prev.ox;
          this.state.oy = prev.oy;
          this.renderEditor();
        });
        return;
      }
      if (e.target.closest('#ignoreRec')) {
        this.toast('Recommendation dismissed');
        return;
      }

      // Post Caption Segment
      const capBtn = e.target.closest('#capSeg button');
      if (capBtn) {
        document.querySelectorAll('#mobileAppContainer #capSeg button').forEach((b) => b.classList.remove('on'));
        capBtn.classList.add('on');
        this.state.cap = capBtn.dataset.cap;
        const capTxt = document.getElementById('captionText');
        if (capTxt) capTxt.textContent = this.captions[this.state.cap];
        return;
      }

      // Copy buttons in Post Package
      const copyBtn = e.target.closest('[data-copy]');
      if (copyBtn) {
        const k = copyBtn.dataset.copy;
        const tagText = () => [...document.querySelectorAll('#mobileAppContainer #htagWrap .htag')].map((h) => h.textContent).join(' ');
        if (k === 'caption') this.copyText(this.captions[this.state.cap], 'Caption copied');
        if (k === 'tags') this.copyText(tagText(), 'Hashtags copied');
        if (k === 'story') this.copyText('DAY 18/47 — Shot on OPPO Find X9', 'Story note copied');
        if (k === 'alt') this.copyText('An abstract close-up photograph featuring a diagonal gradient of warm orange, white, and deep blue light.', 'Alt text copied');
        return;
      }
      if (e.target.closest('#copyAll')) {
        const tagText = () => [...document.querySelectorAll('#mobileAppContainer #htagWrap .htag')].map((h) => h.textContent).join(' ');
        this.copyText(
          `${this.captions[this.state.cap]}\n\n${tagText()}\n\nDAY 18/47 — Shot on OPPO Find X9\n\nAlt: An abstract close-up photograph featuring a diagonal gradient of warm orange, white, and deep blue light.`,
          'Entire post package copied ✓'
        );
        return;
      }

      // Export format segment
      const fmtBtn = e.target.closest('#fmtSeg button');
      if (fmtBtn) {
        document.querySelectorAll('#mobileAppContainer #fmtSeg button').forEach((b) => b.classList.remove('on'));
        fmtBtn.classList.add('on');
        this.state.fmt = fmtBtn.dataset.fmt;
        this.syncExport();
        return;
      }

      // Start Export & Cancel / Done
      if (e.target.closest('#startExport')) {
        this.executeExport();
        return;
      }
      if (e.target.closest('#expCancel')) {
        clearInterval(this.expTimer);
        document.getElementById('expVeil')?.classList.remove('on');
        this.toast('Export canceled');
        return;
      }
      if (e.target.closest('#expDone')) {
        document.getElementById('expVeil')?.classList.remove('on');
        this.toast('Saved to Gallery ✓');
        this.back();
        return;
      }

      // LUT swatch select
      const swatch = e.target.closest('.swatch');
      if (swatch) {
        this.state.lut = swatch.dataset.lut;
        document.querySelectorAll('#mobileAppContainer #lutGrid .swatch').forEach((x) => x.classList.toggle('on', x === swatch));
        this.applyLUT();
        this.toast(`Grade: ${this.luts[this.state.lut]?.name}`);
        return;
      }

      // Text size segment
      const tsBtn = e.target.closest('#tsSeg button');
      if (tsBtn) {
        this.setTextSize(tsBtn.dataset.ts);
        return;
      }

      // Clear cache & reload fresh button
      if (e.target.closest('#mobBtnCheckUpdates')) {
        this.toast('Refreshing cache...');
        if ('caches' in window) {
          caches.keys().then((keys) => {
            keys.forEach((k) => caches.delete(k));
            window.location.reload();
          });
        } else {
          window.location.reload();
        }
        return;
      }

      // Camera and Import buttons
      if (e.target.closest('#mobBtnCamera, #mobBtnImport')) {
        this.closeSheets();
        const fi = document.getElementById('mobNativeFileInput');
        if (fi) {
          fi.value = '';
          fi.click();
        }
        return;
      }
    });

    // 3. Search input in Library
    const libSearch = document.getElementById('libSearch');
    if (libSearch) {
      libSearch.addEventListener('input', (e) => {
        this.state.libQuery = e.target.value.toLowerCase().trim();
        this.renderGrids();
      });
    }

    // 4. Canvas Drag / Pan in Editor
    const clip = document.getElementById('clip');
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

    // 5. Zoom Range Slider in Editor
    const zoomRange = document.getElementById('zoomRange');
    if (zoomRange) {
      zoomRange.addEventListener('input', (e) => {
        this.setZoom(parseFloat(e.target.value) / 100);
      });
    }

    // 6. LUT Intensity Slider & Hold to Compare
    const lutInt = document.getElementById('lutInt');
    const lutIntVal = document.getElementById('lutIntVal');
    if (lutInt) {
      lutInt.addEventListener('input', (e) => {
        this.state.lutInt = parseInt(e.target.value, 10);
        if (lutIntVal) lutIntVal.textContent = `${this.state.lutInt}%`;
        this.applyLUT();
      });
    }
    const lutHold = document.getElementById('lutHold');
    if (lutHold) {
      lutHold.addEventListener('pointerdown', () => {
        const p = document.getElementById('lutPrev');
        if (p) p.style.filter = 'none';
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => {
        lutHold.addEventListener(ev, () => this.applyLUT());
      });
    }

    // 7. Export Duration Slider
    const durRange = document.getElementById('durRange');
    const durVal = document.getElementById('durVal');
    if (durRange) {
      durRange.addEventListener('input', (e) => {
        this.state.dur = parseInt(e.target.value, 10);
        if (durVal) durVal.textContent = `${this.state.dur}.0s`;
        this.syncExport();
      });
    }

    // 8. Reduce Motion Switch
    const swReduce = document.getElementById('swReduce');
    if (swReduce) {
      swReduce.addEventListener('change', (e) => {
        this.setReduce(e.target.checked);
      });
    }

    // 9. Alignment Guides Switch in Settings
    const swGuides = document.getElementById('swGuides');
    if (swGuides) {
      swGuides.addEventListener('change', (e) => {
        this.state.guides = e.target.checked;
        if (this.current === 'scr-editor') this.renderEditor();
      });
    }

    // 10. Theme Switcher with physics spring animation
    const switcher = document.getElementById('themeSwitcher');
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

      switcher.addEventListener('change', (e) => {
        if (e.target.name === 'theme') this.setTheme(e.target.value);
      });
    }

    // 11. Collapsible Mini-Headers on scroll
    [
      ['#libBody', '#scr-library'],
      ['#setBody', '#scr-settings']
    ].forEach(([bSel, sSel]) => {
      const bodyEl = document.querySelector(bSel);
      const scrEl = document.querySelector(sSel);
      if (bodyEl && scrEl) {
        bodyEl.addEventListener('scroll', (e) => {
          scrEl.classList.toggle('collapsed', e.target.scrollTop > 36);
        });
      }
    });

    // 12. Keyboard shortcuts in Editor
    document.addEventListener('keydown', (e) => {
      if (this.current !== 'scr-editor') return;
      const tag = (document.activeElement || {}).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const step = e.shiftKey ? 12 : 4;
      if (e.key === 'ArrowLeft') { this.state.ox -= step; e.preventDefault(); }
      else if (e.key === 'ArrowRight') { this.state.ox += step; e.preventDefault(); }
      else if (e.key === 'ArrowUp') { this.state.oy -= step; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { this.state.oy += step; e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') { this.setZoom(this.state.zoom + 0.05); return; }
      else if (e.key === '-' || e.key === '_') { this.setZoom(this.state.zoom - 0.05); return; }
      else if (e.key === 'r' || e.key === 'R') {
        this.setZoom(1);
        this.state.ox = 0;
        this.state.oy = 0;
        this.renderEditor();
        this.toast('Position & zoom reset');
        return;
      }
      else if (e.key === 'g' || e.key === 'G') {
        this.state.guides = !this.state.guides;
        this.renderEditor();
        return;
      } else {
        return;
      }
      this.clampOffsets();
      this.applyTransform();
    });

    // 13. Native file input connection
    const nativeFile = document.getElementById('mobNativeFileInput');
    if (nativeFile) {
      nativeFile.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        this.toast('Loading file...');
        try {
          const loaded = await loadUserImage(file);
          store.setImage(loaded);
          this.loadUserMediaIntoMobile(loaded);
          this.openEditor('custom');
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
