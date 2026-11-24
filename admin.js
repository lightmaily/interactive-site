const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const adminApp = {
  state: {
    passcode: '',
    defaultOptionCount: 4,
    editingQuizId: null,
    quizzes: [],
    questions: []
  },

  init() {
    sessionStorage.removeItem('cozy_admin_passcode');
    this.loadLocalQuizzes();
    this.createEmptyQuestions(10, 4);
    this.bindEvents();
  },

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  loadLocalQuizzes() {
    try {
      const raw = localStorage.getItem('cozy_quizzes');
      const parsed = raw ? JSON.parse(raw) : [];
      this.state.quizzes = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.state.quizzes = [];
    }
  },

  saveLocalQuizzes() {
    try {
      localStorage.setItem('cozy_quizzes', JSON.stringify(this.state.quizzes));
    } catch {
      // Игнорируем ошибку локального хранилища
    }
  },

  async fetchQuizzes() {
    this.loadLocalQuizzes();
    try {
      const res = await fetch('/api/quizzes', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.quizzes)) {
          this.state.quizzes = data.quizzes;
          this.saveLocalQuizzes();
        }
      }
    } catch {
      // Оставляем локальный список
    }
    this.renderExistingQuizzes();
  },

  makeQuestion(optCount) {
    const safeCount = Math.min(8, Math.max(2, Number(optCount) || 4));
    return {
      q: '',
      options: Array.from({ length: safeCount }, () => ''),
      correct: 0
    };
  },

  createEmptyQuestions(qCount, optCount) {
    const safeQ = Math.min(50, Math.max(1, Number(qCount) || 10));
    this.state.questions = Array.from({ length: safeQ }, () => this.makeQuestion(optCount));
  },

  resetFormToNew() {
    this.state.editingQuizId = null;
    document.getElementById('quiz-title').value = '';
    document.getElementById('quiz-badge').value = 'Интерактив';
    document.getElementById('quiz-desc').value = '';
    document.getElementById('question-count-input').value = 10;
    document.getElementById('default-options-input').value = 4;
    this.state.defaultOptionCount = 4;

    document.getElementById('editing-banner').classList.add('hidden');
    document.getElementById('publish-quiz-btn').textContent = 'Опубликовать интерактив';
    document.getElementById('publish-feedback').textContent = '';

    this.createEmptyQuestions(10, 4);
    this.renderQuestions();
    this.renderExistingQuizzes();
  },

  startEditingQuiz(quizId) {
    const quiz = this.state.quizzes.find((q) => q.id === quizId);
    if (!quiz) return;

    this.state.editingQuizId = quiz.id;
    document.getElementById('quiz-title').value = quiz.title || '';
    document.getElementById('quiz-badge').value = quiz.badge || 'Интерактив';
    document.getElementById('quiz-desc').value = quiz.description || '';

    const loadedQuestions = Array.isArray(quiz.questions) && quiz.questions.length > 0
      ? quiz.questions.map((item) => {
          const opts = Array.isArray(item.options) && item.options.length >= 2
            ? item.options.slice(0, 8).map((o) => String(o ?? ''))
            : ['', ''];
          const correctIdx = Number(item.correct);
          return {
            q: String(item.q ?? ''),
            options: opts,
            correct: correctIdx >= 0 && correctIdx < opts.length ? correctIdx : 0
          };
        })
      : [this.makeQuestion(4)];

    this.state.questions = loadedQuestions;
    document.getElementById('question-count-input').value = loadedQuestions.length;

    const firstOptCount = loadedQuestions[0]?.options?.length || 4;
    this.state.defaultOptionCount = firstOptCount;
    document.getElementById('default-options-input').value = firstOptCount;

    document.getElementById('editing-banner').classList.remove('hidden');
    document.getElementById('editing-quiz-label').textContent = quiz.title || quiz.id;
    document.getElementById('publish-quiz-btn').textContent = 'Сохранить изменения';
    document.getElementById('publish-feedback').textContent = '';

    this.renderQuestions();
    this.renderExistingQuizzes();
    document.getElementById('editing-banner').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  async deleteQuiz(quizId) {
    const quiz = this.state.quizzes.find((q) => q.id === quizId);
    const titleText = quiz?.title ? `«${quiz.title}»` : 'этот интерактив';
    if (!confirm(`Удалить интерактив ${titleText}?`)) return;

    const feedback = document.getElementById('publish-feedback');
    const updatedList = this.state.quizzes.filter((q) => q.id !== quizId);
    this.state.quizzes = updatedList;
    this.saveLocalQuizzes();

    if (this.state.editingQuizId === quizId) {
      this.resetFormToNew();
    } else {
      this.renderExistingQuizzes();
    }

    feedback.textContent = 'Удаляем...';

    try {
      let res = await fetch(`/api/quizzes?id=${encodeURIComponent(quizId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': this.state.passcode
        },
        body: JSON.stringify({ id: quizId, passcode: this.state.passcode })
      });

      if (!res.ok && (res.status === 404 || res.status === 405)) {
        res = await fetch('/api/quizzes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passcode: this.state.passcode,
            action: 'delete',
            deleteId: quizId,
            quizzes: updatedList
          })
        });
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (Array.isArray(data.quizzes)) {
          this.state.quizzes = data.quizzes;
          this.saveLocalQuizzes();
          this.renderExistingQuizzes();
        }
        feedback.textContent = 'Интерактив удалён.';
      } else {
        feedback.textContent = data.error || 'Удалено локально, но сервер вернул ошибку';
      }
    } catch {
      feedback.textContent = 'Удалено локально (сеть/API недоступны)';
    }
  },

  renderExistingQuizzes() {
    const listEl = document.getElementById('existing-quizzes-list');
    const countEl = document.getElementById('existing-quizzes-count');
    if (!listEl) return;

    const items = this.state.quizzes;
    if (countEl) {
      countEl.textContent = `${items.length} шт.`;
    }

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="p-4 rounded-2xl bg-[#140e0b]/80 border border-amber-500/15 text-xs text-amber-200/65 text-center">
          Интерактивов пока нет. Заполните форму ниже, чтобы создать первый.
        </div>
      `;
      return;
    }

    listEl.innerHTML = items
      .map((quiz) => {
        const isEditing = this.state.editingQuizId === quiz.id;
        const qCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;

        return `
          <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border transition ${
            isEditing
              ? 'bg-amber-500/15 border-amber-400/50'
              : 'bg-[#140e0b]/85 border-amber-500/20'
          }">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-bold text-sm text-amber-100 truncate">${this.escapeHtml(quiz.title || 'Без названия')}</span>
                <span class="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/25 text-[11px] text-amber-300">
                  ${this.escapeHtml(quiz.badge || 'Интерактив')}
                </span>
                <span class="text-xs text-amber-200/60">${qCount} вопр.</span>
              </div>
              ${
                quiz.description
                  ? `<p class="text-xs text-amber-200/65 truncate mt-0.5">${this.escapeHtml(quiz.description)}</p>`
                  : ''
              }
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-edit-id="${this.escapeHtml(quiz.id)}"
                class="edit-quiz-btn px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-xs font-semibold text-amber-200 transition cursor-pointer"
              >
                ✏️ Редактировать
              </button>
              <button
                type="button"
                data-delete-id="${this.escapeHtml(quiz.id)}"
                class="delete-quiz-btn px-3.5 py-1.5 rounded-xl bg-red-950/70 hover:bg-red-900/80 border border-red-500/40 text-xs font-semibold text-red-200 transition cursor-pointer"
              >
                🗑️ Удалить
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('.edit-quiz-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.editId;
        this.startEditingQuiz(id);
      });
    });

    listEl.querySelectorAll('.delete-quiz-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.deleteId;
        this.deleteQuiz(id);
      });
    });
  },

  setQuestionCount(newCount) {
    const safeQ = Math.min(50, Math.max(1, Number(newCount) || 1));
    document.getElementById('question-count-input').value = safeQ;

    const current = this.state.questions;
    if (safeQ > current.length) {
      const extra = Array.from({ length: safeQ - current.length }, () =>
        this.makeQuestion(this.state.defaultOptionCount)
      );
      this.state.questions = current.concat(extra);
    } else if (safeQ < current.length) {
      this.state.questions = current.slice(0, safeQ);
    }

    this.renderQuestions();
  },

  setQuestionOptionCount(qIndex, newOptCount) {
    const q = this.state.questions[qIndex];
    if (!q) return;

    const safeOpt = Math.min(8, Math.max(2, Number(newOptCount) || 2));
    if (safeOpt > q.options.length) {
      q.options = q.options.concat(Array.from({ length: safeOpt - q.options.length }, () => ''));
    } else if (safeOpt < q.options.length) {
      q.options = q.options.slice(0, safeOpt);
      if (q.correct >= safeOpt) {
        q.correct = 0;
      }
    }

    this.renderQuestions();
  },

  applyOptionCountToAll(newOptCount) {
    const safeOpt = Math.min(8, Math.max(2, Number(newOptCount) || 4));
    this.state.defaultOptionCount = safeOpt;
    document.getElementById('default-options-input').value = safeOpt;

    this.state.questions.forEach((q) => {
      if (safeOpt > q.options.length) {
        q.options = q.options.concat(Array.from({ length: safeOpt - q.options.length }, () => ''));
      } else if (safeOpt < q.options.length) {
        q.options = q.options.slice(0, safeOpt);
        if (q.correct >= safeOpt) {
          q.correct = 0;
        }
      }
    });

    this.renderQuestions();
  },

  bindEvents() {
    document.getElementById('admin-unlock-btn').addEventListener('click', () => {
      const code = document.getElementById('admin-pass-input').value.trim();
      if (code) this.unlockWithPasscode(code);
    });

    document.getElementById('admin-pass-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = e.target.value.trim();
        if (code) this.unlockWithPasscode(code);
      }
    });

    document.getElementById('cancel-edit-btn').addEventListener('click', () => {
      this.resetFormToNew();
    });

    document.getElementById('question-count-input').addEventListener('change', (e) => {
      this.setQuestionCount(e.target.value);
    });

    document.querySelectorAll('.q-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setQuestionCount(btn.dataset.qPreset);
      });
    });

    document.getElementById('default-options-input').addEventListener('change', (e) => {
      this.state.defaultOptionCount = Math.min(8, Math.max(2, Number(e.target.value) || 4));
    });

    document.getElementById('apply-options-all-btn').addEventListener('click', () => {
      const val = document.getElementById('default-options-input').value;
      this.applyOptionCountToAll(val);
    });

    document.querySelectorAll('.opt-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.applyOptionCountToAll(btn.dataset.optPreset);
      });
    });

    document.getElementById('publish-quiz-btn').addEventListener('click', () => {
      this.handlePublish();
    });
  },

  async unlockWithPasscode(passcode) {
    const statusEl = document.getElementById('auth-status');
    const btn = document.getElementById('admin-unlock-btn');
    btn.disabled = true;
    statusEl.textContent = 'Проверяем код...';

    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.authorized) {
        this.state.passcode = passcode;
        statusEl.textContent = '';
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('builder-section').classList.remove('hidden');
        this.renderQuestions();
        await this.fetchQuizzes();
      } else {
        statusEl.textContent = data.error || 'Неверный код доступа';
      }
    } catch {
      statusEl.textContent = 'Сервер недоступен.';
    } finally {
      btn.disabled = false;
    }
  },

  renderQuestions() {
    const container = document.getElementById('questions-container');
    if (!container) return;

    container.innerHTML = this.state.questions
      .map((qItem, qIdx) => {
        const optsHtml = qItem.options
          .map((optVal, optIdx) => {
            const isCorrect = qItem.correct === optIdx;
            const letter = LETTERS[optIdx] || String(optIdx + 1);

            return `
              <div class="flex items-center gap-2 p-2 rounded-xl border transition ${
                isCorrect
                  ? 'bg-emerald-950/65 border-emerald-400/60'
                  : 'bg-[#140e0b]/90 border-amber-500/20'
              }">
                <button
                  type="button"
                  data-q-idx="${qIdx}"
                  data-opt-idx="${optIdx}"
                  class="mark-correct-btn shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    isCorrect
                      ? 'bg-emerald-400 text-stone-950'
                      : 'bg-[#2a1d17] hover:bg-amber-500/25 text-amber-200 border border-amber-500/25'
                  }"
                  title="Кликните, чтобы сделать вариант ${letter} правильным"
                >
                  ${isCorrect ? `✓ ${letter}` : letter}
                </button>
                <input
                  type="text"
                  data-q-idx="${qIdx}"
                  data-opt-idx="${optIdx}"
                  value="${this.escapeHtml(optVal)}"
                  maxlength="120"
                  placeholder="Текст варианта ${letter}"
                  class="opt-input flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-[#1d1410] border border-amber-500/20 text-xs sm:text-sm text-amber-100 placeholder-amber-200/40 focus:outline-none focus:border-amber-400"
                />
              </div>
            `;
          })
          .join('');

        return `
          <article class="bg-[#1b120e]/90 border border-amber-500/25 rounded-3xl p-5 space-y-3 shadow-lg">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <span class="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-bold">
                  #${qIdx + 1}
                </span>
                <span class="text-xs text-amber-200/75">
                  Верный ответ: <strong class="text-emerald-300">${LETTERS[qItem.correct] || 'A'}</strong>
                </span>
              </div>

              <label class="flex items-center gap-2 text-xs text-amber-200/75">
                <span>Ответов в вопросе:</span>
                <input
                  type="number"
                  min="2"
                  max="8"
                  value="${qItem.options.length}"
                  data-q-idx="${qIdx}"
                  class="q-opt-count-input w-16 px-2 py-1 rounded-lg bg-[#140e0b] border border-amber-500/25 text-center text-amber-200 font-semibold"
                />
              </label>
            </div>

            <input
              type="text"
              data-q-idx="${qIdx}"
              value="${this.escapeHtml(qItem.q)}"
              maxlength="220"
              placeholder="Введите текст вопроса ${qIdx + 1}..."
              class="q-text-input w-full px-3.5 py-2.5 rounded-xl bg-[#140e0b] border border-amber-500/20 text-sm text-amber-100 placeholder-amber-200/40 focus:outline-none focus:border-amber-400"
            />

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              ${optsHtml}
            </div>
          </article>
        `;
      })
      .join('');

    container.querySelectorAll('.q-text-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const qIdx = Number(e.target.dataset.qIdx);
        this.state.questions[qIdx].q = e.target.value;
      });
    });

    container.querySelectorAll('.opt-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const qIdx = Number(e.target.dataset.qIdx);
        const optIdx = Number(e.target.dataset.optIdx);
        this.state.questions[qIdx].options[optIdx] = e.target.value;
      });
    });

    container.querySelectorAll('.mark-correct-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const qIdx = Number(e.currentTarget.dataset.qIdx);
        const optIdx = Number(e.currentTarget.dataset.optIdx);
        this.state.questions[qIdx].correct = optIdx;
        this.renderQuestions();
      });
    });

    container.querySelectorAll('.q-opt-count-input').forEach((input) => {
      input.addEventListener('change', (e) => {
        const qIdx = Number(e.target.dataset.qIdx);
        this.setQuestionOptionCount(qIdx, e.target.value);
      });
    });
  },

  async handlePublish() {
    const feedback = document.getElementById('publish-feedback');
    const title = document.getElementById('quiz-title').value.trim();
    const badge = document.getElementById('quiz-badge').value.trim() || 'Интерактив';
    const description = document.getElementById('quiz-desc').value.trim();

    if (!title) {
      feedback.textContent = 'Укажите название интерактива';
      return;
    }

    const cleanedQuestions = this.state.questions.map((item) => ({
      q: item.q.trim(),
      options: item.options.map((o) => o.trim()),
      correct: item.correct
    }));

    const hasIncomplete = cleanedQuestions.some(
      (item) => !item.q || item.options.some((o) => !o)
    );
    if (hasIncomplete) {
      feedback.textContent = 'Заполните текст всех вопросов и всех вариантов ответа';
      return;
    }

    const isEditing = Boolean(this.state.editingQuizId);
    const targetId = this.state.editingQuizId || ('quiz-' + Date.now());

    const quizPayload = {
      id: targetId,
      title,
      badge,
      description,
      questions: cleanedQuestions
    };

    const existingIdx = this.state.quizzes.findIndex((q) => q.id === targetId);
    if (existingIdx !== -1) {
      this.state.quizzes[existingIdx] = quizPayload;
    } else {
      this.state.quizzes.unshift(quizPayload);
    }
    this.saveLocalQuizzes();
    this.renderExistingQuizzes();

    feedback.textContent = isEditing ? 'Сохраняем изменения...' : 'Публикуем...';

    try {
      const res = await fetch('/api/quizzes', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode: this.state.passcode,
          action: isEditing ? 'update' : 'create',
          quiz: quizPayload,
          quizzes: this.state.quizzes
        })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        if (Array.isArray(data.quizzes)) {
          this.state.quizzes = data.quizzes;
          this.saveLocalQuizzes();
          this.renderExistingQuizzes();
        }
        feedback.textContent = isEditing
          ? 'Изменения сохранены!'
          : 'Опубликовано! Можно открыть главную страницу.';
      } else {
        feedback.textContent = data.error || 'Сохранено локально, но сервер вернул ошибку';
      }
    } catch {
      feedback.textContent = 'Сохранено локально (сеть/API недоступны)';
    }
  }
};

window.addEventListener('DOMContentLoaded', () => adminApp.init());