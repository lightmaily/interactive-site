const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

window.app = {
  state: {
    username: '',
    quizzes: [],
    leaderboards: {},
    activeQuiz: null,
    initialRouteQuizId: null,
    pendingQuizIdAfterName: null,
    startQuizAfterNameSubmit: false,
    currentQuestionIndex: 0,
    currentScore: 0,
    routeHistory: [],
    playMode: 'relaxed',
    quizStartTimeMs: null,
    quizElapsedSec: 0,
    timerIntervalId: null,
    homeSearch: '',
    homeTagFilter: 'ALL',
    ownerSession: null,
    editingQuizId: null,
    isAdminUnlocked: false,
    adminPasscode: '',
    secretTapCount: 0,
    secretTapTimer: null
  },

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  isViewVisible(viewId) {
    const el = document.getElementById(viewId);
    return Boolean(el && !el.classList.contains('hidden'));
  },

  handleLogoSecretTap() {
    this.state.secretTapCount++;
    clearTimeout(this.state.secretTapTimer);
    if (this.state.secretTapCount >= 5) {
      this.state.secretTapCount = 0;
      window.location.href = '/admin.html';
      return;
    }
    this.state.secretTapTimer = setTimeout(() => {
      this.state.secretTapCount = 0;
    }, 1500);
  },

  toggleAdminModal() {
    window.location.href = '/admin.html';
  },

  getQuizIdFromUrl() {
    try {
      const pathMatch = window.location.pathname.match(/^\/quiz\/([^/]+)\/?$/);
      if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
      const queryId = new URLSearchParams(window.location.search).get('quiz');
      return queryId ? queryId.trim() : null;
    } catch {
      return null;
    }
  },

  getQuizUrl(quizId) {
    return `${window.location.origin}/quiz/${encodeURIComponent(quizId)}`;
  },

  syncUrlForHome(replace = false) {
    if (window.location.pathname !== '/' || window.location.search) {
      history[replace ? 'replaceState' : 'pushState']({ view: 'home' }, '', '/');
    }
    document.title = 'Уютные интерактивы';
  },

  syncUrlForQuiz(quizId, replace = false) {
    const targetPath = `/quiz/${encodeURIComponent(quizId)}`;
    if (window.location.pathname !== targetPath || window.location.search) {
      history[replace ? 'replaceState' : 'pushState']({ view: 'quiz-page', quizId }, '', targetPath);
    }
  },

  async copyQuizLink(quizId = null) {
    const id = quizId || this.state.activeQuiz?.id;
    if (!id) return;
    const url = this.getQuizUrl(id);
    try {
      await navigator.clipboard.writeText(url);
      this.showToast('Ссылка на страницу интерактива скопирована!', '🔗');
    } catch {
      window.prompt('Скопируйте ссылку на интерактив:', url);
    }
  },

  shareQuizTelegram(quizId = null) {
    const targetId = quizId || this.state.activeQuiz?.id;
    const quiz = (targetId && this.state.quizzes.find(q => q.id === targetId)) || this.state.activeQuiz || null;
    const url = quiz ? this.getQuizUrl(quiz.id) : window.location.href;
    const title = quiz?.title || document.title || 'Уютные интерактивы';
    const text = `🍂 Пройди интерактив «${title}» и построй свой маршрут!`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

    const opened = window.open(shareUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = shareUrl;
    }
    this.showToast('Открываем Telegram для отправки ссылки...', '✈️');
  },

  updateUserDisplay() {
    const el = document.getElementById('current-user-display');
    if (el) el.textContent = this.state.username || 'Гость';
  },

  createParticles() {
    const container = document.getElementById('particles-container');
    if (!container) return;
    const symbols = ['🍂', '🍁', '❄️', '✨', '🍃'];
    const count = window.innerWidth < 640 ? 14 : 24;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'particle';
      el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      el.style.left = `${Math.random() * 100}vw`;
      el.style.fontSize = `${Math.random() * 12 + 12}px`;
      el.style.animationDuration = `${Math.random() * 10 + 10}s`;
      el.style.animationDelay = `${Math.random() * 10}s`;
      container.appendChild(el);
    }
  },

  loadData() {
    try {
      this.state.quizzes = JSON.parse(localStorage.getItem('cozy_quizzes') || '[]');
      this.state.leaderboards = JSON.parse(localStorage.getItem('cozy_leaderboards') || '{}');
    } catch {
      this.state.quizzes = [];
      this.state.leaderboards = {};
    }
  },

  saveLeaderboards() {
    localStorage.setItem('cozy_leaderboards', JSON.stringify(this.state.leaderboards));
  },

  saveQuizzes() {
    localStorage.setItem('cozy_quizzes', JSON.stringify(this.state.quizzes));
  },

  openNameModal(options = {}) {
    const modal = document.getElementById('name-modal');
    const input = document.getElementById('username-input');
    this.state.pendingQuizIdAfterName = options.quizId || null;
    this.state.startQuizAfterNameSubmit = Boolean(options.startQuiz);
    input.value = this.state.username;
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 100);
  },

  showToast(message, icon = '✨') {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = message;
    document.getElementById('toast-icon').textContent = icon;
    toast.classList.remove('translate-x-full', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-x-full', 'opacity-0'), 3500);
  },

  switchView(viewId) {
    ['view-home', 'view-lobby', 'view-quiz', 'view-results'].forEach(id => {
      document.getElementById(id).classList.toggle('hidden', id !== viewId);
    });
    const wrapper = document.getElementById('main-wrapper');
    wrapper.classList.toggle('max-w-7xl', viewId === 'view-quiz');
    wrapper.classList.toggle('max-w-4xl', viewId !== 'view-quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async fetchGlobalQuizzes() {
    try {
      const res = await fetch('/api/quizzes', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data.quizzes)) return;

      this.state.quizzes = data.quizzes;
      this.saveQuizzes();

      if (this.state.ownerSession?.ownedQuizId) {
        const stillExists = this.state.quizzes.some(q => q.id === this.state.ownerSession.ownedQuizId);
        if (!stillExists) {
          this.saveOwnerSession({
            ...this.state.ownerSession,
            ownedQuizId: null
          });
        }
      }

      if (this.state.initialRouteQuizId) {
        const targetId = this.state.initialRouteQuizId;
        this.state.initialRouteQuizId = null;
        const found = this.state.quizzes.find(q => q.id === targetId);
        if (found) {
          this.openLobby(found.id, { replaceHistory: true });
          return;
        }
        this.showToast('Интерактив по этой ссылке не найден', '🕯️');
        this.syncUrlForHome(true);
      }

      if (this.isViewVisible('view-home')) this.renderHome();
      if (this.state.activeQuiz) {
        const refreshed = this.state.quizzes.find(q => q.id === this.state.activeQuiz.id);
        if (refreshed) {
          this.state.activeQuiz = refreshed;
          if (this.isViewVisible('view-lobby')) this.openLobby(refreshed.id, { replaceHistory: true });
        }
      }
    } catch {}
  },

  async fetchGlobalLeaderboards(targetQuizId = null) {
    try {
      const query = targetQuizId ? `?quizId=${encodeURIComponent(targetQuizId)}` : '';
      const res = await fetch(`/api/leaderboard${query}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();

      if (targetQuizId && Array.isArray(data.leaderboard)) {
        this.state.leaderboards[targetQuizId] = data.leaderboard;
        this.saveLeaderboards();
        this.refreshActiveLeaderboardViews(targetQuizId);
        return;
      }

      if (data.leaderboards && typeof data.leaderboards === 'object') {
        this.state.leaderboards = { ...this.state.leaderboards, ...data.leaderboards };
        this.saveLeaderboards();
        if (this.isViewVisible('view-home')) this.renderHome();
        if (this.state.activeQuiz && this.isViewVisible('view-quiz')) {
          this.renderLeaderboard(this.state.activeQuiz.id, 'quiz-live-leaderboard');
        }
      }
    } catch {}
  },

  async submitScoreToGlobal(quizId, name, score, total, date, mode = 'relaxed', durationSec = null) {
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId, name, score, total, date, mode, durationSec })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.leaderboard)) return;

      this.state.leaderboards[quizId] = data.leaderboard;
      this.saveLeaderboards();
      this.renderLeaderboard(quizId, 'results-leaderboard');
      this.renderHome();
    } catch {}
  },

  bindEvents() {
    document.getElementById('name-form').addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('username-input').value.trim().slice(0, 24);
      if (!name) return;

      const hadNameBefore = Boolean(this.state.username);
      this.state.username = name;
      localStorage.setItem('cozy_username', name);
      this.updateUserDisplay();
      document.getElementById('name-modal').classList.add('hidden');
      this.showToast(hadNameBefore ? `Приятно снова видеть, ${name}!` : `Добро пожаловать, ${name}!`, hadNameBefore ? '🧣' : '✨');

      const pendingQuizId = this.state.pendingQuizIdAfterName;
      const shouldStart = this.state.startQuizAfterNameSubmit;
      this.state.pendingQuizIdAfterName = null;
      this.state.startQuizAfterNameSubmit = false;

      if (pendingQuizId) {
        const quiz = this.state.quizzes.find(q => q.id === pendingQuizId);
        if (quiz) this.state.activeQuiz = quiz;
      }
      if (shouldStart && this.state.activeQuiz) this.startQuiz();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.verifyOwnerSession();
      }
    });

    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#admin') this.toggleAdminModal();
    });

    window.addEventListener('popstate', () => {
      const routeQuizId = this.getQuizIdFromUrl();
      const quiz = routeQuizId ? this.state.quizzes.find(q => q.id === routeQuizId) : null;
      if (quiz) this.openLobby(quiz.id, { skipHistory: true });
      else this.showHome({ skipHistory: true });
    });

    document.getElementById('admin-pass-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.unlockAdmin();
      }
    });

    document.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rating-btn').forEach(b => {
          b.className = 'rating-btn py-2 rounded-xl bg-stone-800 border border-amber-500/20 hover:border-amber-400 text-sm sm:text-lg transition cursor-pointer';
        });
        btn.className = 'rating-btn py-2 rounded-xl bg-amber-500/30 border-2 border-amber-400 text-sm sm:text-lg font-bold transition cursor-pointer';
        document.getElementById('selected-rating').value = btn.dataset.rating;
      });
    });

    document.querySelectorAll('.gift-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.gift-choice-btn').forEach(b => {
          b.className = 'gift-choice-btn p-2.5 rounded-xl bg-stone-800 border border-amber-500/20 text-xs text-center transition cursor-pointer';
        });
        btn.className = 'gift-choice-btn p-2.5 rounded-xl bg-amber-500/25 border-2 border-amber-400 text-xs text-center transition cursor-pointer';
        document.getElementById('selected-gift').value = btn.dataset.gift;
      });
    });

    document.getElementById('gift-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      await this.sendGiftViaResend();
    });

    document.getElementById('invite-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      await this.redeemInviteCode(document.getElementById('invite-code-input')?.value || '');
    });

    document.getElementById('owner-quiz-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      await this.handleSaveOwnedQuiz();
    });

    window.addEventListener('resize', () => {
      if (this.isViewVisible('view-quiz')) this.renderJourneyMap();
      if (this.isViewVisible('view-results')) {
        this.renderJourneyMap();
        this.renderFinalMapPreview();
      }
    });
  },

  init() {
    this.state.username = (localStorage.getItem('cozy_username') || '').trim().slice(0, 24);
    this.updateUserDisplay();
    this.createParticles();
    this.loadData();
    this.loadOwnerSession();
    this.bindEvents();

    if (window.location.hash === '#admin') {
      this.toggleAdminModal();
      return;
    }

    const routeQuizId = this.getQuizIdFromUrl();
    this.state.initialRouteQuizId = routeQuizId;
    this.renderHome();

    if (routeQuizId) {
      const localQuiz = this.state.quizzes.find(q => q.id === routeQuizId);
      if (localQuiz) this.openLobby(localQuiz.id, { replaceHistory: true });
    }

    this.verifyOwnerSession();
    this.fetchGlobalQuizzes();
    this.fetchGlobalLeaderboards();
    this.openNameModal();
  }
};

window.addEventListener('DOMContentLoaded', () => app.init());