/**
 * Pocket Frames - AI Photography Director & Post Studio Modal
 * Full interactive liquid glass studio for 47 DAYS / 47 FRAMES campaign.
 */

import { store } from '../state.js';
import { fetchAiStatus, requestCreatePost, cancelActiveAiRequest } from './geminiClient.js';
import { applyAiComposition } from './compositionApplier.js';
import { CAPTION_STYLES, AI_STATUS } from './aiTypes.js';
import { DayWheelPicker } from './dayWheelPicker.js';
import { triggerPickerTick } from '../utils/appleHapticAudio.js';

export class AiStudioModal {
  constructor() {
    this.modal = document.getElementById('aiStudioModal');
    this.serverStatus = { configured: false, status: 'unknown', model: 'gemini-1.5-flash' };
    this.currentData = null;
    this.selectedStyle = 'minimal';
    this.isApplying = false;

    this.initElements();
    this.initWheelPicker();
    this.bindEvents();
    this.checkStatus();
  }

  initElements() {
    // Buttons & Steppers
    this.btnClose = document.getElementById('btnCloseAiStudio');
    this.btnCancelAi = document.getElementById('btnCancelAi');
    this.btnDayPrev = document.getElementById('btnDayPrev');
    this.btnDayNext = document.getElementById('btnDayNext');
    this.btnOpenDayWheel = document.getElementById('btnOpenDayWheel');
    this.displayDayNumber = document.getElementById('displayDayNumber');
    this.inputDayNumber = document.getElementById('inputDayNumber');
    this.aiStatusBadge = document.getElementById('aiStatusBadge');
    this.aiStatusText = document.getElementById('aiStatusText');
    this.aiStatusDot = document.getElementById('aiStatusDot');
    this.progressFill = document.getElementById('progressFill') || document.getElementById('aiProgressFill');

    // Sections & States
    this.stateLoading = document.getElementById('aiStateLoading');
    this.stateError = document.getElementById('aiStateError');
    this.stateContent = document.getElementById('aiStateContent');
    this.errorMessageText = document.getElementById('aiErrorMessageText');
    this.btnRetryAi = document.getElementById('btnRetryAi');

    // Content Display Elements
    this.inputPostTitle = document.getElementById('inputPostTitle') || document.getElementById('photoTitle');
    this.genreTabsContainer = document.getElementById('genreTabsContainer');
    this.genreBadgePrimary = document.getElementById('genreBadgePrimary');

    // Scores & Portfolio
    this.badgePortfolioRating = document.getElementById('badgePortfolioRating') || document.getElementById('portfolioRatingValue');
    this.textPortfolioReason = document.getElementById('textPortfolioReason') || document.getElementById('aiQuoteText');
    this.badgeMobileStrength = document.getElementById('badgeMobileStrength') || document.getElementById('mobileStrengthValue');
    this.badgeOppoRelevance = document.getElementById('badgeOppoRelevance') || document.getElementById('oppoRelevanceValue');
    this.scoreComposition = document.getElementById('scoreComposition');
    this.scoreStory = document.getElementById('scoreStory');
    this.scoreVisualImpact = document.getElementById('scoreVisualImpact');
    this.scoreBackground = document.getElementById('scoreBackground');

    // Composition Card
    this.compStrengthsList = document.getElementById('compStrengthsList');
    this.compWeaknessesList = document.getElementById('compWeaknessesList');
    this.compReasonText = document.getElementById('compReasonText');
    this.compCoordsReadout = document.getElementById('compCoordsReadout') || document.getElementById('compCenterMeta');
    this.compZoomReadout = document.getElementById('compZoomReadout') || document.getElementById('compZoomMeta');
    this.compConfidenceReadout = document.getElementById('compConfidenceReadout') || document.getElementById('compConfidenceMeta');
    this.compCritiqueText = document.getElementById('compCritiqueText');
    this.btnApplyComposition = document.getElementById('btnApplyComposition');
    this.btnIgnoreComposition = document.getElementById('btnIgnoreComposition');

    // Captions
    this.captionTabsContainer = document.getElementById('captionTabsContainer');
    this.textareaActiveCaption = document.getElementById('textareaActiveCaption') || document.getElementById('captionText');
    this.btnCopyCaption = document.getElementById('btnCopyCaption');

    // Hashtags & Alt Text
    this.inputHashtags = document.getElementById('inputHashtags') || document.getElementById('hashtagText');
    this.btnCopyHashtags = document.getElementById('btnCopyHashtags');
    this.inputAltText = document.getElementById('inputAltText') || document.getElementById('altText');
    this.btnCopyAltText = document.getElementById('btnCopyAltText');
    this.inputStoryText = document.getElementById('inputStoryText') || document.getElementById('storyText');
    this.btnCopyStoryText = document.getElementById('btnCopyStoryText');

    // Master Copy Action
    this.btnCopyCompletePackage = document.getElementById('btnCopyCompletePackage') || document.getElementById('copyAllBtn');
  }

