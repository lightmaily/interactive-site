const adminApp = {
  passcode: sessionStorage.getItem('cozy_admin_pass') || '',

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
      const statusBadge =
        inv.status === 'active'
          ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">Свободен</span>'
          : inv.status === 'redeemed'
          ? '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs">Активирован (ждёт публикацию)</span>'
          : inv.status === 'completed'
          ? `<span class="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-xs">Использован: ${this.esc(inv.quizTitle || inv.quizId)}</span>`
          : '<span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs">Отозван</span>';

      return `
        <div class="p-3 rounded-2xl bg-[#140e0b] border border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <code class="font-mono text-sm font-bold text-amber-300">${this.esc(inv.code)}</code>
              ${statusBadge}
            </div>
            ${inv.note ? `<div class="text-xs text-amber-200/70">Заметка: ${this.esc(inv.note)}</div>` : ''}
          </div>
          <div class="flex items-center gap-2">
            <button type="button" onclick="adminApp.copyCode('${this.esc(inv.code)}')" class="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs cursor-pointer">
              Копировать 📋
            </button>
            ${
              inv.status !== 'revoked' && inv.status !== 'completed'
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
        action: 'generate',
        passcode: this.passcode,
        note: noteInput.value.trim()
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.toast(data.error || 'Ошибка генерации');
      return;
    }
    noteInput.value = '';
    this.toast(`Создан код: ${data.invite.code}`);
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
    if (res.ok) {
      this.toast(`Код ${code} отозван`);
      await this.loadInvites();
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

  renderAdminQuestionInputs() {
    const count = parseInt(document.getElementById('adm-q-count').value, 10) || 10;
    const container = document.getElementById('adm-questions-container');
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="p-3.5 rounded-2xl bg-[#140e0b] border border-amber-500/20 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-amber-400">Вопрос #${i + 1}</span>
            <select id="adm-q-correct-${i}" class="bg-stone-800 border border-amber-500/30 rounded px-2 py-0.5 text-xs text-amber-300">
              <option value="0">Верный: A</option>
              <option value="1">Верный: B</option>
              <option value="2">Верный: C</option>
              <option value="3">Верный: D</option>
            </select>
          </div>
          <input id="adm-q-text-${i}" type="text" required placeholder="Вопрос ${i + 1}" class="w-full px-3 py-1.5 rounded-lg bg-stone-950 border border-amber-500/20 text-amber-100 text-xs" />
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input id="adm-q-${i}-opt-0" type="text" required placeholder="Вариант A" class="px-2.5 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs" />
            <input id="adm-q-${i}-opt-1" type="text" required placeholder="Вариант B" class="px-2.5 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs" />
            <input id="adm-q-${i}-opt-2" type="text" required placeholder="Вариант C" class="px-2.5 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs" />
            <input id="adm-q-${i}-opt-3" type="text" required placeholder="Вариант D" class="px-2.5 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs" />
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  async createAdminQuiz() {
    const count = parseInt(document.getElementById('adm-q-count').value, 10) || 10;
    const questions = [];
    for (let i = 0; i < count; i++) {
      questions.push({
        q: document.getElementById(`adm-q-text-${i}`).value.trim(),
        options: [
          document.getElementById(`adm-q-${i}-opt-0`).value.trim(),
          document.getElementById(`adm-q-${i}-opt-1`).value.trim(),
          document.getElementById(`adm-q-${i}-opt-2`).value.trim(),
          document.getElementById(`adm-q-${i}-opt-3`).value.trim()
        ],
        correct: parseInt(document.getElementById(`adm-q-correct-${i}`).value, 10)
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
    this.renderAdminQuestionInputs();
    this.toast('Интерактив опубликован!');
    await this.loadQuizzes();
  }
};

document.addEventListener('DOMContentLoaded', () => adminApp.init());
