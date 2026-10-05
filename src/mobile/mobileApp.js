/**
 * Pocket Frames — Android Mobile Experience Coordinator
 * Exclusively powers the Studio Frames system with 17 original layouts from web app,
 * live camera with frame overlay & Snapchat-style circle slider, and User ID Card.
 */
import { store } from '../state.js';
import { videoManager } from '../video/videoManager.js';
import { downloadFrame } from '../export/exportEngine.js';
import { loadUserImage } from '../image/imageLoader.js';
import { lutManager } from '../lut/lutManager.js';
import { getBuiltinPresets, BUILTIN_PRESET_DEFINITIONS } from '../lut/lutPresets.js';
import { parseCubeLut } from '../lut/lutParser.js';
import { applyLut } from '../lut/lutProcessor.js';

import { FRAME_CATALOG, FRAME_CATEGORIES, getFrameById, getFramesByCategory } from '../v2/frameDefinitions.js';
import { SceneStore, createDefaultScene, createStickerElement, createTextElement, createPhotoEntry, LOGICAL_W, LOGICAL_H } from '../v2/scene.js';
import { renderScene, renderFrameThumbnail } from '../v2/sceneRenderer.js';
import { STICKER_CATALOG, getStickersByPack, STICKER_PACKS, getStickerById } from '../v2/stickerCatalog.js';
import { triggerHaptic, saveToDeviceGallery, shareFramedPhoto } from './nativeBridge.js';

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
  'scr-frames': 'Frames',
  'scr-editor': 'Frames',
  'scr-camera': 'Camera',
  'scr-settings': 'Settings'
};

const FRAME_ICONS = {
  'plain-strip': '🎞️',
  'ticket-stub': '🎫',
  'love-notes': '💌',
  'vintage-lace': '🌿',
  'coastal-ring': '🌊',
  'camera-cutout': '📸',
  'playing-card': '🃏',
  'love-scribble': '💖',
  'digital-camera': '📷',
  'citrus-collage': '🍊',
  'handwritten-caption': '✍️',
  'retro-phone-collage': '☎️',
  'postcard': '📮',
  'story-of-love': '📖',
  'camera-screen': '📹',
  'editor-toolbar': '🎨',
  'film-roll': '🎞'
};

const LUT_CATALOG = [
  { id: 'original', title: 'Original (Bypass)', category: 'Neutral', colorTag: '#999999', desc: 'No color grade applied' },
  { id: 'hasselblad_natural', title: 'Hasselblad Natural (HNCS)', category: 'Medium Format', colorTag: '#C49A45', desc: 'Authentic medium-format tone curve' },
  { id: 'kodak_portra_400', title: 'Kodak Portra 400', category: 'Negative Film', colorTag: '#E6A770', desc: 'Warm golden skin tones & lifted blacks' },
  { id: 'fuji_pro_400h', title: 'Fujifilm Pro 400H', category: 'Negative Film', colorTag: '#68C3B5', desc: 'Cool airy cyan highlights & pastel depth' },
  { id: 'cinematic_teal_orange', title: 'Cine Teal & Orange', category: 'Cinematic', colorTag: '#3A9BB2', desc: 'Blockbuster complementary split-toning' },
  { id: 'leica_monochrome', title: 'Leica Monochrom Noir', category: 'Black & White', colorTag: '#8E8E93', desc: 'Velvety street photography micro-contrast' },
  { id: 'kodachrome_64', title: 'Kodak Kodachrome 64', category: 'Slide Film', colorTag: '#E04A36', desc: '1970s rich saturated slide film look' }
];

const STICKERS = ['🌸', '✨', '💖', '⭐', '🎧', '🦋', '🌈', '🐻', '🌙', '📸', '🎞️', '🕊️', '🌿', '🌻', '🔥', '⚡'];
const TXTCOLORS = ['#FFFFFF', '#191919', '#F1D377', '#F0B6D8', '#B5CDF1'];

export class MobileAppCoordinator {
  constructor() {
    this.container = document.getElementById('mobileAppContainer');
    this.phone = document.getElementById('phone') || document.getElementById('mobPhone');
    if (!this.container || !this.phone) {
      console.error('[MobileApp] Critical DOM elements not found. Expected #mobileAppContainer and #phone in the document.');
      return;
    }

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

    // User ID Card Profile State
    this.profile = storage.get('pf-user-profile', {
      name: 'Alex Rivera',
      age: '24 Years',
      dob: '2001-03-12',
      role: 'Studio Creator',
      idNum: 'PF-8842-STUDIO',
      joined: '2026',
      status: 'Active Pro',
      avatar: '',
      hue: 38
    });

    // Webapp Frames & Uploaded Frames State
    this.uploadedFrames = storage.get('pf-uploaded-frames', []);
    this.activeFrameId = storage.get('pf-active-frame', 'plain-strip');
    this.activeFrameCat = 'all';
    this.selectedAperture = 0;
    this.camFrameIndex = 0;

    // Webapp 3D LUT State
    this.activeLut = storage.get('pf-active-lut', 'original');
    this.lutIntensity = 100;
    this.isLutBypassed = false;
    this.customLuts = [];

    // Layers & Editor State
    this.layers = [];
    this.layerSeq = 0;
    this.txtColor = TXTCOLORS[0];
    this.STICKERS = STICKERS;
    this.TXTCOLORS = TXTCOLORS;

    // Live Camera AR Frame State
    this.camStream = null;
    this.camFacingMode = 'environment';
    this.camZoom = 1.0;
    this.camEv = 0.0;
    this.initialPinchDist = null;
    this.initialPinchZoom = 1.0;
    this.camTried = false;

    // V2 Studio Frame Document State & Renderer
    this.sceneStore = new SceneStore();
    this.sceneStore.setFrame(this.activeFrameId);
    this.selectedTextFont = 'Caveat';
    this.selectedTextColor = '#1a1a1a';

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
      frame: 'plain-strip',
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

    // Exactly 4 Navigation Tabs from User Diagram: Home, Frames, Camera, Settings
    this.NAV_SCREENS = ['scr-home', 'scr-frames', 'scr-camera', 'scr-settings'];

    this.init();
  }

