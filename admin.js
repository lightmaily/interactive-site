const adminApp = {
  passcode: sessionStorage.getItem('cozy_admin_pass') || '',
  _optionLetters: ['A', 'B', 'C', 'D', 'E', 'F'],

  init() {
    document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = document.getElementById('admin-passcode-input').value.trim();
      await this.login(val);
    });

    document.getElementById('generate-invite-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.generateInvite();
    });

    document.getElementById('admin-create-quiz-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.createAdminQuiz();
    });

    this.renderAdminQuestionInputs();

    if (this.passcode) {
      this.login(this.passcode, true);
    }
  },

  toast(msg) {
    const el = document.getElementById('admin-toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
  },

  esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  async login(pass, silent = false) {
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: pass })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.authorized) {
        if (!silent) this.toast(data.error || 'Неверный пароль');
        sessionStorage.removeItem('cozy_admin_pass');
        return;
      }
      this.passcode = pass;
      sessionStorage.setItem('cozy_admin_pass', pass);
      document.getElementById('auth-box').classList.add('hidden');
      document.getElementById('admin-dashboard').classList.remove('hidden');
      document.getElementById('admin-logout-btn').classList.remove('hidden');
      if (data.storage) {
        document.getElementById('storage-status-text').textContent = data.storage.driver;
      }
      await this.refreshAll();
    } catch {
      if (!silent) this.toast('Ошибка сети при входе');
    }
  },

  logout() {
    this.passcode = '';
    sessionStorage.removeItem('cozy_admin_pass');
    document.getElementById('auth-box').classList.remove('hidden');
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('admin-logout-btn').classList.add('hidden');
  },

  async refreshAll() {
    await Promise.all([this.loadInvites(), this.loadQuizzes()]);
  },

  async loadInvites() {
    const res = await fetch(`/api/invites?passcode=${encodeURIComponent(this.passcode)}`);
    const data = await res.json().catch(() => ({}));
    const list = Array.isArray(data.invites) ? data.invites : [];
    const container = document.getElementById('invites-list');

    if (list.length === 0) {
      container.innerHTML = '<p class="text-xs text-amber-200/60">Инвайт-кодов пока нет. Сгенерируйте первый выше.</p>';
      return;
    }

    container.innerHTML = list.map(inv => {
      const who = inv.usedBy || inv.redeemedBy;
      const whoText = who ? ` (${this.esc(who)})` : '';

      let statusBadge = '<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">Свободен</span>';
      if (inv.revoked || inv.status === 'revoked') {
        statusBadge = '<span class="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs">Отозван</span>';
      } else if (inv.status === 'completed' || inv.quizId) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs">Использован${whoText}</span>`;
      } else if (inv.status === 'redeemed' || inv.ownerTokenHash) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-xs">Активирован${whoText}</span>`;
      }

      const canRevoke = inv.status !== 'revoked' && !inv.revoked && inv.status !== 'completed';

      return `
        <div class="p-3 rounded-2xl bg-[#140e0b] border border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-0.5">
            <div class="flex flex-wrap items-center gap-2">
              <code class="font-mono text-sm font-bold text-amber-300">${this.esc(inv.code)}</code>
              ${statusBadge}
            </div>
            ${inv.note ? `<div class="text-xs text-amber-200/70">Заметка: ${this.esc(inv.note)}</div>` : ''}
            ${inv.quizTitle ? `<div class="text-xs text-amber-200/55">Квиз: ${this.esc(inv.quizTitle)}</div>` : ''}
          </div>
          <div class="flex items-center gap-2">
            <button type="button" onclick="adminApp.copyCode('${this.esc(inv.code)}')" class="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs cursor-pointer">
              Копировать 📋
            </button>
            ${
              canRevoke
                ? `<button type="button" onclick="adminApp.revokeInvite('${this.esc(inv.code)}')" class="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-200 text-xs cursor-pointer">Отозвать</button>`
                : ''
            }
          </div>
        </div>
      `;
    }).join('');
  },

  copyCode(code) {
    navigator.clipboard.writeText(code).then(() => this.toast(`Код ${code} скопирован!`));
  },

  async generateInvite() {
    const noteInput = document.getElementById('invite-note-input');
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        passcode: this.passcode,
        note: noteInput.value.trim()
      })
    });
    const data = await res.json().catch(() => ({}));
    const createdCode = data.code || data.invite?.code;
    if (!res.ok || !createdCode) {
      this.toast(data.error || 'Ошибка генерации');
      return;
    }
    noteInput.value = '';
    this.toast(`Создан код: ${createdCode}`);
    await this.loadInvites();
  },

  async revokeInvite(code) {
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'revoke',
        passcode: this.passcode,
        code
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      this.toast(`Код ${code} отозван`);
      await this.loadInvites();
    } else {
      this.toast(data.error || 'Не удалось отозвать код');
    }
  },

  async loadQuizzes() {
    const res = await fetch(`/api/quizzes?includeHidden=1&passcode=${encodeURIComponent(this.passcode)}`);
    const data = await res.json().catch(() => ({}));
    if (data.storage) {
      document.getElementById('storage-status-text').textContent = data.storage.driver;
    }
    const quizzes = Array.isArray(data.quizzes) ? data.quizzes : [];
    const container = document.getElementById('admin-quizzes-list');

    if (quizzes.length === 0) {
      container.innerHTML = '<p class="text-xs text-amber-200/60">На сервере пока нет сохранённых интерактивов.</p>';
      return;
    }

    container.innerHTML = quizzes.map(q => `
      <div class="p-4 rounded-2xl bg-[#140e0b] border ${q.hidden ? 'border-rose-500/30 opacity-75' : 'border-amber-500/20'} flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold text-amber-100">${this.esc(q.title)}</span>
            <span class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-xs">${this.esc(q.badge)}</span>
            ${q.hidden ? '<span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs">Скрыт (архив)</span>' : ''}
            ${q.inviteCode ? `<span class="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 text-xs font-mono">Код: ${this.esc(q.inviteCode)}</span>` : ''}
          </div>
          <div class="text-xs text-amber-200/65">
            Автор: ${this.esc(q.author || 'Iakov')} • Вопросов: ${(q.questions || []).length} • Ссылка: /quiz/${this.esc(q.id)}
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <a href="/quiz/${this.esc(q.id)}" target="_blank" class="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs">
            Открыть ↗
          </a>
          <button type="button" onclick="adminApp.toggleHideQuiz('${this.esc(q.id)}', ${!q.hidden})" class="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 text-xs cursor-pointer">
            ${q.hidden ? 'Показать 👁️' : 'Скрыть 🙈'}
          </button>
          <button type="button" onclick="adminApp.resetLeaderboard('${this.esc(q.id)}')" class="px-3 py-1.5 rounded-xl bg-sky-950/70 hover:bg-sky-900 text-sky-200 text-xs cursor-pointer">
            Сбросить рекорды
          </button>
          <button type="button" onclick="adminApp.deleteQuiz('${this.esc(q.id)}')" class="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-200 text-xs cursor-pointer">
            Удалить 🗑️
          </button>
        </div>
      </div>
    `).join('');
  },

  async toggleHideQuiz(quizId, hidden) {
    const res = await fetch('/api/quizzes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: this.passcode, quizId, hidden })
    });
    if (res.ok) {
      this.toast(hidden ? 'Интерактив скрыт в архив' : 'Интерактив снова виден на главной');
      await this.loadQuizzes();
    }
  },

  async resetLeaderboard(quizId) {
    if (!confirm('Очистить таблицу лидеров для этого интерактива?')) return;
    const res = await fetch('/api/leaderboard', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: this.passcode, quizId })
    });
    if (res.ok) {
      this.toast('Таблица лидеров очищена');
    }
  },

  async deleteQuiz(quizId) {
    if (!confirm('Удалить интерактив навсегда?')) return;
    const res = await fetch('/api/quizzes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: this.passcode, quizId })
    });
    if (res.ok) {
      this.toast('Интерактив удалён');
      await this.loadQuizzes();
    }
  },

  toggleNewQuizForm() {
    document.getElementById('admin-create-quiz-form').classList.toggle('hidden');
  },

  _collectAdmDraft() {
    const draft = [];
    for (let i = 0; i < 30; i++) {
      const qEl = document.getElementById(`adm-q-text-${i}`);
      if (!qEl) break;
      const options = [];
      for (let oIdx = 0; oIdx < this._optionLetters.length; oIdx++) {
        const optEl = document.getElementById(`adm-q-${i}-opt-${oIdx}`);
        if (!optEl) break;
        options.push(optEl.value);
      }
      const corrEl = document.getElementById(`adm-q-correct-${i}`);
      const rawCorr = corrEl ? parseInt(corrEl.value, 10) : 0;
      const safeOpts = options.length >= 2 ? options : ['', '', '', ''];
      draft.push({
        q: qEl.value,
        options: safeOpts,
        correct: Number.isNaN(rawCorr) ? 0 : Math.min(Math.max(0, rawCorr), safeOpts.length - 1)
      });
    }
    return draft;
  },

  selectAdmCorrect(qIndex, optIndex) {
    const hidden = document.getElementById(`adm-q-correct-${qIndex}`);
    if (hidden) hidden.value = String(optIndex);

    for (let oIdx = 0; oIdx < this._optionLetters.length; oIdx++) {
      const row = document.getElementById(`adm-q-${qIndex}-row-${oIdx}`);
      const btn = document.getElementById(`adm-q-${qIndex}-pick-${oIdx}`);
      if (!row || !btn) break;

      const isSelected = oIdx === optIndex;
      row.className = `flex items-center gap-1.5 p-1.5 rounded-xl border transition ${
        isSelected
          ? 'bg-emerald-950/55 border-emerald-400/70'
          : 'bg-stone-950/90 border-amber-500/15 hover:border-amber-500/35'
      }`;
      btn.className = `w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 transition cursor-pointer ${
        isSelected ? 'bg-emerald-500 text-stone-950' : 'bg-stone-800 hover:bg-amber-500/25 text-amber-300 border border-amber-500/25'
      }`;
      btn.textContent = isSelected ? `✓ ${this._optionLetters[oIdx]}` : this._optionLetters[oIdx];
    }
  },

  setAdmOptionCount(qIndex, targetCount) {
    const draft = this._collectAdmDraft();
    const target = draft[qIndex];
    if (!target) return;

    const clamped = Math.max(2, Math.min(this._optionLetters.length, targetCount));
    while (target.options.length < clamped) target.options.push('');
    if (target.options.length > clamped) {
      target.options.length = clamped;
      if (target.correct >= clamped) target.correct = clamped - 1;
    }
    this.renderAdminQuestionInputs(draft);
  },

  removeAdmOptionAt(qIndex, optIndex) {
    const draft = this._collectAdmDraft();
    const target = draft[qIndex];
    if (!target || target.options.length <= 2) {
      this.toast('Минимум 2 варианта ответа');
      return;
    }
    target.options.splice(optIndex, 1);
    if (target.correct === optIndex) target.correct = 0;
    else if (target.correct > optIndex) target.correct -= 1;
    this.renderAdminQuestionInputs(draft);
  },

  changeAdmOptionCount(qIndex, delta) {
    const draft = this._collectAdmDraft();
    const target = draft[qIndex];
    if (!target) return;
    this.setAdmOptionCount(qIndex, target.options.length + delta);
  },

  renderAdminQuestionInputs(prefill = null) {
    const count = parseInt(document.getElementById('adm-q-count').value, 10) || 10;
    const container = document.getElementById('adm-questions-container');
    const draft = Array.isArray(prefill) ? prefill : this._collectAdmDraft();

    let html = '';
    for (let i = 0; i < count; i++) {
      const item = draft[i] || null;
      const rawOpts = Array.isArray(item?.options) && item.options.length >= 2
        ? item.options.slice(0, this._optionLetters.length)
        : ['', '', '', ''];
      const rawCorr = item ? Number(item.correct) : 0;
      const correct = Number.isNaN(rawCorr) ? 0 : Math.min(Math.max(0, rawCorr), rawOpts.length - 1);

      const countChips = [2, 3, 4, 5, 6].map(num => `
        <button type="button" onclick="adminApp.setAdmOptionCount(${i}, ${num})" class="w-6 h-6 rounded-md text-[11px] font-bold transition cursor-pointer ${
          rawOpts.length === num ? 'bg-amber-400 text-stone-950' : 'bg-stone-800 hover:bg-stone-700 text-amber-200/80'
        }">${num}</button>
      `).join('');

      html += `
        <div class="p-3.5 rounded-2xl bg-[#140e0b] border border-amber-500/20 space-y-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-bold text-amber-400">Вопрос #${i + 1}</span>
            <div class="inline-flex items-center gap-1 bg-stone-950 border border-amber-500/20 rounded-lg p-0.5">
              <span class="text-[10px] text-amber-200/60 px-1.5">Ответов:</span>
              ${countChips}
            </div>
          </div>
          <input type="hidden" id="adm-q-correct-${i}" value="${correct}" />
          <input id="adm-q-text-${i}" type="text" value="${this.esc(item?.q || '')}" required placeholder="Вопрос ${i + 1}" class="w-full px-3 py-1.5 rounded-lg bg-stone-950 border border-amber-500/20 text-amber-100 text-xs" />
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${rawOpts.map((optVal, oIdx) => {
              const isSelected = correct === oIdx;
              const letter = this._optionLetters[oIdx];
              return `
                <div id="adm-q-${i}-row-${oIdx}" class="flex items-center gap-1.5 p-1.5 rounded-xl border transition ${
                  isSelected
                    ? 'bg-emerald-950/55 border-emerald-400/70'
                    : 'bg-stone-950/90 border-amber-500/15 hover:border-amber-500/35'
                }">
                  <button type="button" id="adm-q-${i}-pick-${oIdx}" onclick="adminApp.selectAdmCorrect(${i}, ${oIdx})" class="w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 transition cursor-pointer ${
                    isSelected ? 'bg-emerald-500 text-stone-950' : 'bg-stone-800 hover:bg-amber-500/25 text-amber-300 border border-amber-500/25'
                  }">${isSelected ? `✓ ${letter}` : letter}</button>
                  <input id="adm-q-${i}-opt-${oIdx}" type="text" value="${this.esc(optVal || '')}" required placeholder="Вариант ${letter}" class="w-full min-w-0 bg-transparent px-1.5 py-1 text-amber-100 text-xs focus:outline-none" />
                  ${rawOpts.length > 2 ? `<button type="button" onclick="adminApp.removeAdmOptionAt(${i}, ${oIdx})" class="w-6 h-6 rounded-md text-amber-200/45 hover:text-rose-300 text-xs shrink-0 cursor-pointer">×</button>` : ''}
                </div>
              `;
            }).join('')}
          </div>
          ${rawOpts.length < this._optionLetters.length ? `
            <button type="button" onclick="adminApp.changeAdmOptionCount(${i}, 1)" class="w-full py-1 rounded-xl border border-dashed border-amber-500/25 hover:border-amber-400/60 text-amber-200/75 text-xs cursor-pointer">
              + Добавить вариант ${this._optionLetters[rawOpts.length]}
            </button>
          ` : ''}
        </div>
      `;
    }
    container.innerHTML = html;
  },

  async createAdminQuiz() {
    const count = parseInt(document.getElementById('adm-q-count').value, 10) || 10;
    const questions = [];
    for (let i = 0; i < count; i++) {
      const options = [];
      for (let oIdx = 0; oIdx < this._optionLetters.length; oIdx++) {
        const optEl = document.getElementById(`adm-q-${i}-opt-${oIdx}`);
        if (!optEl) break;
        options.push(optEl.value.trim());
      }
      questions.push({
        q: document.getElementById(`adm-q-text-${i}`).value.trim(),
        options,
        correct: parseInt(document.getElementById(`adm-q-correct-${i}`).value, 10) || 0
      });
    }

    const res = await fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passcode: this.passcode,
        quiz: {
          title: document.getElementById('adm-q-title').value.trim(),
          badge: document.getElementById('adm-q-badge').value,
          author: 'Iakov',
          description: document.getElementById('adm-q-desc').value.trim(),
          questions
        }
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.toast(data.error || 'Ошибка создания');
      return;
    }
    document.getElementById('admin-create-quiz-form').reset();
    this.renderAdminQuestionInputs([]);
    this.toast('Интерактив опубликован!');
    await this.loadQuizzes();
  }
};

document.addEventListener('DOMContentLoaded', () => adminApp.init());