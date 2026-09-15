/**
 * Pocket Frames - AI Photography Director & Post Studio Modal
 * Full interactive liquid glass studio for 47 DAYS / 47 FRAMES campaign.
 */

import { store } from '../state.js';
import { fetchAiStatus, requestCreatePost, cancelActiveAiRequest } from './geminiClient.js';
import { applyAiComposition } from './compositionApplier.js';
import { CAPTION_STYLES, AI_STATUS } from './aiTypes.js';

export class AiStudioModal {
  constructor() {
    this.modal = document.getElementById('aiStudioModal');
    this.serverStatus = { configured: false, status: 'unknown', model: 'gemini-1.5-flash' };
    this.currentData = null;
    this.selectedStyle = 'minimal';
    this.isApplying = false;

    this.initElements();
    this.bindEvents();
    this.checkStatus();
  }

  initElements() {
    // Buttons & Steppers
    this.btnClose = document.getElementById('btnCloseAiStudio');
    this.btnRunCreatePost = document.getElementById('btnRunCreatePost');
    this.btnCancelAi = document.getElementById('btnCancelAi');
    this.btnDayPrev = document.getElementById('btnDayPrev');
    this.btnDayNext = document.getElementById('btnDayNext');
    this.inputDayNumber = document.getElementById('inputDayNumber');
    this.aiStatusBadge = document.getElementById('aiStatusBadge');

    // Sections & States
    this.stateIdle = document.getElementById('aiStateIdle');
    this.stateLoading = document.getElementById('aiStateLoading');
    this.stateError = document.getElementById('aiStateError');
    this.stateContent = document.getElementById('aiStateContent');
    this.errorMessageText = document.getElementById('aiErrorMessageText');
    this.btnRetryAi = document.getElementById('btnRetryAi');

    // Content Display Elements
    this.inputPostTitle = document.getElementById('inputPostTitle');
    this.genreBadgePrimary = document.getElementById('genreBadgePrimary');
    this.genreSecondaryTags = document.getElementById('genreSecondaryTags');

    // Scores & Portfolio
    this.badgePortfolioRating = document.getElementById('badgePortfolioRating');
    this.textPortfolioReason = document.getElementById('textPortfolioReason');
    this.badgeMobileStrength = document.getElementById('badgeMobileStrength');
    this.badgeOppoRelevance = document.getElementById('badgeOppoRelevance');
    this.scoreComposition = document.getElementById('scoreComposition');
    this.scoreStory = document.getElementById('scoreStory');
    this.scoreVisualImpact = document.getElementById('scoreVisualImpact');
    this.scoreBackground = document.getElementById('scoreBackground');

    // Composition Card
    this.compStrengthsList = document.getElementById('compStrengthsList');
    this.compWeaknessesList = document.getElementById('compWeaknessesList');
    this.compReasonText = document.getElementById('compReasonText');
    this.compCoordsReadout = document.getElementById('compCoordsReadout');
    this.btnApplyComposition = document.getElementById('btnApplyComposition');
    this.btnIgnoreComposition = document.getElementById('btnIgnoreComposition');

    // Captions
    this.captionTabsContainer = document.getElementById('captionTabsContainer');
    this.textareaActiveCaption = document.getElementById('textareaActiveCaption');
    this.btnCopyCaption = document.getElementById('btnCopyCaption');

    // Hashtags & Alt Text
    this.inputHashtags = document.getElementById('inputHashtags');
    this.btnCopyHashtags = document.getElementById('btnCopyHashtags');
    this.inputAltText = document.getElementById('inputAltText');
    this.btnCopyAltText = document.getElementById('btnCopyAltText');
    this.inputStoryText = document.getElementById('inputStoryText');
    this.btnCopyStoryText = document.getElementById('btnCopyStoryText');

    // Master Copy Action
    this.btnCopyCompletePackage = document.getElementById('btnCopyCompletePackage');
  }