  init() {
    this.initUserIdCard();
    this.initFramesScreen();
    this.initCameraScreen();
    this.initSheets();

    this.bindEvents();
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
      if (this.current === 'scr-splash') this.go('scr-home', { root: true });
    }, 1500);

    splash?.addEventListener('click', () => {
      clearTimeout(splashT);
      if (this.current === 'scr-splash') this.go('scr-home', { root: true });
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

    // Build toast content safely — never use innerHTML for user/runtime strings
    t.innerHTML = ''; // clear previous content
    const msgSpan = document.createElement('span');
    msgSpan.id = 'toastMsg';
    msgSpan.textContent = msg;
    t.appendChild(msgSpan);

    if (actionLabel) {
      const actBtn = document.createElement('button');
      actBtn.type = 'button';
      actBtn.className = 't-act';
      actBtn.id = 'toastAct';
      actBtn.textContent = actionLabel;
      if (actionFn) {
        actBtn.onclick = (e) => {
          e.stopPropagation();
          t.classList.remove('on');
          actionFn();
        };
      }
      t.appendChild(actBtn);
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

    if (id === 'scr-camera') {
      this.startCamera();
    } else {
      this.stopCamera();
    }
    if (id === 'scr-frames') {
      this.renderFramesCanvas();
      this.updateSlidePills();
      this.updateSlideReplaceBar();
      this.renderLayers();
    }
    if (id === 'scr-editor') {
      this.renderFramesCanvas();
    }
    if (id === 'scr-home') {
      this.renderUserIdCard();
    }
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

  /* ================= TAB 1: USER ID CARD ================= */
  openEditIdSheet() {
    this.openSheet('profile');
  }

  saveEditId() {
    const nameVal = document.getElementById('pfName')?.value?.trim() || document.getElementById('inputEditName')?.value?.trim() || this.profile.name;
    const ageRaw = document.getElementById('pfAge')?.value?.trim() || document.getElementById('inputEditAge')?.value?.trim() || '24';
    const ageVal = ageRaw.includes('Years') ? ageRaw : `${ageRaw} Years`;
    const dobVal = document.getElementById('pfDob')?.value?.trim() || document.getElementById('inputEditDob')?.value?.trim() || this.profile.dob;
    const roleVal = document.getElementById('inputEditRole')?.value?.trim() || this.profile.role;
    const hueVal = +(document.getElementById('pfHue')?.value || this.profile.hue || 38);

    this.profile.name = nameVal;
    this.profile.age = ageVal;
    this.profile.dob = dobVal;
    this.profile.role = roleVal;
    this.profile.hue = hueVal;
    storage.set('pf-user-profile', this.profile);

    this.renderUserIdCard();
    this.closeSheets();
    this.toast('Profile updated ✓');
  }

  async shareIdCard() {
    const shareData = {
      title: `${this.profile.name}'s Pocket Frames ID`,
      text: `Pocket Frames Creator: ${this.profile.name} (${this.profile.role}) • ${this.profile.idNum}`,
      url: window.location.href
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        this.toast('ID Card shared');
      } catch (e) {}
    } else {
      this.copyText(`${shareData.title}\n${shareData.text}`, 'Creator ID copied to clipboard ✓');
    }
  }

  initUserIdCard() {
    this.renderUserIdCard();

    document.getElementById('btnEditIdCard')?.addEventListener('click', () => this.openSheet('profile'));
    document.getElementById('btnEditProfileSheet')?.addEventListener('click', () => this.openSheet('profile'));
    document.getElementById('ucEdit')?.addEventListener('click', () => this.openSheet('profile'));
    document.getElementById('setProfile')?.addEventListener('click', () => this.openSheet('profile'));
    document.getElementById('btnShareIdCard')?.addEventListener('click', () => this.shareIdCard());

    const profCard = document.querySelector('#mobileAppContainer .prof-card');
    profCard?.addEventListener('click', () => this.openSheet('profile'));

    const pfHue = document.getElementById('pfHue');
    pfHue?.addEventListener('input', (e) => {
      const prev = document.getElementById('pfPrev');
      if (prev) prev.style.background = this.hueGrad(+e.target.value);
    });

    document.getElementById('pfSave')?.addEventListener('click', () => this.saveEditId());
    document.getElementById('btnSaveEditId')?.addEventListener('click', () => this.saveEditId());
    document.getElementById('btnCancelEditId')?.addEventListener('click', () => this.closeSheets());

    // Avatar upload if input exists
    const avatarInput = document.getElementById('mobAvatarUploadInput');
    avatarInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.profile.avatar = ev.target.result;
        storage.set('pf-user-profile', this.profile);
        this.renderUserIdCard();
        this.toast('Profile photo updated ✓');
      };
      reader.readAsDataURL(file);
    });
  }

  hueGrad(h) {
    return `linear-gradient(135deg, hsl(${h} 75% 78%), hsl(${(h + 45) % 360} 70% 68%))`;
  }

  renderUserIdCard() {
    const nameEl = document.getElementById('idCardName') || document.getElementById('ucName');
    const ageEl = document.getElementById('idCardAge') || document.getElementById('ucAge');
    const dobEl = document.getElementById('idCardDob') || document.getElementById('ucDob');
    const roleEl = document.getElementById('idCardRole');
    const numEl = document.getElementById('idCardNum');
    const joinedEl = document.getElementById('idCardJoined');
    const statusEl = document.getElementById('idCardStatus');
    const avatarEl = document.getElementById('idCardAvatar') || document.getElementById('ucAvatar');
    const setProfName = document.getElementById('setProfName') || document.getElementById('setUserName');
    const pfPrev = document.getElementById('pfPrev');
    const pfName = document.getElementById('pfName');
    const pfAge = document.getElementById('pfAge');
    const pfDob = document.getElementById('pfDob');
    const pfHue = document.getElementById('pfHue');

    if (nameEl) nameEl.textContent = this.profile.name;
    if (ageEl) ageEl.textContent = this.profile.age;
    if (dobEl) dobEl.textContent = this.profile.dob;
    if (roleEl) roleEl.textContent = this.profile.role || 'Studio Creator';
    if (numEl) numEl.textContent = `ID: ${this.profile.idNum || 'PF-8842-STUDIO'}`;
    if (joinedEl) joinedEl.textContent = this.profile.joined || '2026';
    if (statusEl) statusEl.textContent = this.profile.status || 'Active Pro';
    if (setProfName) setProfName.textContent = this.profile.name;

    const initials = this.profile.name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'AR';

    const bgGrad = this.hueGrad(this.profile.hue || 38);

    if (avatarEl) {
      if (this.profile.avatar) {
        avatarEl.innerHTML = `<img src="${this.profile.avatar}" alt="${this.profile.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
      } else {
        avatarEl.textContent = initials;
        avatarEl.style.background = bgGrad;
      }
    }
    if (pfPrev) {
      pfPrev.textContent = initials;
      pfPrev.style.background = bgGrad;
    }
    if (pfName) pfName.value = this.profile.name;
    if (pfAge) pfAge.value = parseInt(this.profile.age, 10) || 24;
    if (pfDob) pfDob.value = this.profile.dob || '2001-03-12';
    if (pfHue) pfHue.value = this.profile.hue || 38;
  }

  /* ================= TAB 2: WEBAPP FRAMES, CUSTOM UPLOADS & 3D LUT COLOR LAB ================= */
  getAllFrames() {
    return [...(this.uploadedFrames || []), ...FRAME_CATALOG];
  }

  getFrameDef(id) {
    const uploaded = (this.uploadedFrames || []).find((f) => f.id === id);
    if (uploaded) return uploaded;
    return getFrameById(id) || FRAME_CATALOG[0];
  }

  getLutTitle(id) {
    const custom = (this.customLuts || []).find((l) => l.id === id);
    if (custom) return custom.title || custom.name;
    const cat = LUT_CATALOG.find((l) => l.id === id);
    return cat ? cat.title : 'Original';
  }

  getLutCssFilter(lutId, intensity = 100) {
    const k = Math.max(0, Math.min(1, intensity / 100));
    if (k <= 0 || lutId === 'original') return 'none';

    switch (lutId) {
      case 'hasselblad_natural': {
        const c = (1 + 0.08 * k).toFixed(2);
        const s = (1 + 0.12 * k).toFixed(2);
        const b = (1 + 0.02 * k).toFixed(2);
        const sep = (0.04 * k).toFixed(2);
        return `contrast(${c}) saturate(${s}) brightness(${b}) sepia(${sep})`;
      }
      case 'kodak_portra_400': {
        const c = (1 + 0.06 * k).toFixed(2);
        const s = (1 + 0.08 * k).toFixed(2);
        const b = (1 + 0.04 * k).toFixed(2);
        const sep = (0.16 * k).toFixed(2);
        const h = (-3 * k).toFixed(1);
        return `contrast(${c}) saturate(${s}) brightness(${b}) sepia(${sep}) hue-rotate(${h}deg)`;
      }
      case 'fuji_pro_400h': {
        const c = (1 + 0.04 * k).toFixed(2);
        const s = (1 - 0.04 * k).toFixed(2);
        const b = (1 + 0.06 * k).toFixed(2);
        const h = (5 * k).toFixed(1);
        return `contrast(${c}) saturate(${s}) brightness(${b}) hue-rotate(${h}deg)`;
      }
      case 'cinematic_teal_orange': {
        const c = (1 + 0.22 * k).toFixed(2);
        const s = (1 + 0.25 * k).toFixed(2);
        const b = (1 - 0.02 * k).toFixed(2);
        const h = (-8 * k).toFixed(1);
        return `contrast(${c}) saturate(${s}) brightness(${b}) hue-rotate(${h}deg)`;
      }
      case 'leica_monochrome': {
        const g = (1.0 * k).toFixed(2);
        const c = (1 + 0.3 * k).toFixed(2);
        const b = (1 - 0.04 * k).toFixed(2);
        return `grayscale(${g}) contrast(${c}) brightness(${b})`;
      }
      case 'kodachrome_64': {
        const c = (1 + 0.18 * k).toFixed(2);
        const s = (1 + 0.35 * k).toFixed(2);
        const b = (1 + 0.02 * k).toFixed(2);
        const sep = (0.08 * k).toFixed(2);
        const h = (-4 * k).toFixed(1);
        return `contrast(${c}) saturate(${s}) brightness(${b}) sepia(${sep}) hue-rotate(${h}deg)`;
      }
      default:
        return 'none';
    }
  }

  selectFrame(id) {
    this.activeFrameId = id;
    const def = this.getFrameDef(id);
    if (!def.isUploaded) {
      this.sceneStore.setFrame(id);
    }
    this.selectedAperture = 0;
    storage.set('pf-active-frame', id);

    const edNameEl = document.getElementById('edFrameName');
    if (edNameEl) {
      edNameEl.textContent = (def.name || id).toUpperCase();
    }

    this.renderFramesCanvas();
    this.updateSlidePills();
    this.updateSlideReplaceBar();

    // Sync dots and camera frame
    const all = this.getAllFrames();
    const idx = all.findIndex((f) => f.id === id);
    if (idx !== -1) {
      this.setCamFrame(idx, false);
    }
  }

  setLut(id) {
    this.activeLut = id;
    storage.set('pf-active-lut', id);

    // Update camera LUT circle dot color
    const lutDef = LUT_CATALOG.find((l) => l.id === id);
    const lutDot = document.getElementById('camLutDot');
    if (lutDot) {
      lutDot.style.background = lutDef?.colorTag || '#999';
    }

    // Update active class in LUT sheet
    document.querySelectorAll('#mobileAppContainer .lut-card').forEach((c) => {
      c.classList.toggle('on', c.dataset.lutId === id);
    });

    this.renderFramesCanvas();
    this.applyCameraVideoFilters();
    this.toast(`Grade: ${this.getLutTitle(id)}`);
  }

  initFramesScreen() {
    this.buildFrameCategoryTabs();
    this.buildFrameGrid();
    this.buildLutGrid();
    this.initLutControls();

    // Initial frame render
    this.renderFramesCanvas();
    this.updateSlidePills();
    this.updateSlideReplaceBar();
    this.renderLayers();

    // Custom Frame Upload wiring
    document.getElementById('btnUploadCustomFrame')?.addEventListener('click', () => {
      document.getElementById('customFrameFileInput')?.click();
    });

    const frameFileInput = document.getElementById('customFrameFileInput');
    frameFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const newFrame = {
          id: `custom-frame-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, '') || 'Custom Frame',
          category: 'uploaded',
          isUploaded: true,
          dataUrl: reader.result,
          background: '#FAF7F2',
          borderColor: '#E3DDD2',
          pattern: 'none',
          apertures: [
            { x: 180, y: 180, w: 1800, h: 2340, shape: 'rect', emptyFill: '#ECE6DC' }
          ],
          capabilities: { photoCount: 1 }
        };
        this.uploadedFrames.unshift(newFrame);
        storage.set('pf-uploaded-frames', this.uploadedFrames);
        this.activeFrameCat = 'uploaded';
        this.buildFrameCategoryTabs();
        this.buildFrameGrid();
        this.selectFrame(newFrame.id);
        this.buildDots();
        this.closeSheets();
        this.toast('Custom frame uploaded & selected! 🖼️');
      };
      reader.readAsDataURL(file);
    });

    // Stickers sheet grid
    const stkGrid = document.getElementById('stkGrid');
    if (stkGrid) {
      stkGrid.innerHTML = this.STICKERS.map((s) => `<button type="button" class="stk" data-stk="${s}">${s}</button>`).join('');
      stkGrid.addEventListener('click', (e) => {
        const b = e.target.closest('[data-stk]');
        if (!b) return;
        this.layers.push({
          id: ++this.layerSeq,
          type: 'sticker',
          content: b.dataset.stk,
          x: 50,
          y: 50,
          vis: true,
          size: 44
        });
        this.renderLayers();
        this.closeSheets();
        this.toast('Sticker added — drag it around');
      });
    }

    // Text sheet swatches & add button
    const txtSwatches = document.getElementById('txtSwatches');
    if (txtSwatches) {
      txtSwatches.innerHTML = this.TXTCOLORS.map((c, i) => `
        <button type="button" class="swdot ${i === 0 ? 'on' : ''}" data-c="${c}" style="background:${c};box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)"></button>
      `).join('');
      txtSwatches.addEventListener('click', (e) => {
        const d = e.target.closest('.swdot');
        if (!d) return;
        this.txtColor = d.dataset.c;
        txtSwatches.querySelectorAll('.swdot').forEach((x) => x.classList.toggle('on', x === d));
      });
    }

    document.getElementById('txtAdd')?.addEventListener('click', () => {
      const input = document.getElementById('txtInput');
      const v = input?.value.trim();
      if (!v) {
        this.toast('Type something first');
        return;
      }
      this.layers.push({
        id: ++this.layerSeq,
        type: 'text',
        content: v,
        x: 50,
        y: 62,
        vis: true,
        size: 20,
        color: this.txtColor
      });
      if (input) input.value = '';
      this.renderLayers();
      this.closeSheets();
      this.toast('Text layer added');
    });

    // Toolbar buttons
    document.getElementById('toolFrame')?.addEventListener('click', () => this.openSheet('framesel'));
    document.getElementById('toolLut')?.addEventListener('click', () => this.openSheet('luts'));
    document.getElementById('toolSticker')?.addEventListener('click', () => this.openSheet('stickers'));
    document.getElementById('toolText')?.addEventListener('click', () => this.openSheet('text'));
    document.getElementById('toolLayers')?.addEventListener('click', () => {
      this.renderLayerList();
      this.openSheet('layers');
    });

    // Upload & Replace buttons
    document.getElementById('uploadBtn')?.addEventListener('click', () => document.getElementById('fileInput')?.click());
    document.getElementById('btnReplaceImg')?.addEventListener('click', () => document.getElementById('fileInput')?.click());
    document.getElementById('btnRemoveImg')?.addEventListener('click', () => this.clearActiveSlidePhoto());

    // File input change: place photo into active aperture
    const fileInput = document.getElementById('fileInput');
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const assetId = `mob-asset-${Date.now()}`;
          this.sceneStore.assets.set(assetId, {
            img,
            w: img.naturalWidth || img.width || 1080,
            h: img.naturalHeight || img.height || 1080
          });

          this.sceneStore.scene.photos[this.selectedAperture] = {
            id: `photo-${Date.now()}`,
            assetId,
            scale: 1,
            x: 0,
            y: 0,
            rotation: 0
          };

          this.renderFramesCanvas();
          this.updateSlidePills();
          this.updateSlideReplaceBar();

          const curAp = this.selectedAperture;
          const frameDef = this.getFrameDef(this.activeFrameId);
          // Advance to next empty slide if available
          if (frameDef.apertures && frameDef.apertures.length > 1) {
            for (let i = 0; i < frameDef.apertures.length; i++) {
              if (!this.sceneStore.scene.photos[i]) {
                this.selectedAperture = i;
                this.updateSlidePills();
                this.updateSlideReplaceBar();
                break;
              }
            }
          }

          this.toast(`Photo placed in Slide ${curAp + 1} ✓`);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  buildFrameCategoryTabs() {
    const wrap = document.getElementById('frameCatChips');
    if (!wrap) return;
    wrap.innerHTML = '';
    const cats = [
      { id: 'all', label: `All (${FRAME_CATALOG.length})` },
      { id: 'strip', label: 'Photo Strip' },
      { id: 'editorial', label: 'Editorial' },
      { id: 'playful', label: 'Playful' },
      { id: 'camera', label: 'Camera' },
      { id: 'uploaded', label: `Uploaded (${this.uploadedFrames?.length || 0})` }
    ];

    cats.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip ${c.id === this.activeFrameCat ? 'on' : ''}`;
      btn.dataset.cat = c.id;
      btn.textContent = c.label;
      btn.addEventListener('click', () => {
        this.activeFrameCat = c.id;
        wrap.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.cat === c.id));
        this.buildFrameGrid();
      });
      wrap.appendChild(btn);
    });
  }

  buildFrameGrid() {
    const grid = document.getElementById('fselGrid');
    if (!grid) return;
    grid.innerHTML = '';

    let list = [];
    if (this.activeFrameCat === 'all') {
      list = this.getAllFrames();
    } else if (this.activeFrameCat === 'uploaded') {
      list = this.uploadedFrames || [];
    } else {
      list = FRAME_CATALOG.filter((f) => f.category === this.activeFrameCat);
    }

    if (list.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px 12px;color:var(--ink2);font-size:12px">No frames in this category yet.</div>';
      return;
    }

    list.forEach((frame) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      const isSelected = frame.id === this.activeFrameId;
      tile.className = `fsel ${isSelected ? 'on' : ''}`;
      tile.dataset.frame = frame.id;

      const box = document.createElement('div');
      box.className = 'fsel-box';

      if (frame.isUploaded) {
        const img = document.createElement('img');
        img.src = frame.dataUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '12px';
        box.appendChild(img);
      } else {
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.className = 'fsel-thumb-canvas';
        renderFrameThumbnail(thumbCanvas, frame.id);
        box.appendChild(thumbCanvas);
      }

      if (frame.capabilities?.photoCount > 1) {
        const badge = document.createElement('span');
        badge.className = 'fsel-multi-badge';
        badge.textContent = `${frame.capabilities.photoCount} Slides`;
        box.appendChild(badge);
      }

      tile.appendChild(box);

      const title = document.createElement('b');
      title.textContent = frame.name;
      tile.appendChild(title);

      tile.addEventListener('click', () => {
        this.selectFrame(frame.id);
        this.closeSheets();
        this.toast(`Frame: ${frame.name}`);
      });

      grid.appendChild(tile);
    });
  }

  buildLutGrid() {
    const grid = document.getElementById('lutGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const allLuts = [...LUT_CATALOG, ...(this.customLuts || [])];

    allLuts.forEach((lut) => {
      const card = document.createElement('div');
      const isSelected = lut.id === this.activeLut;
      card.className = `lut-card ${isSelected ? 'on' : ''}`;
      card.dataset.lutId = lut.id;

      const swatch = document.createElement('div');
      swatch.className = 'lut-swatch-box';
      swatch.style.background = lut.colorTag || '#777';

      // Test swatch filter preview
      const filter = this.getLutCssFilter(lut.id, 100);
      swatch.innerHTML = `<span style="filter:${filter}">🎨</span>`;
      card.appendChild(swatch);

      const info = document.createElement('div');
      info.className = 'lut-info';
      info.innerHTML = `
        <span class="lut-name">${lut.title || lut.name}</span>
        <span class="lut-desc">${lut.category || 'Film Grade'}</span>
      `;
      card.appendChild(info);

      card.addEventListener('click', () => {
        this.setLut(lut.id);
        this.closeSheets();
      });

      grid.appendChild(card);
    });
  }

  initLutControls() {
    const range = document.getElementById('lutInt');
    const valText = document.getElementById('lutIntVal');
    if (range) {
      range.value = this.lutIntensity;
      range.addEventListener('input', (e) => {
        this.lutIntensity = parseInt(e.target.value, 10);
        if (valText) valText.textContent = `${this.lutIntensity}%`;
        this.renderFramesCanvas();
        this.applyCameraVideoFilters();
      });
    }

    const holdBtn = document.getElementById('lutHold');
    if (holdBtn) {
      const onHold = (e) => {
        e.preventDefault();
        this.isLutBypassed = true;
        this.renderFramesCanvas();
      };
      const onRelease = (e) => {
        e.preventDefault();
        this.isLutBypassed = false;
        this.renderFramesCanvas();
      };
      holdBtn.addEventListener('pointerdown', onHold);
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => {
        holdBtn.addEventListener(ev, onRelease);
      });
    }

    // Import .cube file
    document.getElementById('btnUploadCubeLut')?.addEventListener('click', () => {
      document.getElementById('cubeLutFileInput')?.click();
    });

    const cubeInput = document.getElementById('cubeLutFileInput');
    cubeInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = parseCubeLut(reader.result, file.name);
          parsed.id = `custom-lut-${Date.now()}`;
          parsed.title = parsed.title || file.name.replace(/\.[^/.]+$/, '');
          parsed.category = 'Custom 3D LUT';
          parsed.colorTag = '#4ade80';
          this.customLuts.push(parsed);
          this.buildLutGrid();
          this.setLut(parsed.id);
          this.toast(`3D LUT "${parsed.title}" imported ✓`);
        } catch (err) {
          this.toast(`LUT error: ${err.message}`);
        }
      };
      reader.readAsText(file);
    });
  }

  renderFramesCanvas() {
    const canvas = document.getElementById('edCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frameDef = this.getFrameDef(this.activeFrameId);
    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;

    // Apply active LUT filter directly to photo renderings
    const lutFilter = this.isLutBypassed ? 'none' : this.getLutCssFilter(this.activeLut, this.lutIntensity);

    if (frameDef.isUploaded) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = frameDef.background || '#FAF7F2';
      ctx.fillRect(0, 0, W, H);

      // Render photo in aperture if present
      const ap = frameDef.apertures?.[0];
      const photo = this.sceneStore.scene.photos?.[0];
      if (ap && photo) {
        const asset = this.sceneStore.assets.get(photo.assetId);
        if (asset?.img) {
          const ax = (ap.x / LOGICAL_W) * W;
          const ay = (ap.y / LOGICAL_H) * H;
          const aw = (ap.w / LOGICAL_W) * W;
          const ah = (ap.h / LOGICAL_H) * H;
          ctx.save();
          ctx.beginPath();
          ctx.rect(ax, ay, aw, ah);
          ctx.clip();
          if (lutFilter !== 'none') ctx.filter = lutFilter;
          ctx.drawImage(asset.img, ax, ay, aw, ah);
          ctx.restore();
        }
      }

      // Draw custom frame overlay
      if (frameDef.dataUrl) {
        const frameImg = new Image();
        frameImg.src = frameDef.dataUrl;
        if (frameImg.complete) {
          ctx.drawImage(frameImg, 0, 0, W, H);
        } else {
          frameImg.onload = () => ctx.drawImage(frameImg, 0, 0, W, H);
        }
      }
    } else {
      // Catalog template rendered via V2 unified renderer
      // Set display images for photos with active LUT
      const photos = this.sceneStore.scene.photos || [];
      photos.forEach((p) => {
        if (p) p._lutFilter = lutFilter;
      });

      renderScene(ctx, this.sceneStore.scene, this.sceneStore.assets, {
        targetWidth: W,
        targetHeight: H,
        isExport: false,
        editorState: { selectedId: null, gridVisible: false, guidesVisible: false }
      });
    }

    // Update interactive aperture overlay
    const overlay = document.getElementById('edApertureOverlay');
    if (overlay) {
      overlay.innerHTML = '';
      const aps = frameDef.apertures || [];
      aps.forEach((ap, idx) => {
        const slot = document.createElement('div');
        const isActive = idx === this.selectedAperture;
        const hasPhoto = Boolean(this.sceneStore.scene.photos?.[idx]);

        slot.className = `ed-aperture-slot ${isActive ? 'is-active' : ''} ${hasPhoto ? '' : 'is-empty'}`;
        slot.style.left = `${(ap.x / LOGICAL_W) * 100}%`;
        slot.style.top = `${(ap.y / LOGICAL_H) * 100}%`;
        slot.style.width = `${(ap.w / LOGICAL_W) * 100}%`;
        slot.style.height = `${(ap.h / LOGICAL_H) * 100}%`;

        if (!hasPhoto) {
          const lbl = document.createElement('span');
          lbl.className = 'ed-aperture-empty-lbl';
          lbl.textContent = aps.length > 1 ? `+ Slide ${idx + 1}` : '+ Add Photo';
          slot.appendChild(lbl);
        }

        slot.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectedAperture = idx;
          this.updateSlidePills();
          this.updateSlideReplaceBar();
          this.renderFramesCanvas();

          if (!hasPhoto) {
            document.getElementById('fileInput')?.click();
          }
        });

        overlay.appendChild(slot);
      });
    }

    // Sync gallery thumb
    const firstPhoto = this.sceneStore.scene.photos?.[0];
    const asset = firstPhoto ? this.sceneStore.assets.get(firstPhoto.assetId) : null;
    const galThumb = document.getElementById('galThumb');
    if (galThumb && asset?.img) {
      galThumb.classList.remove('photo-bg', 'p1');
      galThumb.style.backgroundImage = `url(${asset.img.src || asset.img})`;
    }
  }

  updateSlidePills() {
    const pills = document.getElementById('edSlidePills');
    if (!pills) return;
    const frameDef = this.getFrameDef(this.activeFrameId);
    const count = frameDef.apertures?.length || 1;

    if (count <= 1) {
      pills.style.display = 'none';
      pills.innerHTML = '';
      return;
    }

    pills.style.display = 'flex';
    pills.innerHTML = Array.from({ length: count }).map((_, i) => {
      const isSel = i === this.selectedAperture;
      const hasPhoto = Boolean(this.sceneStore.scene.photos?.[i]);
      return `
        <button type="button" class="slide-pill ${isSel ? 'on' : ''}" data-slide="${i}">
          Slide ${i + 1} ${hasPhoto ? '✓' : '(empty)'}
        </button>
      `;
    }).join('');

    pills.querySelectorAll('.slide-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedAperture = parseInt(btn.dataset.slide, 10);
        this.updateSlidePills();
        this.updateSlideReplaceBar();
        this.renderFramesCanvas();
      });
    });
  }

  updateSlideReplaceBar() {
    const bar = document.getElementById('edReplaceBar');
    const replaceBtn = document.getElementById('btnReplaceImg');
    const clearBtn = document.getElementById('btnRemoveImg');
    if (!bar) return;

    const hasPhoto = Boolean(this.sceneStore.scene.photos?.[this.selectedAperture]);
    const frameDef = this.getFrameDef(this.activeFrameId);
    const count = frameDef.apertures?.length || 1;

    if (hasPhoto) {
      bar.style.display = 'flex';
      if (replaceBtn) {
        replaceBtn.textContent = count > 1 ? `🔄 Replace Slide ${this.selectedAperture + 1}` : '🔄 Replace Photo';
      }
      if (clearBtn) {
        clearBtn.textContent = count > 1 ? `✕ Clear Slide ${this.selectedAperture + 1}` : '✕ Clear Photo';
      }
    } else {
      bar.style.display = 'none';
    }
  }

  clearActiveSlidePhoto() {
    const cur = this.selectedAperture;
    delete this.sceneStore.scene.photos[cur];
    this.renderFramesCanvas();
    this.updateSlidePills();
    this.updateSlideReplaceBar();
    this.toast(`Slide ${cur + 1} cleared`);
  }

  /* layers */
  renderLayers() {
    const host = document.getElementById('layerHost');
    if (!host) return;
    host.innerHTML = '';
    this.layers.forEach((L) => {
      const el = document.createElement('div');
      el.className = 'layer ' + L.type + (L.vis ? '' : ' off');
      el.dataset.id = L.id;
      el.style.left = L.x + '%';
      el.style.top = L.y + '%';
      if (L.type === 'sticker') {
        el.textContent = L.content;
        if (L.size) el.style.fontSize = L.size + 'px';
      } else {
        el.textContent = L.content;
        el.style.color = L.color;
        el.style.fontSize = (L.size || 20) + 'px';
      }
      host.appendChild(el);
    });
    this.bindLayerDrag();
  }

  bindLayerDrag() {
    document.querySelectorAll('#layerHost .layer').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const L = this.layers.find((x) => String(x.id) === String(el.dataset.id));
        if (!L) return;
        const stage = document.getElementById('studioFrameStage');
        if (!stage) return;
        const rect = stage.getBoundingClientRect();

        const move = (ev) => {
          L.x = Math.max(2, Math.min(98, ((ev.clientX - rect.left) / rect.width) * 100));
          L.y = Math.max(2, Math.min(98, ((ev.clientY - rect.top) / rect.height) * 100));
          el.style.left = L.x + '%';
          el.style.top = L.y + '%';
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    });
  }

  renderLayerList() {
    const list = document.getElementById('layerList');
    if (!list) return;
    if (!this.layers.length) {
      list.innerHTML = '<p class="hint" style="padding:14px 0">No layers yet — add a sticker or text first</p>';
      return;
    }
    list.innerHTML = [...this.layers].reverse().map((L) => `
      <div class="lyr-row" data-id="${L.id}">
        <div class="lyr-ic">${L.type === 'sticker' ? L.content : '<b style="font-size:14px">T</b>'}</div>
        <div class="grow">
          <b>${L.type === 'sticker' ? 'Sticker' : 'Text'}</b>
          <span>${L.type === 'text' ? L.content : 'Drag on frame to position'}</span>
        </div>
        <button type="button" class="mini-btn" data-act="size-" title="Smaller">−</button>
        <button type="button" class="mini-btn" data-act="size+" title="Bigger">+</button>
        <button type="button" class="mini-btn" data-act="vis" title="Show / hide">${L.vis ? '👁' : '🙈'}</button>
        <button type="button" class="mini-btn" data-act="up" title="Bring forward">↑</button>
        <button type="button" class="mini-btn" data-act="del" title="Delete">✕</button>
      </div>
    `).join('');

    list.onclick = (e) => {
      const btn = e.target.closest('.mini-btn');
      if (!btn) return;
      const row = e.target.closest('.lyr-row');
      if (!row) return;
      const id = row.dataset.id;
      const i = this.layers.findIndex((x) => String(x.id) === String(id));
      if (i === -1) return;
      const L = this.layers[i];
      const act = btn.dataset.act;

      if (act === 'vis') {
        L.vis = !L.vis;
      } else if (act === 'del') {
        this.layers.splice(i, 1);
        this.toast('Layer deleted');
      } else if (act === 'up' && i < this.layers.length - 1) {
        this.layers.splice(i, 1);
        this.layers.push(L);
        this.toast('Moved to front');
      } else if (act === 'size+') {
        if (L.type === 'text') L.size = Math.min(48, (L.size || 20) + 2);
        else L.size = Math.min(96, (L.size || 44) + 4);
      } else if (act === 'size-') {
        if (L.type === 'text') L.size = Math.max(12, (L.size || 20) - 2);
        else L.size = Math.max(20, (L.size || 44) - 4);
      }
      this.renderLayers();
      this.renderLayerList();
    };
  }

  /* ================= CAMERA SCREEN (LIVE PREVIEW, DOTS, EV, ZOOM, SHUTTER) ================= */
  initCameraScreen() {
    this.camVideo = document.getElementById('camVideo');

    // Build Snapchat-style frame selection dots with webapp frames
    this.buildDots();
    this.setCamFrame(0, false);

    // Dots row click
    document.getElementById('dotsRow')?.addEventListener('click', (e) => {
      const d = e.target.closest('.dot');
      if (d) this.setCamFrame(parseInt(d.dataset.i, 10), false);
    });

    // Stage swipe across frames
    const stage = document.getElementById('camStage');
    let swX = null;
    if (stage) {
      stage.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button, input, .cam-ev-slider-wrap, .cam-ev-ruler-wrap, .cam-stage-zoom')) return;
        swX = e.clientX;
      });
      stage.addEventListener('pointerup', (e) => {
        if (swX === null) return;
        const dx = e.clientX - swX;
        swX = null;
        if (Math.abs(dx) > 42) {
          const total = this.getAllFrames().length;
          this.setCamFrame((this.camFrameIndex + (dx < 0 ? 1 : -1) + total) % total);
        }
      });
      stage.addEventListener('pointercancel', () => { swX = null; });
    }

    // Dots row scroll
    const dotsRow = document.getElementById('dotsRow');
    if (dotsRow) {
      let scrollTimer = null;
      dotsRow.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          const center = dotsRow.scrollLeft + dotsRow.clientWidth / 2;
          let best = 0, bd = 1e9;
          [...dotsRow.children].forEach((d, i) => {
            const c = d.offsetLeft + d.offsetWidth / 2;
            const dd = Math.abs(c - center);
            if (dd < bd) { bd = dd; best = i; }
          });
          if (best !== this.camFrameIndex) {
            this.setCamFrame(best, false);
          }
        }, 60);
      });
    }

    // Flip Camera button
    const flipCam = () => {
      this.camFacingMode = this.camFacingMode === 'user' ? 'environment' : 'user';
      const simView = document.getElementById('simView');
      if (simView) {
        simView.classList.toggle('mirror', (this.state.mirror ?? true) && this.camFacingMode === 'user');
      }
      this.camTried = false;
      this.startCamera();
      this.toast('Camera flipped');
    };
    document.getElementById('flipCam')?.addEventListener('click', flipCam);

    // EV Ruler drag interaction
    this.initEvRuler();

    // EV range fallback slider
    const evRange = document.getElementById('camEvRange');
    evRange?.addEventListener('input', (e) => {
      this.setCameraEV(parseFloat(e.target.value));
    });

    // LUT circle button: opens LUT selection sheet
    document.getElementById('camBtnLutToggle')?.addEventListener('click', () => {
      this.openSheet('luts');
    });

    // Quick Zoom Buttons
    document.querySelectorAll('#camZoomBar .cam-stage-zoom-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const z = parseFloat(btn.dataset.camZoom || '1.0');
        this.setCameraZoom(z);
      });
    });

    // 2-Finger Pinch to Zoom
    if (stage) {
      let initialPinchDist = null;
      let initialPinchZoom = 1.0;
      stage.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          initialPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          initialPinchZoom = this.camZoom;
        }
      }, { passive: true });

      stage.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDist) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const factor = dist / initialPinchDist;
          this.setCameraZoom(initialPinchZoom * factor, false);
        }
      }, { passive: true });

      const endPinch = () => { initialPinchDist = null; };
      stage.addEventListener('touchend', endPinch);
      stage.addEventListener('touchcancel', endPinch);
    }

    // Shutter button: capture photo with zero quality loss and active LUT
    document.getElementById('shutter')?.addEventListener('click', () => {
      this.captureCameraPhoto();
    });

    // Frame chooser button: tap to open frame selection sheet
    document.getElementById('galThumb')?.addEventListener('click', () => {
      this.openSheet('framesel');
    });
  }

  buildDots() {
    const row = document.getElementById('dotsRow');
    if (!row) return;
    const frames = this.getAllFrames();

    row.innerHTML = frames.map((f, i) => {
      const isSelected = i === this.camFrameIndex;
      const num = i + 1;
      return `
        <button type="button" class="dot ${isSelected ? 'on' : ''}" data-i="${i}" title="${f.name}" aria-label="${f.name}">
          <span class="dot-num">${num}</span>
        </button>
      `;
    }).join('');
  }

  setCamFrame(i, scroll = true) {
    const frames = this.getAllFrames();
    if (!frames.length) return;
    this.camFrameIndex = (i + frames.length) % frames.length;
    triggerHaptic('selection');
    const f = frames[this.camFrameIndex];

    const nameEl = document.getElementById('camFrameName');
    if (nameEl) {
      const slideNote = f.capabilities?.photoCount > 1 ? ` (${f.capabilities.photoCount} Slides)` : '';
      nameEl.textContent = `${f.name}${slideNote}`;
    }
    const metaEl = document.getElementById('camFrameNameMeta');
    if (metaEl) metaEl.textContent = f.name.toUpperCase();

    document.querySelectorAll('#dotsRow .dot').forEach((d) => {
      d.classList.toggle('on', parseInt(d.dataset.i, 10) === this.camFrameIndex);
    });

    if (scroll) {
      const row = document.getElementById('dotsRow');
      const d = row?.children?.[this.camFrameIndex];
      if (d && row) {
        row.scrollTo({
          left: d.offsetLeft - row.clientWidth / 2 + d.offsetWidth / 2,
          behavior: 'smooth'
        });
      }
    }

    this.renderCamFrameOverlay();
  }

  renderCamFrameOverlay() {
    const overlayCanvas = document.getElementById('camFrameOverlayCanvas');
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    const viewport = overlayCanvas.parentElement;
    const vw = viewport?.clientWidth || 392;
    const vh = viewport?.clientHeight || 600;

    overlayCanvas.width = vw;
    overlayCanvas.height = vh;
    ctx.clearRect(0, 0, vw, vh);

    const frames = this.getAllFrames();
    const frameDef = frames[this.camFrameIndex] || FRAME_CATALOG[0];

    const scaleX = vw / LOGICAL_W;
    const scaleY = vh / LOGICAL_H;

    ctx.save();

    // 1. Draw frame background
    if (frameDef.pattern === 'citrus-gradient') {
      const grad = ctx.createLinearGradient(0, 0, 0, vh);
      grad.addColorStop(0, '#FFF7ED');
      grad.addColorStop(0.45, '#FDE5BE');
      grad.addColorStop(1, '#F6C9A3');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, vw, vh);
    } else {
      ctx.fillStyle = frameDef.background || '#FAF7F2';
      ctx.fillRect(0, 0, vw, vh);
    }

    // 2. Clear apertures with transparent cutouts so camera video shines through
    const aps = frameDef.apertures || [{ x: 180, y: 180, w: 1800, h: 2340 }];
    aps.forEach((ap, idx) => {
      const ax = ap.x * scaleX;
      const ay = ap.y * scaleY;
      const aw = ap.w * scaleX;
      const ah = ap.h * scaleY;

      ctx.clearRect(ax, ay, aw, ah);

      // Aperture guide outline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(ax, ay, aw, ah);
      ctx.setLineDash([]);

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ax, ay, aw, ah);

      // Slide label badge
      if (aps.length > 1) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(ax + 8, ay + 8, 54, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`Slide ${idx + 1}`, ax + 14, ay + 23);
      }
    });

    // 3. Draw border if specified
    if (frameDef.borderColor) {
      ctx.strokeStyle = frameDef.borderColor;
      ctx.lineWidth = Math.max(2, Math.round(16 * scaleX));
      ctx.strokeRect(0, 0, vw, vh);
    }

    ctx.restore();
  }

  setCameraZoom(zoomVal, updateButtons = true) {
    const clamped = Math.min(5.0, Math.max(0.5, zoomVal));
    this.camZoom = parseFloat(clamped.toFixed(2));

    const zoomInd = document.getElementById('camZoomIndicator');
    if (zoomInd) {
      zoomInd.textContent = `${this.camZoom.toFixed(1)}x`;
      zoomInd.style.display = 'block';
      zoomInd.style.opacity = '1';
      clearTimeout(this._zoomIndTimeout);
      this._zoomIndTimeout = setTimeout(() => {
        zoomInd.style.opacity = '0';
        setTimeout(() => { zoomInd.style.display = 'none'; }, 200);
      }, 1200);
    }

    if (updateButtons) {
      document.querySelectorAll('#camZoomBar .cam-stage-zoom-btn').forEach((b) => {
        const bz = parseFloat(b.dataset.camZoom || '1');
        b.classList.toggle('active', Math.abs(bz - this.camZoom) < 0.2);
      });
    }

    const track = this.camStream?.getVideoTracks()?.[0];
    if (track && typeof track.getCapabilities === 'function') {
      const caps = track.getCapabilities();
      if (caps.zoom) {
        const minZ = caps.zoom.min || 1;
        const maxZ = caps.zoom.max || 5;
        const hwZoom = Math.min(maxZ, Math.max(minZ, this.camZoom));
        track.applyConstraints({ advanced: [{ zoom: hwZoom }] }).catch(() => {});
      }
    }

    this.applyCameraVideoTransform();
  }

  setCameraEV(evVal) {
    const clamped = Math.min(2.0, Math.max(-2.0, evVal));
    this.camEv = parseFloat(clamped.toFixed(1));

    const valText = document.getElementById('camEvValText');
    if (valText) {
      valText.textContent = `${this.camEv > 0 ? '+' : ''}${this.camEv.toFixed(1)} EV`;
    }

    const badge = document.getElementById('camEvBadge');
    if (badge) {
      badge.textContent = this.camEv === 0 ? '☀️ EV' : `${this.camEv > 0 ? '+' : ''}${this.camEv.toFixed(1)}`;
    }

    const track = this.camStream?.getVideoTracks()?.[0];
    if (track && typeof track.getCapabilities === 'function') {
      const caps = track.getCapabilities();
      if (caps.exposureCompensation) {
        const minEV = caps.exposureCompensation.min ?? -2;
        const maxEV = caps.exposureCompensation.max ?? 2;
        const hwEV = Math.min(maxEV, Math.max(minEV, this.camEv));
        track.applyConstraints({ advanced: [{ exposureCompensation: hwEV }] }).catch(() => {});
      }
    }

    this.applyCameraVideoFilters();
    // Sync ruler visual position
    this._syncEvRuler();
  }

  _syncEvRuler() {
    const valEl = document.getElementById('camEvRulerVal');
    if (valEl) {
      valEl.textContent = this.camEv === 0 ? '0.0' : `${this.camEv > 0 ? '+' : ''}${this.camEv.toFixed(1)}`;
    }
    // Shift the ruler track so the current EV value is under the center line
    const track = document.getElementById('camEvRulerTrack');
    if (track) {
      // 1 EV = 32px of track movement
      const px = this.camEv * 32;
      track.style.transform = `translateX(${-px}px)`;
    }
  }

  initEvRuler() {
    const track = document.getElementById('camEvRulerTrack');
    const ruler = document.getElementById('camEvRuler');
    if (!track || !ruler) return;

    // Build tick marks: from -2.0 to +2.0 in steps of 0.1
    const steps = [];
    for (let v = -20; v <= 20; v++) {
      const ev = v / 10;
      const isMajor = Number.isInteger(ev);
      const isHalf = Math.abs(v % 5) === 0;
      steps.push({ ev, isMajor, isHalf });
    }
    track.innerHTML = steps.map(({ ev, isMajor, isHalf }) => {
      const cls = isMajor ? 'ev-tick major' : isHalf ? 'ev-tick half' : 'ev-tick';
      const label = isMajor ? `<span class="ev-tick-label">${ev > 0 ? '+' : ''}${ev.toFixed(0)}</span>` : '';
      return `<div class="${cls}">${label}</div>`;
    }).join('');

    // Drag to adjust EV
    let dragStartX = null;
    let dragStartEv = 0;

    const onPointerDown = (e) => {
      dragStartX = e.clientX;
      dragStartEv = this.camEv;
      ruler.setPointerCapture(e.pointerId);
      ruler.classList.add('dragging');
      e.preventDefault();
    };
    const onPointerMove = (e) => {
      if (dragStartX === null) return;
      const dx = e.clientX - dragStartX;
      // 32px per 1.0 EV
      const deltaEv = -dx / 32;
      this.setCameraEV(dragStartEv + deltaEv);
      const evRange = document.getElementById('camEvRange');
      if (evRange) evRange.value = this.camEv;
    };
    const onPointerUp = () => {
      dragStartX = null;
      ruler.classList.remove('dragging');
    };

    ruler.addEventListener('pointerdown', onPointerDown);
    ruler.addEventListener('pointermove', onPointerMove);
    ruler.addEventListener('pointerup', onPointerUp);
    ruler.addEventListener('pointercancel', onPointerUp);

    this._syncEvRuler();
  }

  applyCameraVideoTransform() {
    if (!this.camVideo) return;
    const mirror = this.camFacingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    this.camVideo.style.transform = `${mirror} scale(${this.camZoom})`;
  }

  applyCameraVideoFilters() {
    if (!this.camVideo) return;
    const b = (1 + this.camEv * 0.22).toFixed(2);
    const c = (1 + Math.abs(this.camEv) * 0.05).toFixed(2);
    const lutFilter = this.isLutBypassed ? 'none' : this.getLutCssFilter(this.activeLut, this.lutIntensity);

    const baseFilter = `brightness(${b}) contrast(${c})`;
    this.camVideo.style.filter = lutFilter !== 'none' ? `${baseFilter} ${lutFilter}` : baseFilter;
  }

  async startCamera() {
    this.camVideo = document.getElementById('camVideo');
    const simView = document.getElementById('simView');

    if (this.camStream) {
      this.camStream.getTracks().forEach((t) => t.stop());
      this.camStream = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (this.camVideo) this.camVideo.style.display = 'none';
      if (simView) simView.style.display = 'block';
      this.renderCamFrameOverlay();
      this.toast('Simulated camera viewfinder active');
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: this.camFacingMode },
          width: { min: 1280, ideal: 3840, max: 7680 },
          height: { min: 720, ideal: 2160, max: 4320 },
          frameRate: { ideal: 60, min: 24 }
        },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.camStream = stream;
      if (this.camVideo) {
        this.camVideo.srcObject = stream;
        this.camVideo.style.display = 'block';
        await this.camVideo.play();
      }
      if (simView) simView.style.display = 'none';

      this.applyCameraVideoTransform();
      this.applyCameraVideoFilters();
      this.setCameraZoom(this.camZoom);
      this.setCameraEV(this.camEv);
      this.renderCamFrameOverlay();
    } catch (err) {
      console.warn('[Camera] getUserMedia high-res fallback, attempting standard constraints:', err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: this.camFacingMode } },
          audio: false
        });
        this.camStream = stream;
        if (this.camVideo) {
          this.camVideo.srcObject = stream;
          this.camVideo.style.display = 'block';
          await this.camVideo.play();
        }
        if (simView) simView.style.display = 'none';
        this.applyCameraVideoTransform();
        this.applyCameraVideoFilters();
        this.renderCamFrameOverlay();
      } catch (err2) {
        console.warn('[Camera] getUserMedia fallback to simulated:', err2);
        if (this.camVideo) this.camVideo.style.display = 'none';
        if (simView) simView.style.display = 'block';
        this.renderCamFrameOverlay();
        this.toast('Live camera blocked — simulated viewfinder');
      }
    }
  }

  stopCamera() {
    if (this.camStream) {
      this.camStream.getTracks().forEach((t) => t.stop());
      this.camStream = null;
    }
    if (this.camVideo) {
      this.camVideo.srcObject = null;
    }
  }

  playShutterSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const actx = new AudioContext();
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, actx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, actx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start();
      osc.stop(actx.currentTime + 0.09);
    } catch (e) {}
  }

  async captureCameraPhoto() {
    triggerHaptic('heavy');
    const fl = document.getElementById('flash');
    if (fl) {
      fl.classList.add('on');
      setTimeout(() => fl.classList.remove('on'), 140);
    }

    if (this.state.sound ?? true) {
      this.playShutterSound();
    }

    const track = this.camStream?.getVideoTracks()?.[0];
    let rawImg = null;
    let rawW = 1080;
    let rawH = 1350;

    // 1. Utilize full hardware camera sensor power via ImageCapture.takePhoto()
    if (track && typeof window.ImageCapture === 'function') {
      try {
        const imageCapture = new ImageCapture(track);
        const photoBlob = await imageCapture.takePhoto({ fillLightMode: 'off' });
        rawImg = await new Promise((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = URL.createObjectURL(photoBlob);
        });
        rawW = rawImg.naturalWidth || rawImg.width;
        rawH = rawImg.naturalHeight || rawImg.height;
      } catch (err) {
        console.warn('[Camera] ImageCapture native photo error, falling back to stream frame:', err);
      }
    }

    // 2. Fallback to video element stream frame if ImageCapture unavailable or failed
    if (!rawImg) {
      if (this.camVideo && this.camVideo.readyState >= 2 && this.camVideo.style.display !== 'none') {
        rawImg = this.camVideo;
        rawW = this.camVideo.videoWidth || 1920;
        rawH = this.camVideo.videoHeight || 1080;
      }
    }

    // 3. Compose high quality canvas at full native resolution
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = rawW;
    snapCanvas.height = rawH;
    const sctx = snapCanvas.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';

    // Apply EV Filter if non-zero
    if (this.camEv !== 0) {
      const b = 1 + this.camEv * 0.22;
      const c = 1 + Math.abs(this.camEv) * 0.05;
      sctx.filter = `brightness(${b}) contrast(${c})`;
    }

    // Apply active LUT filter
    const lutFilter = this.isLutBypassed ? 'none' : this.getLutCssFilter(this.activeLut, this.lutIntensity);
    if (lutFilter !== 'none') {
      sctx.filter = sctx.filter !== 'none' ? `${sctx.filter} ${lutFilter}` : lutFilter;
    }

    // Apply User Facing mirror if front camera
    if (this.camFacingMode === 'user') {
      sctx.translate(rawW, 0);
      sctx.scale(-1, 1);
    }

    // Apply digital zoom crop if zoomed in
    if (this.camZoom > 1.0) {
      const cropW = rawW / this.camZoom;
      const cropH = rawH / this.camZoom;
      const cropX = (rawW - cropW) / 2;
      const cropY = (rawH - cropH) / 2;
      if (rawImg) {
        sctx.drawImage(rawImg, cropX, cropY, cropW, cropH, 0, 0, rawW, rawH);
      } else {
        this.fillPlaceholderGradient(sctx, rawW, rawH);
      }
    } else {
      if (rawImg) {
        sctx.drawImage(rawImg, 0, 0, rawW, rawH);
      } else {
        this.fillPlaceholderGradient(sctx, rawW, rawH);
      }
    }

    const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.98);
    const finalImg = new Image();
    finalImg.onload = () => {
      const assetId = `cam-asset-${Date.now()}`;
      this.sceneStore.assets.set(assetId, { img: finalImg, w: rawW, h: rawH });

      // Target current active aperture or slide
      const targetAp = this.selectedAperture || 0;
      this.sceneStore.scene.photos[targetAp] = {
        id: `photo-${Date.now()}`,
        assetId,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0
      };

      // Update camera gallery thumb
      const g = document.getElementById('galThumb');
      if (g) {
        g.classList.remove('photo-bg', 'p1');
        g.style.backgroundImage = `url(${dataUrl})`;
      }

      // Re-render Frames editor canvas
      this.renderFramesCanvas();
      this.updateSlidePills();
      this.updateSlideReplaceBar();

      // Advance to next empty aperture if available
      const frameDef = this.getFrameDef(this.activeFrameId);
      if (frameDef.apertures && frameDef.apertures.length > 1) {
        for (let i = 0; i < frameDef.apertures.length; i++) {
          if (!this.sceneStore.scene.photos[i]) {
            this.selectedAperture = i;
            this.updateSlidePills();
            this.updateSlideReplaceBar();
            break;
          }
        }
      }

      const lutTitle = this.getLutTitle(this.activeLut);
      this.toast(`Photo captured into Slide ${targetAp + 1} (${lutTitle})! 📸`);
    };
    finalImg.src = dataUrl;
  }

  fillPlaceholderGradient(ctx, w, h) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(0.5, '#ec4899');
    grad.addColorStop(1, '#3b82f6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  /* ================= SHEET CONTROLLER ================= */
  initSheets() {
    document.getElementById('sheetVeil')?.addEventListener('click', () => this.closeSheets());
    document.querySelectorAll('#mobileAppContainer .sheet-handle').forEach((h) => {
      h.addEventListener('click', () => this.closeSheets());
    });
  }

  openSheet(secOrId) {
    this.closeSheets();
    const veil = document.getElementById('sheetVeil');
    const unifiedSheet = document.getElementById('sheet');

    // Check if secOrId is a section name in the unified sheet
    const targetSec = document.querySelector(`#mobileAppContainer .sheet-sec[data-sec="${secOrId}"]`);
    if (targetSec && unifiedSheet) {
      document.querySelectorAll('#mobileAppContainer .sheet-sec').forEach((s) => {
        s.classList.toggle('on', s.dataset.sec === secOrId);
      });
      if (veil) veil.classList.add('on');
      unifiedSheet.classList.add('on');
      return;
    }

    // Check if secOrId is a separate sheet element ID
    const separateSheet = document.getElementById(secOrId);
    if (separateSheet) {
      if (veil) veil.classList.add('on');
      separateSheet.classList.add('on');
    }
  }

  closeSheets() {
    document.querySelectorAll('#mobileAppContainer .sheet.on, #mobileAppContainer .sheet-sec.on').forEach((s) => {
      s.classList.remove('on');
    });
    document.getElementById('sheetVeil')?.classList.remove('on');
    document.getElementById('ctxSheet')?.classList.remove('on');
    document.getElementById('ctxVeil')?.classList.remove('on');
  }

  /* ================= EDITOR & CANVAS ================= */
  openEditor(id) {
    this.state.photo = id;
    this.go('scr-editor');
  }

  loadUserMediaIntoMobile(media) {
    this.state.userMedia = media;
    const assetId = `upload-${Date.now()}`;
    const img = media.img || media;
    this.sceneStore.assets.set(assetId, {
      img,
      w: img.naturalWidth || img.width || 1080,
      h: img.naturalHeight || img.height || 1080
    });
    const targetIdx = this.selectedAperture || 0;
    this.sceneStore.scene.photos[targetIdx] = {
      id: `photo-${Date.now()}`,
      assetId,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0
    };
    this.renderStudioCanvas();
    this.updateSlideReplaceBar();
    this.toast(`Slide ${targetIdx + 1} updated ✓`);
  }

  clampOffsets() {}

  applyTransform() {}

  setZoom(z) {}

  renderEditor() {
    this.renderStudioCanvas();
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

  async renderMasterExportBlob(quality = 0.98) {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready;
    }
    const W = 1080;
    const H = 1350;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = W;
    offCanvas.height = H;
    const ctx = offCanvas.getContext('2d');

    const frameDef = this.getFrameDef ? this.getFrameDef(this.activeFrameId) : (getFrameById(this.state?.frame) || FRAME_CATALOG[0]);
    const lutFilter = this.isLutBypassed ? 'none' : (this.getLutCssFilter ? this.getLutCssFilter(this.activeLut, this.lutIntensity) : 'none');

    if (frameDef && frameDef.isUploaded) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = frameDef.background || '#FAF7F2';
      ctx.fillRect(0, 0, W, H);

      const ap = frameDef.apertures?.[0];
      const photo = this.sceneStore?.scene?.photos?.[0];
      if (ap && photo && this.sceneStore?.assets) {
        const asset = this.sceneStore.assets.get(photo.assetId);
        if (asset?.img) {
          const ax = (ap.x / LOGICAL_W) * W;
          const ay = (ap.y / LOGICAL_H) * H;
          const aw = (ap.w / LOGICAL_W) * W;
          const ah = (ap.h / LOGICAL_H) * H;
          ctx.save();
          ctx.beginPath();
          ctx.rect(ax, ay, aw, ah);
          ctx.clip();
          if (lutFilter !== 'none') ctx.filter = lutFilter;
          ctx.drawImage(asset.img, ax, ay, aw, ah);
          ctx.restore();
        }
      }

      if (frameDef.dataUrl) {
        await new Promise((res) => {
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, 0, 0, W, H); res(); };
          img.onerror = res;
          img.src = frameDef.dataUrl;
        });
      }
    } else if (this.sceneStore?.scene && this.sceneStore?.assets) {
      const photos = this.sceneStore.scene.photos || [];
      photos.forEach((p) => {
        if (p) p._lutFilter = lutFilter;
      });

      renderScene(ctx, this.sceneStore.scene, this.sceneStore.assets, {
        targetWidth: W,
        targetHeight: H,
        isExport: true,
        editorState: { selectedId: null, gridVisible: false, guidesVisible: false }
      });
    }

    return new Promise((res, rej) => {
      offCanvas.toBlob((blob) => {
        if (blob) res(blob);
        else rej(new Error('Failed to encode master canvas'));
      }, 'image/jpeg', quality);
    });
  }

  async saveCurrentFrameToGallery() {
    await triggerHaptic('medium');
    this.toast('Saving to Gallery…');
    try {
      const blob = await this.renderMasterExportBlob();
      const filename = `PocketFrames_${this.state?.frame || 'studio'}_${Date.now()}.jpg`;
      await saveToDeviceGallery({ blob, filename });
      await triggerHaptic('success');
      this.toast('Saved to Gallery ✓');
    } catch (err) {
      console.error('[MobileApp] saveCurrentFrameToGallery error:', err);
      this.toast('Could not save photo');
    }
  }

  async shareCurrentFrameSheet() {
    await triggerHaptic('light');
    this.toast('Opening Share Sheet…');
    try {
      const blob = await this.renderMasterExportBlob();
      const filename = `PocketFrames_${this.state?.frame || 'studio'}_${Date.now()}.jpg`;
      await shareFramedPhoto({
        blob,
        filename,
        title: 'Pocket Frames Creation',
        text: 'Framed with Pocket Frames'
      });
    } catch (err) {
      if (!err.canceled) {
        console.error('[MobileApp] shareCurrentFrameSheet error:', err);
        this.toast('Could not open share sheet');
      }
    }
  }

  exportStudioMaster() {
    return this.saveCurrentFrameToGallery();
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
      const isActive = b.dataset.ts === ts;
      b.classList.toggle('on', isActive);
      b.setAttribute('aria-pressed', String(isActive)); // keep ARIA state in sync
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
      if (device) {
        if (window.innerWidth <= 768) {
          device.style.transform = 'none';
        } else {
          const s = Math.min((window.innerWidth - 20) / 412, (window.innerHeight - 70) / 866, 1);
          device.style.transform = `scale(${s})`;
        }
      }
      if (this.current === 'scr-camera') this.renderCamFrameOverlay();
      if (this.current === 'scr-editor') this.renderStudioCanvas();
    };
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', () => setTimeout(fit, 80));
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

      // 1. Home Screen (User ID Card) Buttons
      if (e.target.closest('#btnEditIdCard, #btnEditProfileSheet')) {
        this.openEditIdSheet();
        return;
      }
      if (e.target.closest('#btnShareIdCard')) {
        this.shareIdCard();
        return;
      }
      if (e.target.closest('#btnSaveEditId')) {
        this.saveEditId();
        return;
      }
      if (e.target.closest('#btnCancelEditId')) {
        this.closeSheets();
        return;
      }

      // 2. Studio Frames Editor Screen Toolbar & Actions
      if (e.target.closest('#mobBtnFrames')) {
        this.openFramesSheet('all');
        return;
      }
      if (e.target.closest('#mobBtnUploadPhoto')) {
        this.triggerPhotoUpload();
        return;
      }
      if (e.target.closest('#mobBtnStickers')) {
        this.openStickersSheet('all');
        return;
      }
      if (e.target.closest('#mobBtnText')) {
        this.openTextSheet();
        return;
      }
      if (e.target.closest('#mobBtnLayers')) {
        this.openLayersSheet();
        return;
      }
      if (e.target.closest('#mobBtnClearScene')) {
        this.resetStudioScene();
        return;
      }
      if (e.target.closest('#mobBtnSaveGallery, #mobBtnExportDirect, #mobBtnSaveExport')) {
        this.saveCurrentFrameToGallery();
        return;
      }
      if (e.target.closest('#mobBtnShareSheet')) {
        this.shareCurrentFrameSheet();
        return;
      }
      if (e.target.closest('#btnAddTextConfirm')) {
        this.confirmAddCustomText();
        return;
      }
      if (e.target.closest('#btnCancelText')) {
        this.closeSheets();
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
            const isAll = c.dataset.filter === 'all';
            c.classList.toggle('on', isAll);
            if (c.getAttribute('role') === 'tab') {
              c.setAttribute('aria-selected', String(isAll));
            } else if (c.getAttribute('role') === 'radio') {
              c.setAttribute('aria-checked', String(isAll));
            }
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
          parent.querySelectorAll('.chip').forEach((c) => {
            const isSel = c === chip;
            c.classList.toggle('on', isSel);
            if (c.getAttribute('role') === 'tab') {
              c.setAttribute('aria-selected', String(isSel));
            } else if (c.getAttribute('role') === 'radio') {
              c.setAttribute('aria-checked', String(isSel));
            }
          });
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

    // 9b. Camera & frames switches in settings
    document.getElementById('swGrid')?.addEventListener('change', (e) => {
      this.state.grid = e.target.checked;
      document.getElementById('camGuides')?.classList.toggle('show', this.state.grid);
    });
    document.getElementById('swSound')?.addEventListener('change', (e) => {
      this.state.sound = e.target.checked;
    });
    document.getElementById('swMirror')?.addEventListener('change', (e) => {
      this.state.mirror = e.target.checked;
      document.getElementById('simView')?.classList.toggle('mirror', this.state.mirror && this.camFacingMode === 'user');
    });
    document.getElementById('swWater')?.addEventListener('change', (e) => {
      this.state.water = e.target.checked;
      document.body.dataset.water = this.state.water ? 'on' : 'off';
    });

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

    // 12a. Keyboard switch toggle (Space or Enter on role="switch" / .switch checkboxes)
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('#mobileAppContainer .switch input[type="checkbox"]')) {
        e.preventDefault();
        e.target.checked = !e.target.checked;
        e.target.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // 12b. Keyboard shortcuts in Editor
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
