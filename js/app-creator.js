Object.assign(window.app, {
  loadOwnerSession() {
    try {
      const raw = localStorage.getItem('cozy_owner_session');
      this.state.ownerSession = raw ? JSON.parse(raw) : null;
    } catch {
      this.state.ownerSession = null;
    }
    this.updateInviteNavButton();
  },

  saveOwnerSession(session) {
    this.state.ownerSession = session;
    if (session) localStorage.setItem('cozy_owner_session', JSON.stringify(session));
    else localStorage.removeItem('cozy_owner_session');
    this.updateInviteNavButton();
  },

  updateInviteNavButton() {
    const btn = document.getElementById('nav-invite-action-btn');
    if (!btn) return;
    const sess = this.state.ownerSession;
    btn.textContent = sess?.ownerToken
      ? (sess.ownedQuizId ? '✏️ Мой интерактив' : '✨ Создать свой квиз')
      : '🎟️ Ввести код';
  },

  handleInviteNavClick() {
    const sess = this.state.ownerSession;
    if (sess?.ownerToken) {
      if (sess.ownedQuizId) {
        const ownedQuiz = this.state.quizzes.find(q => q.id === sess.ownedQuizId);
        if (ownedQuiz) {
          this.openLobby(ownedQuiz.id);
          this.openEditOwnedQuiz();
          return;
        }
      } else {
        this.openCreateOwnedQuiz();
        return;
      }
    }
    this.openInviteModal();
  },

  openInviteModal() {
    const modal = document.getElementById('invite-modal');
    const input = document.getElementById('invite-code-input');
    if (!modal || !input) return;
    input.value = '';
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 80);
  },

  closeInviteModal() {
    document.getElementById('invite-modal')?.classList.add('hidden');
  },

  async redeemInviteCode(codeInput) {
    const code = String(codeInput || '').trim().toUpperCase();
    if (!code) return;

    const btn = document.getElementById('invite-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Проверяем...';
    }

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redeem', code })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ownerToken) {
        this.showToast(data.error || 'Не удалось активировать код', '🔒');
        return;
      }

      const ownedQuizId = data.ownedQuizId || null;
      this.saveOwnerSession({
        code: data.code || code,
        ownerToken: data.ownerToken,
        ownedQuizId
      });

      this.closeInviteModal();

      if (ownedQuizId) {
        await this.fetchGlobalQuizzes();
        const existingQuiz = this.state.quizzes.find(q => q.id === ownedQuizId);
        if (existingQuiz) {
          this.showToast('Сессия владельца восстановлена! Открываем ваш интерактив', '✏️');
          this.openLobby(existingQuiz.id);
          this.openEditOwnedQuiz();
          return;
        }
      }

      this.showToast('Код принят! Теперь можно создать 1 свой интерактив', '🎟️');
      this.openCreateOwnedQuiz();
    } catch {
      this.showToast('Ошибка сети при проверке кода', '⚠️');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Активировать код';
      }
    }
  },

  getNormalizedOwnerCount(rawVal) {
    const num = parseInt(rawVal, 10);
    return Number.isNaN(num) ? 10 : Math.max(3, Math.min(30, num));
  },

  setOwnerCountControls(count) {
    const input = document.getElementById('owner-quiz-count');
    const preset = document.getElementById('owner-quiz-count-preset');
    if (input) input.value = String(count);
    if (preset) {
      const hasOption = Array.from(preset.options).some(opt => Number(opt.value) === count);
      preset.value = hasOption ? String(count) : '';
    }
  },

  collectQuestionDraftFromDom(idPrefix) {
    const draft = [];
    for (let i = 0; i < 30; i++) {
      const qEl = document.getElementById(`${idPrefix}-text-${i}`);
      if (!qEl) break;

      const options = [];
      for (let oIdx = 0; oIdx < OPTION_LETTERS.length; oIdx++) {
        const optEl = document.getElementById(`${idPrefix}-${i}-opt-${oIdx}`);
        if (!optEl) break;
        options.push(optEl.value);
      }

      const correctEl = document.getElementById(`${idPrefix}-correct-${i}`);
      const rawCorrect = correctEl ? parseInt(correctEl.value, 10) : 0;
      const safeOptions = options.length >= 2 ? options : ['', '', '', ''];
      const correct = Number.isNaN(rawCorrect) ? 0 : Math.min(Math.max(0, rawCorrect), safeOptions.length - 1);

      draft.push({ q: qEl.value, options: safeOptions, correct });
    }
    return draft;
  },

  syncOwnerQuestionCount(val) {
    const draft = this.collectQuestionDraftFromDom('owner-q');
    this.setOwnerCountControls(this.getNormalizedOwnerCount(val));
    this.renderOwnerQuestionInputs(draft);
  },

  handleOwnerQuestionCountInput() {
    const input = document.getElementById('owner-quiz-count');
    if (!input || !input.value.trim()) return;
    const parsed = parseInt(input.value, 10);
    if (Number.isNaN(parsed)) return;

    const draft = this.collectQuestionDraftFromDom('owner-q');
    if (parsed > 30) {
      input.value = '30';
      this.showToast('Максимум 30 вопросов', 'ℹ️');
    }
    this.setOwnerCountControls(this.getNormalizedOwnerCount(input.value));
    this.renderOwnerQuestionInputs(draft);
  },

  changeQuestionOptionCount(idPrefix, qIndex, delta) {
    const draft = this.collectQuestionDraftFromDom(idPrefix);
    const target = draft[qIndex];
    if (!target) return;

    const nextLen = target.options.length + delta;
    if (nextLen < 2) {
      this.showToast('Минимум 2 варианта ответа', 'ℹ️');
      return;
    }
    if (nextLen > OPTION_LETTERS.length) {
      this.showToast(`Максимум ${OPTION_LETTERS.length} вариантов ответа`, 'ℹ️');
      return;
    }

    if (delta > 0) {
      target.options.push('');
    } else {
      target.options.pop();
      if (target.correct >= target.options.length) {
        target.correct = target.options.length - 1;
      }
    }

    if (idPrefix === 'owner-q') {
      this.renderOwnerQuestionInputs(draft);
    } else {
      this.renderAdminQuestionInputs(draft);
    }
  },

  buildQuestionCardHtml({ idPrefix, index, question = null, maxQ = 240, maxOpt = 120 }) {
    const qVal = question ? this.escapeHtml(question.q) : '';
    const rawOpts = Array.isArray(question?.options) && question.options.length >= 2
      ? question.options.slice(0, OPTION_LETTERS.length)
      : ['', '', '', ''];
    const rawCorrect = question ? Number(question.correct) : 0;
    const correct = Number.isNaN(rawCorrect) ? 0 : Math.min(Math.max(0, rawCorrect), rawOpts.length - 1);

    const selectOptionsHtml = rawOpts.map((_, oIdx) => {
      const letter = OPTION_LETTERS[oIdx];
      return `<option value="${oIdx}" ${correct === oIdx ? 'selected' : ''}>${letter}</option>`;
    }).join('');

    return `
      <div class="p-4 rounded-2xl bg-stone-900/90 border border-amber-500/20 space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs font-bold text-amber-400">Вопрос #${index + 1}</span>
          <div class="flex items-center gap-2">
            <div class="inline-flex items-center gap-1 bg-stone-800/90 border border-amber-500/25 rounded-lg px-1.5 py-0.5 text-[11px] text-amber-200/85">
              <span>Ответов: ${rawOpts.length}</span>
              <button type="button" onclick="app.changeQuestionOptionCount('${idPrefix}', ${index}, -1)" ${rawOpts.length <= 2 ? 'disabled' : ''} title="Убрать последний вариант" class="px-1.5 rounded bg-stone-700 hover:bg-stone-600 disabled:opacity-35 text-amber-200 font-bold cursor-pointer">−</button>
              <button type="button" onclick="app.changeQuestionOptionCount('${idPrefix}', ${index}, 1)" ${rawOpts.length >= OPTION_LETTERS.length ? 'disabled' : ''} title="Добавить вариант ответа" class="px-1.5 rounded bg-stone-700 hover:bg-stone-600 disabled:opacity-35 text-amber-200 font-bold cursor-pointer">+</button>
            </div>
            <label class="text-xs text-amber-200/80 flex items-center gap-1.5">
              Верный:
              <select id="${idPrefix}-correct-${index}" class="bg-stone-800 border border-amber-500/30 rounded px-2 py-0.5 text-amber-300">
                ${selectOptionsHtml}
              </select>
            </label>
          </div>
        </div>
        <input type="text" id="${idPrefix}-text-${index}" value="${qVal}" required maxlength="${maxQ}" placeholder="Текст вопроса ${index + 1}..." class="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-500/20 text-amber-100 text-xs sm:text-sm">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${rawOpts.map((optVal, oIdx) => `
            <input type="text" id="${idPrefix}-${index}-opt-${oIdx}" value="${this.escapeHtml(optVal || '')}" required maxlength="${maxOpt}" placeholder="Вариант ${OPTION_LETTERS[oIdx]}" class="px-3 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs">
          `).join('')}
        </div>
      </div>
    `;
  },

  readQuestionInputs(idPrefix, count) {
    const questions = [];
    for (let i = 0; i < count; i++) {
      const options = [];
      for (let oIdx = 0; oIdx < OPTION_LETTERS.length; oIdx++) {
        const optEl = document.getElementById(`${idPrefix}-${i}-opt-${oIdx}`);
        if (!optEl) break;
        options.push(optEl.value.trim());
      }
      questions.push({
        q: document.getElementById(`${idPrefix}-text-${i}`).value.trim(),
        options,
        correct: parseInt(document.getElementById(`${idPrefix}-correct-${i}`).value, 10)
      });
    }
    return questions;
  },

  openCreateOwnedQuiz() {
    const sess = this.state.ownerSession;
    if (!sess?.ownerToken) return this.openInviteModal();
    if (sess.ownedQuizId) {
      this.showToast('Лимит кода: 1 интерактив. Вы можете редактировать уже созданный!', 'ℹ️');
      return this.openEditOwnedQuiz();
    }

    this.state.editingQuizId = null;
    document.getElementById('creator-mode-badge').textContent = `🎟️ Код ${sess.code} • Создание (1 из 1)`;
    document.getElementById('creator-modal-title').textContent = 'Создать свой интерактив';
    document.getElementById('owner-quiz-save-btn').textContent = 'Опубликовать интерактив ✨';
    document.getElementById('owner-quiz-form').reset();
    document.getElementById('owner-quiz-author').value = this.state.username || '';
    this.setOwnerCountControls(10);
    this.renderOwnerQuestionInputs([]);
    document.getElementById('creator-modal').classList.remove('hidden');
  },

  openEditOwnedQuiz() {
    const sess = this.state.ownerSession;
    const quiz = this.state.activeQuiz || (sess && this.state.quizzes.find(q => q.id === sess.ownedQuizId));
    if (!sess?.ownerToken || !quiz || sess.ownedQuizId !== quiz.id) {
      this.showToast('Редактировать интерактив может только его владелец', '🔒');
      return;
    }

    this.state.editingQuizId = quiz.id;
    document.getElementById('creator-mode-badge').textContent = `✏️ Владелец (${sess.code})`;
    document.getElementById('creator-modal-title').textContent = 'Редактировать свой интерактив';
    document.getElementById('owner-quiz-save-btn').textContent = 'Сохранить изменения 💾';
    document.getElementById('owner-quiz-title').value = quiz.title || '';
    document.getElementById('owner-quiz-badge').value = quiz.badge || '🍂 Осенний вечер';
    document.getElementById('owner-quiz-author').value = quiz.author || '';
    document.getElementById('owner-quiz-desc').value = quiz.description || '';

    const qLen = this.getNormalizedOwnerCount(quiz.questions?.length || 10);
    this.setOwnerCountControls(qLen);
    this.renderOwnerQuestionInputs(quiz.questions || []);
    document.getElementById('creator-modal').classList.remove('hidden');
  },

  closeCreatorModal() {
    document.getElementById('creator-modal')?.classList.add('hidden');
    this.state.editingQuizId = null;
  },

  renderOwnerQuestionInputs(prefillQuestions = null) {
    const container = document.getElementById('owner-questions-list');
    const countInput = document.getElementById('owner-quiz-count');
    if (!container || !countInput) return;

    const draft = Array.isArray(prefillQuestions)
      ? prefillQuestions
      : this.collectQuestionDraftFromDom('owner-q');

    const count = this.getNormalizedOwnerCount(countInput.value);
    container.innerHTML = Array.from({ length: count }, (_, i) =>
      this.buildQuestionCardHtml({
        idPrefix: 'owner-q',
        index: i,
        question: draft[i] || null
      })
    ).join('');
  },

  async handleSaveOwnedQuiz() {
    const sess = this.state.ownerSession;
    if (!sess?.ownerToken) {
      this.showToast('Сессия владельца не найдена', '🔒');
      return;
    }

    const count = this.getNormalizedOwnerCount(document.getElementById('owner-quiz-count').value);
    const quizPayload = {
      title: document.getElementById('owner-quiz-title').value.trim(),
      badge: document.getElementById('owner-quiz-badge').value,
      author: (document.getElementById('owner-quiz-author').value.trim() || this.state.username || 'Гость').slice(0, 40),
      description: document.getElementById('owner-quiz-desc').value.trim(),
      questions: this.readQuestionInputs('owner-q', count)
    };

    const saveBtn = document.getElementById('owner-quiz-save-btn');
    saveBtn.disabled = true;
    const isEditing = Boolean(this.state.editingQuizId);

    try {
      const res = await fetch('/api/quizzes', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEditing
            ? { ownerToken: sess.ownerToken, quiz: { id: this.state.editingQuizId, ...quizPayload } }
            : { inviteCode: sess.code, ownerToken: sess.ownerToken, quiz: quizPayload }
        )
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.quiz) {
        this.showToast(data.error || 'Не удалось сохранить интерактив', '⚠️');
        return;
      }

      if (Array.isArray(data.quizzes)) {
        this.state.quizzes = data.quizzes;
        this.saveQuizzes();
      }
      if (!isEditing) {
        this.saveOwnerSession({ ...sess, ownedQuizId: data.quiz.id });
      }

      this.closeCreatorModal();
      this.openLobby(data.quiz.id);
      this.showToast(
        isEditing ? 'Изменения в вашем интерактиве сохранены!' : 'Ваш интерактив создан! Теперь можно редактировать только его',
        '🎄'
      );
    } catch {
      this.showToast('Ошибка сети при сохранении', '⚠️');
    } finally {
      saveBtn.disabled = false;
    }
  },

  async publishQuizToGlobal(newQuiz) {
    if (!this.state.adminPasscode) {
      return { ok: false, error: 'Введите пароль админа заново для публикации на сервере' };
    }
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: this.state.adminPasscode, quiz: newQuiz })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || 'Не удалось сохранить квиз на сервере' };
      if (Array.isArray(data.quizzes)) {
        this.state.quizzes = data.quizzes;
        this.saveQuizzes();
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Сеть недоступна: квиз сохранён только локально' };
    }
  },

  grantAdminAccess(adminHtml) {
    this.state.isAdminUnlocked = true;
    document.getElementById('admin-auth-box').classList.add('hidden');

    const container = document.getElementById('admin-panel-container');
    if (adminHtml) {
      container.innerHTML = adminHtml;
      this.renderAdminQuestionInputs([]);
      document.getElementById('create-quiz-form')?.addEventListener('submit', e => {
        e.preventDefault();
        this.handleCreateQuiz();
      });
    }
    this.showToast('Панель создателя разблокирована', '⚙️');
  },

  async unlockAdmin() {
    const passInput = document.getElementById('admin-pass-input');
    const unlockBtn = document.getElementById('admin-unlock-btn');
    const passcode = passInput.value.trim();
    if (!passcode) return;

    unlockBtn.disabled = true;
    unlockBtn.textContent = '...';

    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.authorized && data.adminHtml) {
        this.state.adminPasscode = passcode;
        this.grantAdminAccess(data.adminHtml);
      } else {
        this.showToast(data.error || 'Неверный код доступа', '🔒');
      }
    } catch {
      this.showToast('Сервер недоступен. Для локального теста запустите npx vercel dev', '⚠️');
    } finally {
      unlockBtn.disabled = false;
      unlockBtn.textContent = 'Войти';
    }
  },

  renderAdminQuestionInputs(prefillQuestions = null) {
    const container = document.getElementById('admin-questions-list');
    if (!container) return;
    const draft = Array.isArray(prefillQuestions)
      ? prefillQuestions
      : this.collectQuestionDraftFromDom('q');

    container.innerHTML = Array.from({ length: 10 }, (_, i) =>
      this.buildQuestionCardHtml({
        idPrefix: 'q',
        index: i,
        question: draft[i] || null,
        maxQ: 200,
        maxOpt: 100
      })
    ).join('');
  },

  async handleCreateQuiz() {
    const newQuiz = {
      id: `quiz-${Date.now()}`,
      title: document.getElementById('new-quiz-title').value.trim(),
      badge: document.getElementById('new-quiz-badge').value,
      description: document.getElementById('new-quiz-desc').value.trim(),
      author: (this.state.username || 'Iakov').trim() || 'Iakov',
      createdAt: new Date().toISOString(),
      questions: this.readQuestionInputs('q', 10)
    };

    this.state.quizzes.unshift(newQuiz);
    this.saveQuizzes();
    this.renderHome();
    this.toggleAdminModal();
    document.getElementById('create-quiz-form').reset();

    const syncRes = await this.publishQuizToGlobal(newQuiz);
    this.openLobby(newQuiz.id);
    this.showToast(
      syncRes.ok ? 'Новый интерактив опубликован! Открыта его личная страница' : syncRes.error,
      syncRes.ok ? '🎄' : '⚠️'
    );
  }
});