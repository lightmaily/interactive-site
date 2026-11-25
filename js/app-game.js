Object.assign(window.app, {
  setHomeSearch(val) {
    this.state.homeSearch = String(val || '');
    this.renderHome();
  },

  setHomeTagFilter(tag) {
    this.state.homeTagFilter = tag || 'ALL';
    this.renderHome();
  },

  resetHomeFilters() {
    this.state.homeSearch = '';
    this.state.homeTagFilter = 'ALL';
    const input = document.getElementById('home-search-input');
    if (input) input.value = '';
    this.renderHome();
  },

  setPlayMode(mode) {
    this.state.playMode = mode === 'speed' ? 'speed' : 'relaxed';
    const relaxedBtn = document.getElementById('mode-btn-relaxed');
    const speedBtn = document.getElementById('mode-btn-speed');
    if (!relaxedBtn || !speedBtn) return;

    const active = 'p-3 rounded-2xl bg-amber-500/25 border-2 border-amber-400 text-left transition cursor-pointer';
    const activeSpeed = 'p-3 rounded-2xl bg-sky-500/20 border-2 border-sky-400 text-left transition cursor-pointer';
    const idle = 'p-3 rounded-2xl bg-stone-900/80 border border-amber-500/20 hover:border-amber-400/50 text-left transition cursor-pointer';

    relaxedBtn.className = this.state.playMode === 'relaxed' ? active : idle;
    speedBtn.className = this.state.playMode === 'speed' ? activeSpeed : idle;
  },

  startQuizTimer() {
    this.stopQuizTimer();
    const timerEl = document.getElementById('quiz-timer-live');
    if (this.state.playMode !== 'speed') {
      timerEl?.classList.add('hidden');
      this.state.quizElapsedSec = 0;
      return;
    }

    this.state.quizStartTimeMs = performance.now();
    this.state.quizElapsedSec = 0;
    let lastRendered = '0.0';
    if (timerEl) {
      timerEl.textContent = '⏱️ 0.0с';
      timerEl.classList.remove('hidden');
    }

    this.state.timerIntervalId = setInterval(() => {
      const elapsed = Math.round(((performance.now() - this.state.quizStartTimeMs) / 1000) * 10) / 10;
      this.state.quizElapsedSec = elapsed;
      const formatted = elapsed.toFixed(1);
      if (timerEl && formatted !== lastRendered) {
        lastRendered = formatted;
        timerEl.textContent = `⏱️ ${formatted}с`;
      }
    }, 150);
  },

  stopQuizTimer() {
    if (this.state.timerIntervalId) {
      clearInterval(this.state.timerIntervalId);
      this.state.timerIntervalId = null;
    }
    if (this.state.playMode === 'speed' && this.state.quizStartTimeMs) {
      this.state.quizElapsedSec = Math.round(((performance.now() - this.state.quizStartTimeMs) / 1000) * 10) / 10;
    }
  },

  showHome(options = {}) {
    this.stopQuizTimer();
    if (!options.skipHistory) this.syncUrlForHome(Boolean(options.replaceHistory));
    else document.title = 'Уютные интерактивы';

    this.renderHome();
    this.fetchGlobalQuizzes();
    this.fetchGlobalLeaderboards();
    this.switchView('view-home');
  },

  goToQuizzes() {
    this.showHome();
    document.getElementById('quizzes-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.showToast('Список интерактивов открыт', '🍂');
  },

  refreshActiveLeaderboardViews(quizId) {
    if (this.isViewVisible('view-lobby')) this.renderLeaderboard(quizId, 'lobby-leaderboard');
    if (this.isViewVisible('view-quiz')) this.renderLeaderboard(quizId, 'quiz-live-leaderboard');
    if (this.isViewVisible('view-results')) this.renderLeaderboard(quizId, 'results-leaderboard');
  },

  compareLeaderboardEntries(a, b) {
    const scoreDiff = (Number(b?.score) || 0) - (Number(a?.score) || 0);
    if (scoreDiff !== 0) return scoreDiff;

    const aHasTime = typeof a?.durationSec === 'number' && Number.isFinite(a.durationSec) && a.durationSec >= 0;
    const bHasTime = typeof b?.durationSec === 'number' && Number.isFinite(b.durationSec) && b.durationSec >= 0;

    if (aHasTime && bHasTime) return a.durationSec - b.durationSec;
    if (aHasTime) return -1;
    if (bHasTime) return 1;
    return 0;
  },

  getRankedLeaderboard(quizId) {
    const rawList = [...(this.state.leaderboards[quizId] || [])];
    if (this.state.activeQuiz?.id === quizId && this.state.username && this.isViewVisible('view-quiz')) {
      const playerName = String(this.state.username);
      const liveScore = Number(this.state.currentScore) || 0;
      const liveTotal = this.state.activeQuiz.questions.length;
      const idx = rawList.findIndex(item => String(item?.name || '').toLowerCase() === playerName.toLowerCase());
      const nowStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      const liveDuration = this.state.playMode === 'speed' ? this.state.quizElapsedSec : null;

      if (idx !== -1) {
        const prev = rawList[idx];
        const prevScore = Number(prev.score) || 0;
        const keepPrev = prevScore > liveScore;
        rawList[idx] = {
          ...prev,
          name: playerName,
          score: Math.max(prevScore, liveScore),
          total: liveTotal,
          durationSec: keepPrev ? prev.durationSec : liveDuration
        };
      } else {
        rawList.push({
          name: playerName,
          score: liveScore,
          total: liveTotal,
          date: nowStr,
          mode: this.state.playMode,
          durationSec: liveDuration
        });
      }
    }

    rawList.sort((a, b) => this.compareLeaderboardEntries(a, b));

    let pos = 0;
    let prevScore = null;
    return rawList.map(entry => {
      const scoreNum = Number(entry?.score) || 0;
      if (prevScore === null || scoreNum < prevScore) {
        pos += 1;
        prevScore = scoreNum;
      }
      const durationSec = typeof entry?.durationSec === 'number' && Number.isFinite(entry.durationSec) && entry.durationSec >= 0
        ? entry.durationSec
        : null;
      return {
        ...entry,
        name: String(entry?.name || 'Игрок'),
        score: scoreNum,
        durationSec,
        position: pos
      };
    });
  },

  getPositionBadge(position) {
    return position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`;
  },

  getQuizMeta(quiz) {
    const author = String(quiz?.author || quiz?.createdBy || 'Iakov').trim() || 'Iakov';
    let createdAtText = '';

    if (quiz?.createdAt) {
      const parsed = new Date(quiz.createdAt);
      createdAtText = !Number.isNaN(parsed.getTime())
        ? parsed.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
        : String(quiz.createdAt);
    } else if (typeof quiz?.id === 'string' && quiz.id.startsWith('quiz-')) {
      const ts = Number(quiz.id.replace('quiz-', ''));
      if (!Number.isNaN(ts) && ts > 1600000000000) {
        createdAtText = new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }

    return { author, createdAtText: createdAtText || 'осенью 2026' };
  },

  renderHome() {
    const grid = document.getElementById('quizzes-grid');
    const tagsContainer = document.getElementById('home-tag-filters');
    if (!grid) return;
    grid.innerHTML = '';

    if (tagsContainer) {
      const chips = ['ALL', ...new Set(this.state.quizzes.map(q => q.badge).filter(Boolean))];
      tagsContainer.innerHTML = chips.map(tag => {
        const active = this.state.homeTagFilter === tag;
        const label = tag === 'ALL' ? '✨ Все темы' : this.escapeHtml(tag);
        return `<button type="button" onclick="app.setHomeTagFilter('${this.escapeHtml(tag)}')" class="px-3 py-1 rounded-full text-xs transition cursor-pointer ${active ? 'bg-amber-400 text-stone-950 font-bold' : 'bg-stone-900/80 hover:bg-stone-800 border border-amber-500/20 text-amber-200/80'}">${label}</button>`;
      }).join('');
    }

    const q = this.state.homeSearch.trim().toLowerCase();
    const visible = this.state.quizzes.filter(quiz => {
      if (this.state.homeTagFilter !== 'ALL' && quiz.badge !== this.state.homeTagFilter) return false;
      if (!q) return true;
      const meta = this.getQuizMeta(quiz);
      return `${quiz.title} ${quiz.description} ${quiz.badge} ${meta.author}`.toLowerCase().includes(q);
    });

    if (visible.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full cozy-card rounded-3xl p-8 text-center">
          <div class="text-4xl mb-3">🕯️</div>
          <h3 class="font-serif text-2xl font-bold text-amber-200 mb-2">${this.state.quizzes.length === 0 ? 'Интерактивы скоро появятся' : 'Ничего не найдено'}</h3>
          <p class="text-amber-200/70 text-sm max-w-md mx-auto">${this.state.quizzes.length === 0 ? 'Автор ещё готовит вопросы для этого вечера. Загляни чуть позже!' : 'Попробуйте изменить поисковый запрос или сбросить фильтр по тегам.'}</p>
        </div>
      `;
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    visible.forEach(quiz => {
      const ranked = this.getRankedLeaderboard(quiz.id);
      const podiumParts = [1, 2, 3].map(pos => {
        const item = ranked.find(r => r.position === pos);
        if (!item) return '';
        const timeTag = typeof item.durationSec === 'number' ? ` ⚡${item.durationSec.toFixed(1)}с` : '';
        return `${medals[pos - 1]} <strong class="text-amber-300">${this.escapeHtml(item.name)}</strong> (${item.score}/${item.total}${timeTag})`;
      }).filter(Boolean);

      const topSummary = podiumParts.length
        ? `<div class="flex flex-wrap items-center gap-x-3 gap-y-1">${podiumParts.join('<span class="text-amber-500/40">•</span>')}</div>`
        : '✨ В таблице лидеров пока никого нет';

      const meta = this.getQuizMeta(quiz);
      const card = document.createElement('div');
      card.className = 'cozy-card rounded-3xl p-6 flex flex-col justify-between hover:border-amber-400/50 transition group';
      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-medium">${this.escapeHtml(quiz.badge)}</span>
            <span class="text-xs text-amber-200/60">${quiz.questions.length} вопросов</span>
          </div>
          <h3 class="font-serif text-2xl font-bold text-amber-100 group-hover:text-amber-300 transition mb-2">${this.escapeHtml(quiz.title)}</h3>
          <p class="text-amber-200/75 text-sm mb-3 line-clamp-2">${this.escapeHtml(quiz.description)}</p>
          <div class="text-[11px] text-amber-200/60 mb-4 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>✍️ Создал: <strong class="text-amber-200/90 font-medium">${this.escapeHtml(meta.author)}</strong></span>
            <span>•</span>
            <span>📅 ${this.escapeHtml(meta.createdAtText)}</span>
          </div>
        </div>
        <div class="pt-4 border-t border-amber-500/15 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <div class="text-xs text-amber-200/80 min-w-0">${topSummary}</div>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" onclick="event.stopPropagation(); app.copyQuizLink('${this.escapeHtml(quiz.id)}')" title="Скопировать ссылку на страницу интерактива" class="px-2.5 py-2 rounded-xl bg-stone-900/80 hover:bg-stone-800 border border-amber-500/25 text-amber-200/85 text-xs transition cursor-pointer">🔗</button>
            <button type="button" onclick="app.openLobby('${this.escapeHtml(quiz.id)}')" class="cozy-btn text-stone-950 font-bold px-4 py-2 rounded-xl text-sm cursor-pointer">Открыть →</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  },

  handlePlayClick(quizId) {
    const quiz = this.state.quizzes.find(q => q.id === quizId);
    if (!quiz) return;
    this.state.activeQuiz = quiz;
    if (!this.state.username) return this.openNameModal({ quizId: quiz.id, startQuiz: true });
    this.startQuiz();
  },

  openLobby(quizId, options = {}) {
    const quiz = this.state.quizzes.find(q => q.id === quizId);
    if (!quiz) return;

    this.state.activeQuiz = quiz;
    if (!options.skipHistory) this.syncUrlForQuiz(quiz.id, Boolean(options.replaceHistory));
    document.title = `${quiz.title} — Уютные интерактивы`;

    const meta = this.getQuizMeta(quiz);
    document.getElementById('lobby-badge').textContent = quiz.badge;
    const countEl = document.getElementById('lobby-questions-count');
    if (countEl) countEl.textContent = `${quiz.questions.length} вопросов`;
    document.getElementById('lobby-title').textContent = quiz.title;
    document.getElementById('lobby-desc').innerHTML = `
      <span>${this.escapeHtml(quiz.description)}</span>
      <span class="block mt-2 text-xs text-amber-200/60">✍️ Создал: <strong class="text-amber-200/90 font-medium">${this.escapeHtml(meta.author)}</strong> • 📅 ${this.escapeHtml(meta.createdAtText)}</span>
    `;

    const editBtn = document.getElementById('lobby-edit-owner-btn');
    if (editBtn) {
      const sess = this.state.ownerSession;
      editBtn.classList.toggle('hidden', !(sess?.ownerToken && sess.ownedQuizId === quiz.id));
    }

    this.setPlayMode(this.state.playMode || 'relaxed');
    this.renderLeaderboard(quiz.id, 'lobby-leaderboard');
    this.fetchGlobalLeaderboards(quiz.id);
    this.switchView('view-lobby');
  },

  renderLeaderboard(quizId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const list = this.getRankedLeaderboard(quizId);
    if (list.length === 0) {
      container.innerHTML = `<div class="text-center py-6 px-4 bg-stone-900/50 rounded-2xl border border-amber-500/15 text-amber-200/70 text-sm">В таблице лидеров этого интерактива пока никого нет. Пройди его первым, чтобы занять первое место! 🎄</div>`;
      return;
    }

    container.innerHTML = list.map(entry => {
      const isMe = this.state.username && entry.name.toLowerCase() === this.state.username.toLowerCase();
      const hasTimer = typeof entry.durationSec === 'number' && Number.isFinite(entry.durationSec);
      return `
        <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3.5 sm:px-4 py-3 rounded-2xl ${isMe ? 'bg-amber-500/20 border border-amber-400/50' : 'bg-stone-900/65 border border-amber-500/15'}">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <span class="text-base sm:text-lg font-bold w-7 sm:w-8 text-center shrink-0">${this.getPositionBadge(entry.position)}</span>
            <div class="min-w-0 flex-1">
              <span class="font-semibold text-sm sm:text-base break-words ${isMe ? 'text-amber-300' : 'text-amber-100'}">${this.escapeHtml(entry.name)} ${isMe ? '(Ты)' : ''}</span>
              <span class="block text-[11px] text-amber-200/50">${this.escapeHtml(entry.date || 'Недавно')}</span>
            </div>
          </div>
          <div class="text-left sm:text-right shrink-0 flex items-center gap-1.5">
            ${hasTimer ? `<span class="inline-block px-2 py-1 rounded-xl bg-sky-950/90 border border-sky-500/30 text-sky-300 font-mono font-semibold text-xs whitespace-nowrap">⚡ ${entry.durationSec.toFixed(1)}с</span>` : ''}
            <span class="inline-block px-2.5 sm:px-3 py-1 rounded-xl bg-emerald-950/90 border border-emerald-500/30 text-emerald-300 font-bold text-xs sm:text-sm whitespace-nowrap">${Number(entry.score)} / ${Number(entry.total)} верных</span>
          </div>
        </div>
      `;
    }).join('');
  },

  startQuiz() {
    if (!this.state.activeQuiz) return;
    if (!this.state.username) return this.openNameModal({ quizId: this.state.activeQuiz.id, startQuiz: true });

    this.state.currentQuestionIndex = 0;
    this.state.currentScore = 0;
    this.state.routeHistory = [{ step: 0, lane: 'main' }];
    this.switchView('view-quiz');
    this.startQuizTimer();
    this.renderLeaderboard(this.state.activeQuiz.id, 'quiz-live-leaderboard');
    this.fetchGlobalLeaderboards(this.state.activeQuiz.id);
    this.renderJourneyMap();
    this.renderQuestion();
  },

  renderQuestion() {
    const quiz = this.state.activeQuiz;
    const idx = this.state.currentQuestionIndex;
    const qData = quiz.questions[idx];

    document.getElementById('quiz-progress-text').textContent = `Этап ${idx + 1} из ${quiz.questions.length}`;
    document.getElementById('quiz-score-live').textContent = `Верно: ${this.state.currentScore}`;
    document.getElementById('question-text').textContent = qData.q;

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    qData.options.forEach((optText, optIdx) => {
      const btn = document.createElement('button');
      const letter = OPTION_LETTERS[optIdx] || String(optIdx + 1);
      btn.className = 'w-full text-left p-4 rounded-2xl bg-stone-900/80 hover:bg-amber-500/20 border border-amber-500/25 hover:border-amber-400 text-amber-100 text-sm sm:text-base transition flex items-center gap-3 cursor-pointer';
      btn.innerHTML = `<span class="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">${letter}</span><span>${this.escapeHtml(optText)}</span>`;
      btn.onclick = () => this.handleAnswer(optIdx, btn);
      optionsContainer.appendChild(btn);
    });
  },

  handleAnswer(selectedIdx, clickedBtn) {
    const quiz = this.state.activeQuiz;
    const qData = quiz.questions[this.state.currentQuestionIndex];
    const allBtns = document.getElementById('options-container').querySelectorAll('button');
    allBtns.forEach(b => (b.disabled = true));

    const isCorrect = selectedIdx === qData.correct;
    const nextStep = this.state.currentQuestionIndex + 1;

    if (isCorrect) {
      this.state.currentScore++;
      this.state.routeHistory.push({ step: nextStep, lane: 'main' });
      clickedBtn.className = 'w-full text-left p-4 rounded-2xl bg-emerald-900/80 border-2 border-emerald-400 text-emerald-100 text-sm sm:text-base flex items-center gap-3 transition-all duration-200';
      document.getElementById('quiz-score-live').textContent = `Верно: ${this.state.currentScore}`;
    } else {
      this.state.routeHistory.push({ step: nextStep, lane: 'detour' });
      clickedBtn.className = 'w-full text-left p-4 rounded-2xl bg-red-950/90 border-2 border-red-500 text-red-100 text-sm sm:text-base flex items-center gap-3 shake-fast';
      if (allBtns[qData.correct]) {
        allBtns[qData.correct].className = 'w-full text-left p-4 rounded-2xl bg-emerald-900/60 border border-emerald-400 text-emerald-100 text-sm sm:text-base flex items-center gap-3 transition-all duration-150';
      }
    }

    this.renderJourneyMap();
    this.renderLeaderboard(quiz.id, 'quiz-live-leaderboard');

    setTimeout(() => {
      this.state.currentQuestionIndex++;
      if (this.state.currentQuestionIndex < quiz.questions.length) this.renderQuestion();
      else this.finishQuiz();
    }, isCorrect ? 800 : 450);
  },

  finishQuiz() {
    this.stopQuizTimer();
    const quiz = this.state.activeQuiz;
    const score = this.state.currentScore;
    const total = quiz.questions.length;
    const mode = this.state.playMode || 'relaxed';
    const durationSec = mode === 'speed' ? this.state.quizElapsedSec : null;

    if (!this.state.leaderboards[quiz.id]) this.state.leaderboards[quiz.id] = [];
    const board = this.state.leaderboards[quiz.id];
    const playerName = this.state.username || 'Гость';
    const nowStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const existingIdx = board.findIndex(item => item.name.toLowerCase() === playerName.toLowerCase());

    if (existingIdx !== -1) {
      const prev = board[existingIdx];
      const prevScore = Number(prev.score) || 0;
      const prevDur = typeof prev.durationSec === 'number' && Number.isFinite(prev.durationSec) ? prev.durationSec : null;

      if (score > prevScore) {
        board[existingIdx] = {
          name: playerName,
          score,
          total,
          date: nowStr,
          mode: durationSec !== null ? mode : (prev.mode || mode),
          durationSec: durationSec !== null ? durationSec : prevDur
        };
      } else if (score === prevScore && durationSec !== null && (prevDur === null || durationSec < prevDur)) {
        board[existingIdx] = { name: playerName, score, total, date: nowStr, mode: 'speed', durationSec };
      }
    } else {
      board.push({ name: playerName, score, total, date: nowStr, mode, durationSec });
    }

    this.saveLeaderboards();
    this.submitScoreToGlobal(quiz.id, playerName, score, total, nowStr, mode, durationSec);

    const stats = this.getRouteStats();
    document.getElementById('result-username').textContent = playerName;
    document.getElementById('result-score').textContent = score;
    document.getElementById('result-total').textContent = total;
    document.getElementById('result-emoji').textContent = stats.emoji;
    document.getElementById('summary-yellow-count').textContent = this.formatStepsCount(stats.yellowSteps);
    document.getElementById('summary-blue-count').textContent = this.formatStepsCount(stats.blueSteps);
    document.getElementById('route-conclusion-text').textContent = stats.conclusion;

    this.renderFinalMapPreview();
    this.renderLeaderboard(quiz.id, 'results-leaderboard');
    this.switchView('view-results');
  },

  async sendGiftViaResend() {
    const btn = document.getElementById('send-gift-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Отправляем подарок...</span> ❄️';

    const stats = this.getRouteStats();
    const payload = {
      senderName: (this.state.username || 'Гость').slice(0, 30),
      quizTitle: (this.state.activeQuiz?.title || 'Интерактив').slice(0, 100),
      score: `${this.state.currentScore} из ${this.state.activeQuiz?.questions?.length || 10} (жёлтый путь: ${stats.yellowSteps}, синий путь: ${stats.blueSteps})`,
      rating: document.getElementById('selected-rating').value,
      gift: document.getElementById('selected-gift').value,
      message: (document.getElementById('gift-message').value.trim() || 'Без дополнительного текста, но с теплом!').slice(0, 500)
    };

    try {
      const res = await fetch('/api/send-gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка отправки');

      this.showToast('Подарок и оценка успешно отправлены!', '🎁');
      document.getElementById('gift-message').value = '';
    } catch (err) {
      this.showToast(err.message || 'Не удалось отправить письмо. Проверьте настройки Resend.', '⚠️');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
});