  initWheelPicker() {
    this.dayWheelPicker = new DayWheelPicker({
      totalDays: 47,
      initialDay: 18,
      onApply: (day) => {
        this.setDay(day);
      }
    });
  }

  bindEvents() {
    // Open/Close
    const btnOpen = document.getElementById('btnOpenAiStudio');
    if (btnOpen) btnOpen.addEventListener('click', (e) => {
      e.preventDefault();
      this.open();
    });

    if (this.btnClose) this.btnClose.addEventListener('click', () => this.close());
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    // Wheel Picker Trigger Button
    if (this.btnOpenDayWheel) {
      this.btnOpenDayWheel.addEventListener('click', () => {
        const current = parseInt(this.inputDayNumber?.value, 10) || 18;
        this.dayWheelPicker.open(current);
      });

      // Discrete mouse wheel scrolling on header day pill & control: exactly 1 day per notch
      let headerWheelAccumulator = 0;
      let lastHeaderStepTime = 0;
      let headerWheelResetTimer = null;
      const HEADER_STEP_COOLDOWN_MS = 140; // Lock out burst events from the same physical notch
      const HEADER_WHEEL_THRESHOLD = 40;

      const onHeaderWheel = (e) => {
        e.preventDefault();
        const now = performance.now();

        // If stepped within refractory cooldown, ignore trailing events from the same notch
        if (now - lastHeaderStepTime < HEADER_STEP_COOLDOWN_MS) {
          headerWheelAccumulator = 0;
          return;
        }

        headerWheelAccumulator += e.deltaY;

        if (Math.abs(headerWheelAccumulator) >= HEADER_WHEEL_THRESHOLD) {
          const step = headerWheelAccumulator > 0 ? 1 : -1;
          headerWheelAccumulator = 0;
          lastHeaderStepTime = now;

          const current = parseInt(this.inputDayNumber?.value, 10) || 18;
          const newDay = Math.max(1, Math.min(47, current + step));
          if (newDay !== current) {
            triggerPickerTick();
            this.setDay(newDay);
          }
        }

        clearTimeout(headerWheelResetTimer);
        headerWheelResetTimer = setTimeout(() => {
          headerWheelAccumulator = 0;
        }, 160);
      };

      this.btnOpenDayWheel.addEventListener('wheel', onHeaderWheel, { passive: false });

      const stepperControl = document.querySelector('.ai-frame-nav') || document.querySelector('.day-stepper-control');
      if (stepperControl && stepperControl !== this.btnOpenDayWheel) {
        stepperControl.addEventListener('wheel', onHeaderWheel, { passive: false });
      }
    }

    // Stepper Quick Nudges
    if (this.btnDayPrev) {
      this.btnDayPrev.addEventListener('click', () => {
        const current = parseInt(this.inputDayNumber?.value, 10) || 18;
        triggerPickerTick();
        this.setDay(Math.max(1, current - 1));
      });
    }

    if (this.btnDayNext) {
      this.btnDayNext.addEventListener('click', () => {
        const current = parseInt(this.inputDayNumber?.value, 10) || 18;
        triggerPickerTick();
        this.setDay(Math.min(47, current + 1));
      });
    }

    if (this.inputDayNumber) {
      this.inputDayNumber.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) this.setDay(Math.max(1, Math.min(47, val)));
      });
    }

    // Genre Tabs
    if (this.genreTabsContainer) {
      this.genreTabsContainer.addEventListener('click', (e) => {
        const tab = e.target.closest('.ai-tab');
        if (!tab) return;
        this.genreTabsContainer.querySelectorAll('.ai-tab').forEach(t => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        if (this.genreBadgePrimary) this.genreBadgePrimary.value = tab.dataset.genre || tab.textContent.trim();
      });
    }

    // Retry & Cancel
    if (this.btnRetryAi) this.btnRetryAi.addEventListener('click', () => this.runAnalysis());
    if (this.btnCancelAi) this.btnCancelAi.addEventListener('click', () => this.cancel());

    // Apply Composition
    if (this.btnApplyComposition) {
      this.btnApplyComposition.addEventListener('click', () => {
        if (!this.currentData?.composition) return;
        const applied = applyAiComposition(store, this.currentData.composition);
        if (applied) {
          this.btnApplyComposition.textContent = '✓ Applied to Canvas';
          this.btnApplyComposition.classList.add('applied');
          if (this.btnIgnoreComposition) {
            this.btnIgnoreComposition.disabled = true;
            this.btnIgnoreComposition.style.opacity = '0.5';
          }
          setTimeout(() => {
            if (this.btnApplyComposition) {
              this.btnApplyComposition.textContent = 'Apply to Canvas';
              this.btnApplyComposition.classList.remove('applied');
            }
          }, 2500);
        }
      });
    }

    if (this.btnIgnoreComposition) {
      this.btnIgnoreComposition.addEventListener('click', () => {
        const compSection = document.getElementById('aiCompositionCard');
        if (compSection) compSection.style.opacity = '0.5';
        this.btnIgnoreComposition.textContent = 'Ignored';
        this.btnIgnoreComposition.disabled = true;
        if (this.btnApplyComposition) this.btnApplyComposition.style.opacity = '0.5';
      });
    }

    // Clipboard Copy Handlers
    const getFieldVal = (el) => {
      if (!el) return '';
      return ('value' in el ? el.value : el.textContent) || '';
    };

    this.setupCopyButton(this.btnCopyCaption, () => getFieldVal(this.textareaActiveCaption));
    this.setupCopyButton(this.btnCopyHashtags, () => getFieldVal(this.inputHashtags));
    this.setupCopyButton(this.btnCopyAltText, () => getFieldVal(this.inputAltText));
    this.setupCopyButton(this.btnCopyStoryText, () => getFieldVal(this.inputStoryText));

    // Master Post Package Copy
    if (this.btnCopyCompletePackage) {
      this.btnCopyCompletePackage.addEventListener('click', () => {
        const title = getFieldVal(this.inputPostTitle);
        const caption = getFieldVal(this.textareaActiveCaption);
        const hashtags = getFieldVal(this.inputHashtags);
        const story = getFieldVal(this.inputStoryText);

        const fullPost = [
          title ? `"${title.trim()}"` : null,
          caption.trim(),
          story ? `—\n${story.trim()}` : null,
          hashtags ? `.\n.\n.\n${hashtags.trim()}` : null
        ].filter(Boolean).join('\n\n');

        navigator.clipboard.writeText(fullPost);
        this.flashCopySuccess(this.btnCopyCompletePackage, '✓ Copied Post Package!');
      });
    }
  }

  async checkStatus() {
    this.serverStatus = await fetchAiStatus();
    this.renderStatusBadge();
  }

  renderStatusBadge() {
    if (this.serverStatus.configured) {
      if (this.aiStatusText) this.aiStatusText.textContent = `Gemini · ${this.serverStatus.model || 'flash-lite'}`;
      if (this.aiStatusDot) this.aiStatusDot.className = 'ai-dot ai-dot--live';
    } else {
      if (this.aiStatusText) this.aiStatusText.textContent = 'DEMO MODE';
      if (this.aiStatusDot) this.aiStatusDot.className = 'ai-dot';
    }
  }

  setDay(day) {
    const clamped = Math.max(1, Math.min(47, day));
    if (this.inputDayNumber) this.inputDayNumber.value = clamped;
    if (this.displayDayNumber) this.displayDayNumber.textContent = clamped;
    if (this.progressFill) {
      const pct = (clamped / 47) * 100;
      this.progressFill.style.width = pct + '%';
    }
    store.setAiState({ dayNumber: clamped });
  }

  open() {
    if (!this.modal) return;
    this.modal.classList.remove('hidden');
    this.checkStatus();

    const state = store.getState();
    const day = state.ai?.dayNumber || 18;
    this.setDay(day);

    if (state.ai?.postData) {
      this.currentData = state.ai.postData;
      this.populateContent(this.currentData);
    } else {
      // Default curated reference state matching the screenshot
      this.populateContent({
        photo_title: 'Prismatik',
        genre: { primary: 'Abstract Photography' },
        portfolio_potential: { rating: 'medium', reason: 'Striking abstract quality that broadens the portfolio\'s range beyond documentary work.' },
        mobile_photography_strength: { score: 8.2 },
        oppo_relevance: { rating: 'medium' },
        scores: { composition: 8.5, story: 7.8, visual_impact: 8.9, background: 8.2 },
        composition: {
          recommended_x: 0.50,
          recommended_y: 0.50,
          recommended_zoom: 1.02,
          confidence: 0.90,
          reason: 'Slight upward shift removes the distracting bottom edge text while preserving the diagonal light path.',
          strengths: ['Clean diagonal division', 'Balanced color weight'],
          weaknesses: ['Text element at the bottom edge creates minor distraction']
        },
        caption_options: [
          { style: 'minimal', text: 'Shifting spectra in the dark.' },
          { style: 'cinematic', text: 'Warmth spills across the frame, then fades into nothing.' },
          { style: 'documentary', text: 'Handheld, day eighteen of the series — light bending across a plain wall.' },
          { style: 'personal', text: 'Kept returning to this wall until the light finally did what I wanted.' },
          { style: 'photography', text: 'Diagonal gradient, warm-to-cool falloff, single light source, minimal post.' }
        ],
        hashtags: ['#ShotOnOPPO', '#MobilePhotography', '#AbstractPhoto', '#PrismaticGradient', '#Day18'],
        story_text: 'DAY 18/47 — Shot on OPPO Find X9',
        alt_text: 'An abstract close-up photograph featuring a diagonal gradient of warm orange, white, and deep blue light.'
      });

      // If an image is uploaded in the canvas, automatically run analysis in background
      if (state.image) {
        this.runAnalysis();
      }
    }
  }

  close() {
    this.cancel();
    if (this.modal) this.modal.classList.add('hidden');
  }

  cancel() {
    cancelActiveAiRequest();
    if (this.stateLoading) this.stateLoading.classList.add('hidden');
    if (this.stateContent) this.stateContent.classList.remove('hidden');
  }

  async runAnalysis() {
    const state = store.getState();
    if (!state.image) {
      return;
    }

    const day = parseInt(this.inputDayNumber?.value, 10) || 18;

    if (this.stateLoading) this.stateLoading.classList.remove('hidden');
    store.setAiState({ isAnalyzing: true, status: AI_STATUS.ANALYZING });

    const result = await requestCreatePost({
      imageState: state.image,
      dayNumber: day,
      campaign: state.ai?.campaign || '47 DAYS / 47 FRAMES',
      metadata: state.metadata
    });

    if (this.stateLoading) this.stateLoading.classList.add('hidden');

    if (result.cancelled) {
      return;
    }

    if (!result.success || !result.data) {
      this.showError(result.error?.message || 'Unable to complete analysis. Using offline studio fallback.');
      return;
    }

    this.currentData = result.data;
    store.setAiState({
      isAnalyzing: false,
      postData: result.data,
      status: result.isDemo ? AI_STATUS.DEMO_MODE : AI_STATUS.SUCCESS
    });

    this.populateContent(result.data, result.isDemo);
  }

  showError(message) {
    if (this.errorMessageText) this.errorMessageText.textContent = message;
    if (this.stateError) {
      this.stateError.classList.remove('hidden');
      setTimeout(() => {
        if (this.stateError) this.stateError.classList.add('hidden');
      }, 5000);
    }
  }

  populateContent(data, isDemo = false) {
    // Header Info
    const titleVal = data.photo_title || 'Prismatik';
    if (this.inputPostTitle) {
      if ('value' in this.inputPostTitle) this.inputPostTitle.value = titleVal;
      else this.inputPostTitle.textContent = titleVal;
    }

    // Genre Tabs
    if (this.genreTabsContainer) {
      const primary = (data.genre?.primary || 'Abstract Photography').toLowerCase();
      this.genreTabsContainer.querySelectorAll('.ai-tab').forEach(tab => {
        const isActive = tab.textContent.trim().toLowerCase().includes(primary) || primary.includes(tab.textContent.trim().toLowerCase());
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    // Portfolio Potential
    if (this.badgePortfolioRating) {
      const rating = (data.portfolio_potential?.rating || 'medium').toLowerCase();
      this.badgePortfolioRating.textContent = rating.charAt(0).toUpperCase() + rating.slice(1);
      this.badgePortfolioRating.className = `ai-status-item__value ${rating === 'high' ? 'ai-status-item__value--sage' : ''}`;
    }

    if (this.textPortfolioReason) {
      const reason = data.portfolio_potential?.reason || 'Striking abstract quality that broadens the portfolio\'s range beyond documentary work.';
      this.textPortfolioReason.textContent = `"${reason.replace(/^"|"$/g, '')}"`;
    }

    // Mobile Strength & OPPO Relevance
    if (this.badgeMobileStrength) {
      const score = data.mobile_photography_strength?.score || 8.2;
      this.badgeMobileStrength.innerHTML = `${score}<span class="ai-status-item__value-sub">/10</span>`;
    }

    if (this.badgeOppoRelevance) {
      const oppo = (data.oppo_relevance?.rating || 'medium').toLowerCase();
      this.badgeOppoRelevance.textContent = oppo.charAt(0).toUpperCase() + oppo.slice(1);
    }

    // Scores Breakdown
    if (this.scoreComposition) this.scoreComposition.textContent = (data.scores?.composition || 8.5).toFixed(1);
    if (this.scoreStory) this.scoreStory.textContent = (data.scores?.story || 7.8).toFixed(1);
    if (this.scoreVisualImpact) this.scoreVisualImpact.textContent = (data.scores?.visual_impact || 8.9).toFixed(1);
    if (this.scoreBackground) this.scoreBackground.textContent = (data.scores?.background || 8.2).toFixed(1);

    // Composition Card
    const x = Math.round((data.composition?.recommended_x ?? 0.5) * 100);
    const y = Math.round((data.composition?.recommended_y ?? 0.5) * 100);
    const zoom = (data.composition?.recommended_zoom ?? 1.02).toFixed(2);
    const conf = Math.round((data.composition?.confidence ?? 0.90) * 100);

    if (this.compCoordsReadout) this.compCoordsReadout.textContent = `Center ${x}, ${y}%`;
    if (this.compZoomReadout) this.compZoomReadout.textContent = `Zoom ${zoom}×`;
    if (this.compConfidenceReadout) this.compConfidenceReadout.textContent = `Confidence ${conf}%`;

    if (this.compReasonText) {
      this.compReasonText.textContent = data.composition?.reason || 'Slight upward shift removes the distracting bottom edge text while preserving the diagonal light path.';
    }

    if (this.compStrengthsList) {
      const list = data.composition?.strengths || ['Clean diagonal division', 'Balanced color weight'];
      this.compStrengthsList.innerHTML = list.map(s => `
        <li>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12.5 9.5 18 20 5"/></svg>
          <span>${s}</span>
        </li>
      `).join('');
    }

    if (this.compCritiqueText) {
      const weaknesses = data.composition?.weaknesses || [];
      this.compCritiqueText.textContent = weaknesses[0] || 'Text element at the bottom edge creates minor distraction';
    }

    // Captions
    this.renderCaptionTabs(data.caption_options || []);

    // Hashtags, Alt Text, Story Note
    const hashtagStr = Array.isArray(data.hashtags) ? data.hashtags.join(' ') : (data.hashtags || '#ShotOnOPPO #MobilePhotography #AbstractPhoto #PrismaticGradient #Day18');
    if (this.inputHashtags) {
      if ('value' in this.inputHashtags) this.inputHashtags.value = hashtagStr;
      else this.inputHashtags.textContent = hashtagStr;
    }

    const storyStr = data.story_text || `DAY ${store.getState().ai?.dayNumber || 18}/47 — Shot on OPPO Find X9`;
    if (this.inputStoryText) {
      if ('value' in this.inputStoryText) this.inputStoryText.value = storyStr;
      else this.inputStoryText.textContent = storyStr;
    }

    const altStr = data.alt_text || 'An abstract close-up photograph featuring a diagonal gradient of warm orange, white, and deep blue light.';
    if (this.inputAltText) {
      if ('value' in this.inputAltText) this.inputAltText.value = altStr;
      else this.inputAltText.textContent = altStr;
    }
  }

  renderCaptionTabs(options) {
    if (!this.captionTabsContainer) return;

    const defaultCaptions = {
      minimal: 'Shifting spectra in the dark.',
      cinematic: 'Warmth spills across the frame, then fades into nothing.',
      documentary: 'Handheld, day eighteen of the series — light bending across a plain wall.',
      personal: 'Kept returning to this wall until the light finally did what I wanted.',
      photography: 'Diagonal gradient, warm-to-cool falloff, single light source, minimal post.'
    };

    let opts = options && options.length > 0 ? options : [
      { style: 'minimal', text: defaultCaptions.minimal },
      { style: 'cinematic', text: defaultCaptions.cinematic },
      { style: 'documentary', text: defaultCaptions.documentary },
      { style: 'personal', text: defaultCaptions.personal },
      { style: 'photography', text: defaultCaptions.photography }
    ];

    this.captionTabsContainer.innerHTML = '';
    const activeOption = opts.find(o => o.style === this.selectedStyle) || opts[0];

    opts.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ai-tab ${opt.style === activeOption?.style ? 'is-active' : ''}`;
      
      const styleMeta = CAPTION_STYLES.find(s => s.id === opt.style);
      btn.textContent = styleMeta?.label || (opt.style.charAt(0).toUpperCase() + opt.style.slice(1));
      btn.title = styleMeta?.hint || '';

      btn.addEventListener('click', () => {
        this.selectedStyle = opt.style;
        this.captionTabsContainer.querySelectorAll('.ai-tab').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        if (this.textareaActiveCaption) {
          if ('value' in this.textareaActiveCaption) this.textareaActiveCaption.value = opt.text;
          else this.textareaActiveCaption.textContent = opt.text;
        }
      });

      this.captionTabsContainer.appendChild(btn);
    });

    if (this.textareaActiveCaption && activeOption) {
      if ('value' in this.textareaActiveCaption) this.textareaActiveCaption.value = activeOption.text;
      else this.textareaActiveCaption.textContent = activeOption.text;
    }
  }

  setupCopyButton(btn, getTextFn) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const text = getTextFn();
      if (!text) return;
      navigator.clipboard.writeText(text);
      this.flashCopySuccess(btn, '✓ Copied');
    });
  }

  flashCopySuccess(btn, label) {
    const original = btn.innerHTML;
    btn.textContent = label;
    btn.classList.add('is-copied');
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove('is-copied');
    }, 1800);
  }
}

