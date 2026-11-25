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

  async verifyOwnerSession() {
    const sess = this.state.ownerSession;
    if (!sess?.code || !sess?.ownerToken) {
      this.updateInviteNavButton();
      return;
    }

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          code: sess.code,
          ownerToken: sess.ownerToken
        })
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));

      if (data.valid !== true) {
        this.saveOwnerSession(null);
        this.closeCreatorModal();
        document.getElementById('lobby-edit-owner-btn')?.classList.add('hidden');
        this.showToast('Ваш инвайт-код был отозван администратором', '🔒');
        return;
      }

      if ((data.ownedQuizId || null) !== (sess.ownedQuizId || null)) {
        this.saveOwnerSession({
          ...sess,
          ownedQuizId: data.ownedQuizId || null
        });
      }
    } catch {}
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
        body: JSON.stringify({
          action: 'redeem',
          code,
          username: this.state.username || ''
        })
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

  _preserveQuestionsScroll(containerId, fn) {
    const container = document.getElementById(containerId);
    const modal = document.getElementById('creator-modal');
    const prevListScroll = container ? container.scrollTop : 0;
    const prevModalScroll = modal ? modal.scrollTop : 0;

    fn();

    requestAnimationFrame(() => {
      if (container) container.scrollTop = prevListScroll;
      if (modal && prevModalScroll > 0) modal.scrollTop = prevModalScroll;
    });
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
    document.querySelectorAll('.owner-count-chip').forEach(btn => {
      const active = Number(btn.dataset.count) === count;
      btn.className = `owner-count-chip px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
        active
          ? 'bg-amber-400 text-stone-950'
          : 'bg-stone-800/90 hover:bg-stone-700 border border-amber-500/25 text-amber-200'
      }`;
    });
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
    this._preserveQuestionsScroll('owner-questions-list', () => {
      this.renderOwnerQuestionInputs(draft);
    });
  },

  stepOwnerQuestionCount(delta) {
    const input = document.getElementById('owner-quiz-count');
    const current = this.getNormalizedOwnerCount(input?.value || 10);
    const next = Math.max(3, Math.min(30, current + delta));
    if (next === current) {
      this.showToast(delta > 0 ? 'Максимум 30 вопросов' : 'Минимум 3 вопроса', 'ℹ️');
      return;
    }
    this.syncOwnerQuestionCount(next);
  },

  removeQuestionAt(idPrefix, qIndex) {
    const draft = this.collectQuestionDraftFromDom(idPrefix);
    if (draft.length <= 3) {
      this.showToast('Минимум 3 вопроса в интерактиве', 'ℹ️');
      return;
    }
    draft.splice(qIndex, 1);
    const listId = idPrefix === 'owner-q' ? 'owner-questions-list' : 'admin-questions-list';
    this._preserveQuestionsScroll(listId, () => {
      if (idPrefix === 'owner-q') {
        this.setOwnerCountControls(draft.length);
        this.renderOwnerQuestionInputs(draft);
      } else {
        this.renderAdminQuestionInputs(draft);
      }
    });
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
    this._preserveQuestionsScroll('owner-questions-list', () => {
      this.renderOwnerQuestionInputs(draft);
    });
  },

  selectQuestionCorrect(idPrefix, qIndex, optIndex) {
    const hiddenInput = document.getElementById(`${idPrefix}-correct-${qIndex}`);
    if (hiddenInput) hiddenInput.value = String(optIndex);

    for (let oIdx = 0; oIdx < OPTION_LETTERS.length; oIdx++) {
      const row = document.getElementById(`${idPrefix}-${qIndex}-row-${oIdx}`);
      const badgeBtn = document.getElementById(`${idPrefix}-${qIndex}-pick-${oIdx}`);
      if (!row || !badgeBtn) break;

      const isSelected = oIdx === optIndex;
      row.className = `flex items-center gap-1.5 p-1.5 rounded-xl border transition ${
        isSelected
          ? 'bg-emerald-950/55 border-emerald-400/70'
          : 'bg-stone-950/90 border-amber-500/15 hover:border-amber-500/35'
      }`;
      badgeBtn.className = `min-w-[2rem] h-8 px-1.5 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 transition cursor-pointer ${
        isSelected
          ? 'bg-emerald-500 text-stone-950 shadow-sm'
          : 'bg-stone-800 hover:bg-amber-500/25 text-amber-300 border border-amber-500/25'
      }`;
      badgeBtn.title = isSelected ? 'Верный ответ' : 'Сделать верным ответом';
      badgeBtn.textContent = isSelected ? `✓ ${OPTION_LETTERS[oIdx]}` : OPTION_LETTERS[oIdx];
    }
  },

  setQuestionOptionCount(idPrefix, qIndex, targetCount) {
    const draft = this.collectQuestionDraftFromDom(idPrefix);
    const target = draft[qIndex];
    if (!target) return;

    const clamped = Math.max(2, Math.min(OPTION_LETTERS.length, targetCount));
    while (target.options.length < clamped) target.options.push('');
    if (target.options.length > clamped) {
      target.options.length = clamped;
      if (target.correct >= clamped) target.correct = clamped - 1;
    }

    const listId = idPrefix === 'owner-q' ? 'owner-questions-list' : 'admin-questions-list';
    this._preserveQuestionsScroll(listId, () => {
      if (idPrefix === 'owner-q') this.renderOwnerQuestionInputs(draft);
      else this.renderAdminQuestionInputs(draft);
    });
  },

  removeQuestionOptionAt(idPrefix, qIndex, optIndex) {
    const draft = this.collectQuestionDraftFromDom(idPrefix);
    const target = draft[qIndex];
    if (!target) return;

    if (target.options.length <= 2) {
      this.showToast('Минимум 2 варианта ответа', 'ℹ️');
      return;
    }

    target.options.splice(optIndex, 1);
    if (target.correct === optIndex) {
      target.correct = 0;
    } else if (target.correct > optIndex) {
      target.correct -= 1;
    }

    const listId = idPrefix === 'owner-q' ? 'owner-questions-list' : 'admin-questions-list';
    this._preserveQuestionsScroll(listId, () => {
      if (idPrefix === 'owner-q') this.renderOwnerQuestionInputs(draft);
      else this.renderAdminQuestionInputs(draft);
    });
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
    this.setQuestionOptionCount(idPrefix, qIndex, nextLen);
  },

  buildQuestionCardHtml({ idPrefix, index, totalCount = 10, question = null, maxQ = 240, maxOpt = 120 }) {
    const qVal = question ? this.escapeHtml(question.q) : '';
    const rawOpts = Array.isArray(question?.options) && question.options.length >= 2
      ? question.options.slice(0, OPTION_LETTERS.length)
      : ['', '', '', ''];
    const rawCorrect = question ? Number(question.correct) : 0;
    const correct = Number.isNaN(rawCorrect) ? 0 : Math.min(Math.max(0, rawCorrect), rawOpts.length - 1);

    const countChipsHtml = [2, 3, 4, 5, 6].map(num => {
      const isCurrent = rawOpts.length === num;
      return `<button type="button" onclick="app.setQuestionOptionCount('${idPrefix}', ${index}, ${num})" class="w-6 h-6 rounded-md text-[11px] font-bold transition cursor-pointer ${
        isCurrent
          ? 'bg-amber-400 text-stone-950'
          : 'bg-stone-800 hover:bg-stone-700 text-amber-200/80'
      }">${num}</button>`;
    }).join('');

    return `
      <div class="p-3.5 sm:p-4 rounded-2xl bg-stone-900/90 border border-amber-500/20 space-y-2.5 sm:space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-amber-400">Вопрос #${index + 1}</span>
            <span class="text-[11px] text-emerald-300/80 hidden sm:inline">• Нажми на букву слева, чтобы отметить верный</span>
          </div>
          <div class="flex items-center gap-1.5 sm:gap-2">
            <div class="inline-flex items-center gap-1 bg-stone-950/90 border border-amber-500/20 rounded-lg p-0.5">
              <span class="text-[10px] text-amber-200/60 px-1">Ответов:</span>
              ${countChipsHtml}
            </div>
            ${totalCount > 3 ? `<button type="button" onclick="app.removeQuestionAt('${idPrefix}', ${index})" title="Удалить этот вопрос" class="w-7 h-7 sm:w-auto sm:h-auto sm:px-2 sm:py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/25 text-rose-200 text-xs flex items-center justify-center cursor-pointer shrink-0">🗑️</button>` : ''}
          </div>
        </div>

        <input type="hidden" id="${idPrefix}-correct-${index}" value="${correct}">
        <input type="text" id="${idPrefix}-text-${index}" value="${qVal}" required maxlength="${maxQ}" placeholder="Текст вопроса ${index + 1}..." class="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-amber-500/25 text-amber-100 text-sm">

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${rawOpts.map((optVal, oIdx) => {
            const isSelected = correct === oIdx;
            const letter = OPTION_LETTERS[oIdx];
            return `
              <div id="${idPrefix}-${index}-row-${oIdx}" class="flex items-center gap-1.5 p-1.5 rounded-xl border transition ${
                isSelected
                  ? 'bg-emerald-950/55 border-emerald-400/70'
                  : 'bg-stone-950/90 border-amber-500/15 hover:border-amber-500/35'
              }">
                <button
                  type="button"
                  id="${idPrefix}-${index}-pick-${oIdx}"
                  onclick="app.selectQuestionCorrect('${idPrefix}', ${index}, ${oIdx})"
                  title="${isSelected ? 'Верный ответ' : 'Сделать верным ответом'}"
                  class="min-w-[2rem] h-8 px-1.5 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 text-stone-950 shadow-sm'
                      : 'bg-stone-800 hover:bg-amber-500/25 text-amber-300 border border-amber-500/25'
                  }"
                >${isSelected ? `✓ ${letter}` : letter}</button>
                <input
                  type="text"
                  id="${idPrefix}-${index}-opt-${oIdx}"
                  value="${this.escapeHtml(optVal || '')}"
                  required
                  maxlength="${maxOpt}"
                  placeholder="Вариант ${letter}"
                  class="w-full min-w-0 bg-transparent px-1.5 py-1.5 text-amber-100 text-sm sm:text-xs focus:outline-none"
                >
                ${rawOpts.length > 2 ? `<button type="button" onclick="app.removeQuestionOptionAt('${idPrefix}', ${index}, ${oIdx})" title="Удалить этот вариант" class="w-7 h-7 sm:w-6 sm:h-6 rounded-md text-amber-200/55 hover:text-rose-300 hover:bg-rose-950/60 text-xs flex items-center justify-center shrink-0 cursor-pointer">×</button>` : ''}
              </div>
            `;
          }).join('')}
        </div>

        ${rawOpts.length < OPTION_LETTERS.length ? `
          <button type="button" onclick="app.changeQuestionOptionCount('${idPrefix}', ${index}, 1)" class="w-full py-2 sm:py-1.5 rounded-xl border border-dashed border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-500/10 text-amber-200/80 text-xs transition cursor-pointer">
            + Добавить вариант ${OPTION_LETTERS[rawOpts.length]}
          </button>
        ` : ''}
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
        correct: parseInt(document.getElementById(`${idPrefix}-correct-${i}`).value, 10) || 0
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
    const cardsHtml = Array.from({ length: count }, (_, i) =>
      this.buildQuestionCardHtml({
        idPrefix: 'owner-q',
        index: i,
        totalCount: count,
        question: draft[i] || null
      })
    ).join('');

    const addQuestionFooter = count < 30
      ? `<button type="button" onclick="app.stepOwnerQuestionCount(1)" class="w-full py-3 rounded-2xl border-2 border-dashed border-amber-500/35 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/15 text-amber-200 font-semibold text-xs sm:text-sm transition cursor-pointer">+ Добавить ещё вопрос (${count} / 30)</button>`
      : '';

    container.innerHTML = cardsHtml + addQuestionFooter;
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
        if (res.status === 401 || res.status === 403) {
          this.saveOwnerSession(null);
          this.closeCreatorModal();
          document.getElementById('lobby-edit-owner-btn')?.classList.add('hidden');
        }
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
        totalCount: 10,
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