  bindEvents() {
    // Open/Close
    const btnOpen = document.getElementById('btnOpenAiStudio');
    if (btnOpen) btnOpen.addEventListener('click', () => this.open());

    if (this.btnClose) this.btnClose.addEventListener('click', () => this.close());
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    // Stepper
    if (this.btnDayPrev) {
      this.btnDayPrev.addEventListener('click', () => {
        const current = parseInt(this.inputDayNumber.value, 10) || 1;
        this.setDay(Math.max(1, current - 1));
      });
    }

    if (this.btnDayNext) {
      this.btnDayNext.addEventListener('click', () => {
        const current = parseInt(this.inputDayNumber.value, 10) || 1;
        this.setDay(Math.min(47, current + 1));
      });
    }

    if (this.inputDayNumber) {
      this.inputDayNumber.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) this.setDay(Math.max(1, Math.min(47, val)));
      });
    }

    // Actions
    if (this.btnRunCreatePost) this.btnRunCreatePost.addEventListener('click', () => this.runAnalysis());
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
      });
    }

    // Clipboard Copy Handlers
    this.setupCopyButton(this.btnCopyCaption, () => this.textareaActiveCaption?.value);
    this.setupCopyButton(this.btnCopyHashtags, () => this.inputHashtags?.value);
    this.setupCopyButton(this.btnCopyAltText, () => this.inputAltText?.value);
    this.setupCopyButton(this.btnCopyStoryText, () => this.inputStoryText?.value);

    // Master Post Package Copy
    if (this.btnCopyCompletePackage) {
      this.btnCopyCompletePackage.addEventListener('click', () => {
        const title = this.inputPostTitle?.value || '';
        const caption = this.textareaActiveCaption?.value || '';
        const hashtags = this.inputHashtags?.value || '';
        const story = this.inputStoryText?.value || '';

        const fullPost = [
          title ? `"${title}"` : null,
          caption,
          story ? `—\n${story}` : null,
          `.\n.\n.\n${hashtags}`
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
    if (!this.aiStatusBadge) return;

    if (this.serverStatus.configured) {
      this.aiStatusBadge.className = 'ai-status-badge connected';
      this.aiStatusBadge.innerHTML = `<span class="status-dot"></span> Gemini API — Connected (${this.serverStatus.model || '1.5-flash'})`;
    } else {
      this.aiStatusBadge.className = 'ai-status-badge demo';
      this.aiStatusBadge.innerHTML = `<span class="status-dot"></span> DEMO MODE — Gemini API not configured on server`;
    }
  }

  setDay(day) {
    if (this.inputDayNumber) this.inputDayNumber.value = day;
    store.setAiState({ dayNumber: day });
  }

  open() {
    if (!this.modal) return;
    this.modal.classList.remove('hidden');
    this.checkStatus();

    const state = store.getState();
    const day = state.ai?.dayNumber || 18;
    if (this.inputDayNumber) this.inputDayNumber.value = day;

    // If state already has postData, render it immediately
    if (state.ai?.postData) {
      this.currentData = state.ai.postData;
      this.showView('CONTENT');
      this.populateContent(this.currentData);
    } else {
      this.showView('IDLE');
    }
  }

  close() {
    this.cancel();
    if (this.modal) this.modal.classList.add('hidden');
  }

  cancel() {
    cancelActiveAiRequest();
    this.showView(this.currentData ? 'CONTENT' : 'IDLE');
  }

  showView(viewName) {
    if (this.stateIdle) this.stateIdle.classList.toggle('hidden', viewName !== 'IDLE');
    if (this.stateLoading) this.stateLoading.classList.toggle('hidden', viewName !== 'LOADING');
    if (this.stateError) this.stateError.classList.toggle('hidden', viewName !== 'ERROR');
    if (this.stateContent) this.stateContent.classList.toggle('hidden', viewName !== 'CONTENT');
  }

  async runAnalysis() {
    const state = store.getState();

    if (!state.image) {
      this.showError('Please upload a photograph first before running AI Director.');
      return;
    }

    const day = parseInt(this.inputDayNumber?.value, 10) || 18;

    this.showView('LOADING');
    store.setAiState({ isAnalyzing: true, status: AI_STATUS.ANALYZING });

    const result = await requestCreatePost({
      imageState: state.image,
      dayNumber: day,
      campaign: state.ai?.campaign || '47 DAYS / 47 FRAMES',
      metadata: state.metadata
    });

    if (result.cancelled) {
      return;
    }

    if (!result.success || !result.data) {
      this.showError(result.error?.message || 'Failed to process AI analysis. Please check connection and try again.');
      return;
    }

    this.currentData = result.data;
    store.setAiState({
      isAnalyzing: false,
      postData: result.data,
      status: result.isDemo ? AI_STATUS.DEMO_MODE : AI_STATUS.SUCCESS
    });

    this.populateContent(result.data, result.isDemo);
    this.showView('CONTENT');
  }

  showError(message) {
    if (this.errorMessageText) this.errorMessageText.textContent = message;
    this.showView('ERROR');
    store.setAiState({ isAnalyzing: false, error: message, status: AI_STATUS.INVALID_RESPONSE });
  }

  populateContent(data, isDemo = false) {
    // Header Info
    if (this.inputPostTitle) this.inputPostTitle.value = data.photo_title || '';
    if (this.genreBadgePrimary) this.genreBadgePrimary.textContent = data.genre?.primary || 'Street Photography';

    if (this.genreSecondaryTags) {
      const tags = data.genre?.secondary || [];
      this.genreSecondaryTags.innerHTML = tags.map(t => `<span class="genre-tag">${t}</span>`).join('');
    }

    // Portfolio Potential
    if (this.badgePortfolioRating) {
      const rating = (data.portfolio_potential?.rating || 'medium').toUpperCase();
      this.badgePortfolioRating.textContent = `Portfolio Candidate: ${rating}`;
      this.badgePortfolioRating.className = `portfolio-badge rating-${rating.toLowerCase()}`;
    }

    if (this.textPortfolioReason) {
      this.textPortfolioReason.textContent = data.portfolio_potential?.reason || '';
    }

    // Mobile Strength & OPPO Relevance
    if (this.badgeMobileStrength) {
      const score = data.mobile_photography_strength?.score || 8.5;
      this.badgeMobileStrength.textContent = `Mobile Camera Strength: ${score}/10`;
    }

    if (this.badgeOppoRelevance) {
      const oppo = (data.oppo_relevance?.rating || 'high').toUpperCase();
      this.badgeOppoRelevance.textContent = `OPPO Relevance: ${oppo}`;
      this.badgeOppoRelevance.className = `oppo-relevance-badge rating-${oppo.toLowerCase()}`;
    }

    // Scores Breakdown
    if (this.scoreComposition) this.scoreComposition.textContent = (data.scores?.composition || 8.4).toFixed(1);
    if (this.scoreStory) this.scoreStory.textContent = (data.scores?.story || 8.8).toFixed(1);
    if (this.scoreVisualImpact) this.scoreVisualImpact.textContent = (data.scores?.visual_impact || 8.1).toFixed(1);
    if (this.scoreBackground) this.scoreBackground.textContent = (data.scores?.background || 7.5).toFixed(1);

    // Composition Card
    if (this.compStrengthsList) {
      const list = data.composition?.strengths || [];
      this.compStrengthsList.innerHTML = list.map(s => `<li>✓ ${s}</li>`).join('');
    }

    if (this.compWeaknessesList) {
      const list = data.composition?.weaknesses || [];
      this.compWeaknessesList.innerHTML = list.map(w => `<li>⚠ ${w}</li>`).join('');
    }

    if (this.compReasonText) {
      this.compReasonText.textContent = data.composition?.reason || '';
    }

    if (this.compCoordsReadout) {
      const x = Math.round((data.composition?.recommended_x ?? 0.5) * 100);
      const y = Math.round((data.composition?.recommended_y ?? 0.5) * 100);
      const zoom = (data.composition?.recommended_zoom ?? 1.0).toFixed(2);
      const conf = Math.round((data.composition?.confidence ?? 0.85) * 100);
      this.compCoordsReadout.textContent = `Target Subject Center: (${x}%, ${y}%) · Zoom: ${zoom}× · Confidence: ${conf}%`;
    }

    // Render Captions Tabs
    this.renderCaptionTabs(data.caption_options || []);

    // Hashtags & Alt Text
    if (this.inputHashtags) {
      this.inputHashtags.value = (data.hashtags || []).join(' ');
    }

    if (this.inputAltText) {
      this.inputAltText.value = data.alt_text || '';
    }

    if (this.inputStoryText) {
      this.inputStoryText.value = data.story_text || '';
    }
  }

  renderCaptionTabs(options) {
    if (!this.captionTabsContainer) return;

    this.captionTabsContainer.innerHTML = '';
    const activeOption = options.find(o => o.style === this.selectedStyle) || options[0];

    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `caption-tab-btn ${opt.style === activeOption?.style ? 'active' : ''}`;
      
      const styleMeta = CAPTION_STYLES.find(s => s.id === opt.style);
      btn.textContent = styleMeta?.label || opt.style;
      btn.title = styleMeta?.hint || '';

      btn.addEventListener('click', () => {
        this.selectedStyle = opt.style;
        this.captionTabsContainer.querySelectorAll('.caption-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.textareaActiveCaption) this.textareaActiveCaption.value = opt.text;
      });

      this.captionTabsContainer.appendChild(btn);
    });

    if (this.textareaActiveCaption && activeOption) {
      this.textareaActiveCaption.value = activeOption.text;
    }
  }

  setupCopyButton(btn, getTextFn) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const text = getTextFn();
      if (!text) return;
      navigator.clipboard.writeText(text);
      this.flashCopySuccess(btn, '✓ Copied!');
    });
  }

  flashCopySuccess(btn, label) {
    const original = btn.textContent;
    btn.textContent = label;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 2000);
  }
}
