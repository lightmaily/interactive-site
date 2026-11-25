const app = {
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
    playMode: 'relaxed', // 'relaxed' | 'speed'
    quizStartTimeMs: null,
    quizElapsedSec: 0,
    timerIntervalId: null,
    homeSearch: '',
    homeTagFilter: 'ALL',
    ownerSession: null, // { code, ownerToken, ownedQuizId }
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

  renderJourneyMap() {
    const total = this.state.activeQuiz ? this.state.activeQuiz.questions.length : 10;
    const svg = document.getElementById('journey-map-svg');
    const hillsLayer = document.getElementById('map-hills-layer');
    const masksLayer = document.getElementById('map-masks-layer');
    const guidesLayer = document.getElementById('map-guides-layer');
    const pathsLayer = document.getElementById('map-paths-layer');
    const nodesLayer = document.getElementById('map-nodes-layer');
    const traveler = document.getElementById('map-traveler');

    const isMobile = window.innerWidth < 768;
    const vbW = isMobile ? 420 : 1200;
    const vbH = isMobile ? 560 : 460;
    svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);

    const skyRect = svg.querySelector('rect');
    if (skyRect) {
      skyRect.setAttribute('width', String(vbW));
      skyRect.setAttribute('height', String(vbH));
    }

    const starsLayer = document.getElementById('map-stars-layer');
    const mountainsLayer = document.getElementById('map-mountains-layer');

    if (isMobile) {
      if (starsLayer) {
        starsLayer.innerHTML = `
          <circle cx="55" cy="48" r="2" fill="#fde68a" class="winter-star" />
          <circle cx="155" cy="34" r="1.7" fill="#fef3c7" class="winter-star" style="animation-delay:0.7s" />
          <circle cx="265" cy="56" r="2.1" fill="#fde047" class="winter-star" style="animation-delay:1.3s" />
          <circle cx="365" cy="42" r="1.8" fill="#fef9c3" class="winter-star" style="animation-delay:0.4s" />
        `;
      }
      if (mountainsLayer) {
        mountainsLayer.innerHTML = `
          <polygon points="-20,335 105,195 235,335" fill="url(#mountainPeakFar)" opacity="0.72" />
          <polygon points="105,195 72,228 94,238 105,226 122,238 142,226" fill="url(#snowCapGrad)" />
          <polygon points="155,340 295,175 445,340" fill="url(#mountainPeakNear)" opacity="0.78" />
          <polygon points="295,175 256,212 278,222 295,208 315,222 336,210" fill="url(#snowCapGrad)" />
        `;
      }
      hillsLayer.innerHTML = `
        <path d="M 0 345 Q 140 285, 420 330 L 420 560 L 0 560 Z" fill="url(#hillBack)" />
        <path d="M 0 435 Q 220 385, 420 425 L 420 560 L 0 560 Z" fill="url(#hillFront)" />
      `;
    } else {
      if (starsLayer) {
        starsLayer.innerHTML = `
          <circle cx="150" cy="64" r="2.2" fill="#fde68a" class="winter-star" />
          <circle cx="340" cy="48" r="1.8" fill="#fef3c7" class="winter-star" style="animation-delay:0.7s" />
          <circle cx="520" cy="74" r="2.4" fill="#fde047" class="winter-star" style="animation-delay:1.3s" />
          <circle cx="690" cy="42" r="2" fill="#fef9c3" class="winter-star" style="animation-delay:0.4s" />
          <circle cx="860" cy="68" r="2.3" fill="#fde68a" class="winter-star" style="animation-delay:1.9s" />
        `;
      }
      if (mountainsLayer) {
        mountainsLayer.innerHTML = `
          <polygon points="80,255 270,92 475,255" fill="url(#mountainPeakFar)" opacity="0.78" />
          <polygon points="270,92 225,132 252,144 270,130 292,145 316,130" fill="url(#snowCapGrad)" />
          <polygon points="360,255 585,78 825,255" fill="url(#mountainPeakNear)" opacity="0.82" />
          <polygon points="585,78 532,122 562,135 585,118 612,136 640,120" fill="url(#snowCapGrad)" />
          <polygon points="690,255 895,104 1125,255" fill="url(#mountainPeakFar)" opacity="0.76" />
          <polygon points="895,104 850,140 876,152 895,136 918,153 942,138" fill="url(#snowCapGrad)" />
        `;
      }
      hillsLayer.innerHTML = `
        <path d="M 0 300 Q 260 180, 580 275 T 1200 210 L 1200 460 L 0 460 Z" fill="url(#hillBack)" />
        <path d="M 0 385 Q 360 300, 750 375 T 1200 320 L 1200 460 L 0 460 Z" fill="url(#hillFront)" />
      `;
    }

    const waypoints = (() => {
      const pts = [];
      for (let s = 0; s <= total; s++) {
        const t = total > 0 ? s / total : 0;
        if (isMobile) {
          if (s === 0) {
            pts.push({ main: { x: 210, y: 505 }, detour: { x: 210, y: 505 } });
          } else if (s === total) {
            pts.push({ main: { x: 210, y: 75 }, detour: { x: 210, y: 75 } });
          } else {
            const y = Math.round(505 - t * 430);
            const zig = s % 2 === 1 ? -55 : 50;
            const mainX = 210 + zig;
            const detourX = s % 2 === 1 ? 318 : 102;
            pts.push({ main: { x: mainX, y }, detour: { x: detourX, y: y + 5 } });
          }
        } else {
          if (s === 0) {
            pts.push({ main: { x: 85, y: 360 }, detour: { x: 85, y: 360 } });
          } else if (s === total) {
            pts.push({ main: { x: 1130, y: 105 }, detour: { x: 1130, y: 105 } });
          } else {
            const x = Math.round(85 + t * 1045);
            const wave = Math.sin(t * Math.PI * 3.2) * 42;
            const mainY = Math.round(335 - t * 215 - wave);
            const detourY = Math.min(415, mainY + 145);
            pts.push({ main: { x, y: mainY }, detour: { x: x - 10, y: detourY } });
          }
        }
      }
      return pts;
    })();

    const getCoords = (step, lane) => {
      const safeIdx = Math.min(step, waypoints.length - 1);
      return lane === 'detour' ? waypoints[safeIdx].detour : waypoints[safeIdx].main;
    };

    const buildCurveD = (p1, p2, lane) => {
      const isDetour = lane === 'detour';
      let ctrlX, ctrlY;
      if (isMobile) {
        ctrlX = isDetour ? (p2.x > 210 ? p2.x + 26 : p2.x - 26) : (p1.x + p2.x) / 2;
        ctrlY = (p1.y + p2.y) / 2;
      } else {
        ctrlX = (p1.x + p2.x) / 2;
        ctrlY = isDetour ? Math.max(p1.y, p2.y) + 22 : Math.min(p1.y, p2.y) - 22;
      }
      return `M ${p1.x} ${p1.y} Q ${ctrlX} ${ctrlY}, ${p2.x} ${p2.y}`;
    };

    const currentStepIndex = this.state.routeHistory.length - 1;
    const latestNode = this.state.routeHistory[currentStepIndex];
    const currentPos = getCoords(latestNode.step, latestNode.lane);

    if (latestNode.step < total) {
      const nextStep = latestNode.step + 1;
      const nextMainPos = getCoords(nextStep, 'main');
      const nextDetourPos = getCoords(nextStep, 'detour');

      const mainBranchD = buildCurveD(currentPos, nextMainPos, 'main');
      const detourBranchD = buildCurveD(currentPos, nextDetourPos, 'detour');

      masksLayer.innerHTML = `
        <mask id="mask-branch-main">
          <path d="${mainBranchD}" fill="none" stroke="white" stroke-width="14" class="js-animated-stroke branch-sprout" />
        </mask>
        <mask id="mask-branch-detour">
          <path d="${detourBranchD}" fill="none" stroke="white" stroke-width="14" class="js-animated-stroke branch-sprout" />
        </mask>
      `;

      guidesLayer.innerHTML = `
        <path d="${detourBranchD}" mask="url(#mask-branch-detour)" fill="none" stroke="rgba(56, 189, 248, 0.6)" stroke-width="4" stroke-dasharray="7 7" stroke-linecap="round" />
        <path d="${mainBranchD}" mask="url(#mask-branch-main)" fill="none" stroke="rgba(251, 191, 36, 0.7)" stroke-width="4.5" stroke-dasharray="8 7" stroke-linecap="round" />
      `;
    } else {
      masksLayer.innerHTML = '';
      guidesLayer.innerHTML = '';
    }

    let pathsHtml = '';
    for (let i = 1; i < this.state.routeHistory.length; i++) {
      const prev = getCoords(this.state.routeHistory[i - 1].step, this.state.routeHistory[i - 1].lane);
      const curr = getCoords(this.state.routeHistory[i].step, this.state.routeHistory[i].lane);
      const lane = this.state.routeHistory[i].lane;
      const strokeColor = lane === 'detour' ? '#38bdf8' : '#fbbf24';
      const curveD = buildCurveD(prev, curr, lane);
      const isNewestSegment = i === this.state.routeHistory.length - 1;

      pathsHtml += `
        <path d="${curveD}"
              ${isNewestSegment ? 'class="js-animated-stroke path-draw-active"' : ''}
              fill="none" stroke="${strokeColor}" stroke-width="6.5" stroke-linecap="round" />
      `;
    }
    pathsLayer.innerHTML = pathsHtml;

    svg.querySelectorAll('.js-animated-stroke').forEach(pathEl => {
      const len = pathEl.getTotalLength();
      pathEl.style.strokeDasharray = `${len}`;
      pathEl.style.strokeDashoffset = `${len}`;
    });

    let nodesHtml = '';
    const nodeR = isMobile ? 13 : 14;
    const nextCandidateStep = latestNode.step + 1;

    for (let s = 0; s <= total; s++) {
      const label = s === 0 ? '★' : String(s);
      const historyPoint = this.state.routeHistory.find(h => h.step === s);

      if (historyPoint) {
        const pos = getCoords(s, historyPoint.lane);
        const fill = historyPoint.lane === 'detour' ? '#38bdf8' : '#fbbf24';
        nodesHtml += `
          <circle cx="${pos.x}" cy="${pos.y}" r="${nodeR}" fill="${fill}" stroke="#1c120d" stroke-width="3.5" />
          <text x="${pos.x}" y="${pos.y + 4.5}" text-anchor="middle" fill="#1c120d" font-size="12" font-weight="bold">${label}</text>
        `;
      } else if (s === nextCandidateStep) {
        const mainPos = getCoords(s, 'main');
        const detourPos = getCoords(s, 'detour');
        nodesHtml += `
          <circle cx="${mainPos.x}" cy="${mainPos.y}" r="${nodeR - 1}" fill="#292524" stroke="#fbbf24" stroke-width="2.5" />
          <text x="${mainPos.x}" y="${mainPos.y + 4}" text-anchor="middle" fill="#fef3c7" font-size="11" font-weight="700">${label}</text>
          <circle cx="${detourPos.x}" cy="${detourPos.y}" r="${nodeR - 3}" fill="#1e293b" stroke="#38bdf8" stroke-width="2.5" />
          <text x="${detourPos.x}" y="${detourPos.y + 3.5}" text-anchor="middle" fill="#bae6fd" font-size="10" font-weight="600">${label}</text>
        `;
      } else {
        const mainPos = getCoords(s, 'main');
        nodesHtml += `
          <circle cx="${mainPos.x}" cy="${mainPos.y}" r="${nodeR - 3}" fill="#292524" stroke="#f59e0b" stroke-width="2" opacity="0.7" />
          <text x="${mainPos.x}" y="${mainPos.y + 3.5}" text-anchor="middle" fill="#fef3c7" font-size="10" font-weight="700" opacity="0.85">${label}</text>
        `;
      }
    }
    nodesLayer.innerHTML = nodesHtml;

    traveler.style.left = `${(currentPos.x / vbW) * 100}%`;
    traveler.style.top = `${(currentPos.y / vbH) * 100}%`;
  },

  getQuizIdFromUrl() {
    try {
      const pathMatch = window.location.pathname.match(/^\/quiz\/([^/]+)\/?$/);
      if (pathMatch && pathMatch[1]) {
        return decodeURIComponent(pathMatch[1]);
      }
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get('quiz');
      if (queryId) {
        return queryId.trim();
      }
    } catch {
      // ignore URL parsing errors
    }
    return null;
  },

  getQuizUrl(quizId) {
    return `${window.location.origin}/quiz/${encodeURIComponent(quizId)}`;
  },

  syncUrlForHome(replace = false) {
    if (window.location.pathname !== '/' || window.location.search) {
      const method = replace ? 'replaceState' : 'pushState';
      history[method]({ view: 'home' }, '', '/');
    }
    document.title = 'Уютные интерактивы';
  },

  syncUrlForQuiz(quizId, replace = false) {
    const targetPath = `/quiz/${encodeURIComponent(quizId)}`;
    if (window.location.pathname !== targetPath || window.location.search) {
      const method = replace ? 'replaceState' : 'pushState';
      history[method]({ view: 'quiz-page', quizId }, '', targetPath);
    }
  },

  async copyQuizLink(quizId = null) {
    const id = quizId || (this.state.activeQuiz && this.state.activeQuiz.id);
    if (!id) return;
    const url = this.getQuizUrl(id);
    try {
      await navigator.clipboard.writeText(url);
      this.showToast('Ссылка на страницу интерактива скопирована!', '🔗');
    } catch {
      window.prompt('Скопируйте ссылку на интерактив:', url);
    }
  },

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
    if (session) {
      localStorage.setItem('cozy_owner_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('cozy_owner_session');
    }
    this.updateInviteNavButton();
  },

  updateInviteNavButton() {
    const btn = document.getElementById('nav-invite-action-btn');
    if (!btn) return;
    const sess = this.state.ownerSession;
    if (sess && sess.ownerToken) {
      if (sess.ownedQuizId) {
        btn.textContent = '✏️ Мой интерактив';
      } else {
        btn.textContent = '✨ Создать свой квиз';
      }
    } else {
      btn.textContent = '🎟️ Ввести код';
    }
  },

  handleInviteNavClick() {
    const sess = this.state.ownerSession;
    if (sess && sess.ownerToken) {
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
    const modal = document.getElementById('invite-modal');
    if (modal) modal.classList.add('hidden');
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
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redeem', code })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ownerToken) {
        this.showToast(data.error || 'Не удалось активировать код', '🔒');
        return;
      }

      this.saveOwnerSession({
        code: data.code || code,
        ownerToken: data.ownerToken,
        ownedQuizId: null
      });

      this.closeInviteModal();
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

  openCreateOwnedQuiz() {
    const sess = this.state.ownerSession;
    if (!sess || !sess.ownerToken) {
      this.openInviteModal();
      return;
    }
    if (sess.ownedQuizId) {
      this.showToast('Лимит кода: 1 интерактив. Вы можете редактировать уже созданный!', 'ℹ️');
      this.openEditOwnedQuiz();
      return;
    }

    this.state.editingQuizId = null;
    document.getElementById('creator-mode-badge').textContent = `🎟️ Код ${sess.code} • Создание (1 из 1)`;
    document.getElementById('creator-modal-title').textContent = 'Создать свой интерактив';
    document.getElementById('owner-quiz-save-btn').textContent = 'Опубликовать интерактив ✨';
    document.getElementById('owner-quiz-form').reset();
    document.getElementById('owner-quiz-author').value = this.state.username || '';
    document.getElementById('owner-quiz-count').value = '10';
    document.getElementById('owner-quiz-count').disabled = false;
    this.renderOwnerQuestionInputs();
    document.getElementById('creator-modal').classList.remove('hidden');
  },

  openEditOwnedQuiz() {
    const sess = this.state.ownerSession;
    const quiz = this.state.activeQuiz || (sess && this.state.quizzes.find(q => q.id === sess.ownedQuizId));
    if (!sess || !sess.ownerToken || !quiz || sess.ownedQuizId !== quiz.id) {
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

    const countSelect = document.getElementById('owner-quiz-count');
    const qLen = Array.isArray(quiz.questions) ? quiz.questions.length : 10;
    if (![5, 8, 10, 12, 15].includes(qLen)) {
      const opt = document.createElement('option');
      opt.value = String(qLen);
      opt.textContent = `${qLen} вопросов`;
      countSelect.appendChild(opt);
    }
    countSelect.value = String(qLen);
    this.renderOwnerQuestionInputs(quiz.questions || []);
    document.getElementById('creator-modal').classList.remove('hidden');
  },

  closeCreatorModal() {
    const modal = document.getElementById('creator-modal');
    if (modal) modal.classList.add('hidden');
    this.state.editingQuizId = null;
  },

  renderOwnerQuestionInputs(prefillQuestions = null) {
    const container = document.getElementById('owner-questions-list');
    const countSelect = document.getElementById('owner-quiz-count');
    if (!container || !countSelect) return;

    const count = Math.max(3, Math.min(20, parseInt(countSelect.value, 10) || 10));
    let html = '';

    for (let i = 0; i < count; i++) {
      const existing = Array.isArray(prefillQuestions) && prefillQuestions[i] ? prefillQuestions[i] : null;
      const qVal = existing ? this.escapeHtml(existing.q) : '';
      const opts = existing && Array.isArray(existing.options) ? existing.options : ['', '', '', ''];
      const correct = existing ? Number(existing.correct) : 0;

      html += `
        <div class="p-4 rounded-2xl bg-stone-900/90 border border-amber-500/20 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-amber-400">Вопрос #${i + 1}</span>
            <label class="text-xs text-amber-200/80 flex items-center gap-1.5">
              Верный вариант:
              <select id="owner-q-correct-${i}" class="bg-stone-800 border border-amber-500/30 rounded px-2 py-0.5 text-amber-300">
                <option value="0" ${correct === 0 ? 'selected' : ''}>A</option>
                <option value="1" ${correct === 1 ? 'selected' : ''}>B</option>
                <option value="2" ${correct === 2 ? 'selected' : ''}>C</option>
                <option value="3" ${correct === 3 ? 'selected' : ''}>D</option>
              </select>
            </label>
          </div>
          <input type="text" id="owner-q-text-${i}" value="${qVal}" required maxlength="240" placeholder="Текст вопроса ${i + 1}..." class="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-500/20 text-amber-100 text-xs sm:text-sm">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" id="owner-q-${i}-opt-0" value="${this.escapeHtml(opts[0] || '')}" required maxlength="120" placeholder="Вариант A" class="px-3 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs">
            <input type="text" id="owner-q-${i}-opt-1" value="${this.escapeHtml(opts[1] || '')}" required maxlength="120" placeholder="Вариант B" class="px-3 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs">
            <input type="text" id="owner-q-${i}-opt-2" value="${this.escapeHtml(opts[2] || '')}" required maxlength="120" placeholder="Вариант C" class="px-3 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs">
            <input type="text" id="owner-q-${i}-opt-3" value="${this.escapeHtml(opts[3] || '')}" required maxlength="120" placeholder="Вариант D" class="px-3 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs">
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  async handleSaveOwnedQuiz() {
    const sess = this.state.ownerSession;
    if (!sess || !sess.ownerToken) {
      this.showToast('Сессия владельца не найдена', '🔒');
      return;
    }

    const title = document.getElementById('owner-quiz-title').value.trim();
    const badge = document.getElementById('owner-quiz-badge').value;
    const author = (document.getElementById('owner-quiz-author').value.trim() || this.state.username || 'Гость').slice(0, 40);
    const description = document.getElementById('owner-quiz-desc').value.trim();
    const count = parseInt(document.getElementById('owner-quiz-count').value, 10) || 10;

    const questions = [];
    for (let i = 0; i < count; i++) {
      questions.push({
        q: document.getElementById(`owner-q-text-${i}`).value.trim(),
        options: [
          document.getElementById(`owner-q-${i}-opt-0`).value.trim(),
          document.getElementById(`owner-q-${i}-opt-1`).value.trim(),
          document.getElementById(`owner-q-${i}-opt-2`).value.trim(),
          document.getElementById(`owner-q-${i}-opt-3`).value.trim()
        ],
        correct: parseInt(document.getElementById(`owner-q-correct-${i}`).value, 10)
      });
    }

    const saveBtn = document.getElementById('owner-quiz-save-btn');
    saveBtn.disabled = true;

    const isEditing = Boolean(this.state.editingQuizId);

    try {
      const response = await fetch('/api/quizzes', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEditing
            ? {
                ownerToken: sess.ownerToken,
                quiz: {
                  id: this.state.editingQuizId,
                  title,
                  badge,
                  author,
                  description,
                  questions
                }
              }
            : {
                inviteCode: sess.code,
                ownerToken: sess.ownerToken,
                quiz: {
                  title,
                  badge,
                  author,
                  description,
                  questions
                }
              }
        )
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.quiz) {
        this.showToast(data.error || 'Не удалось сохранить интерактив', '⚠️');
        return;
      }

      if (Array.isArray(data.quizzes)) {
        this.state.quizzes = data.quizzes;
        this.saveQuizzes();
      }

      if (!isEditing) {
        this.saveOwnerSession({
          ...sess,
          ownedQuizId: data.quiz.id
        });
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

  shareQuizTelegram(quizId = null) {
    const quiz = quizId ? this.state.quizzes.find(q => q.id === quizId) : this.state.activeQuiz;
    if (!quiz) return;
    const url = this.getQuizUrl(quiz.id);
    const text = `🍂 Пройди интерактив «${quiz.title}» и построй свой маршрут!`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  },

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

    if (this.state.playMode === 'relaxed') {
      relaxedBtn.className = 'p-3 rounded-2xl bg-amber-500/25 border-2 border-amber-400 text-left transition cursor-pointer';
      speedBtn.className = 'p-3 rounded-2xl bg-stone-900/80 border border-amber-500/20 hover:border-amber-400/50 text-left transition cursor-pointer';
    } else {
      relaxedBtn.className = 'p-3 rounded-2xl bg-stone-900/80 border border-amber-500/20 hover:border-amber-400/50 text-left transition cursor-pointer';
      speedBtn.className = 'p-3 rounded-2xl bg-sky-500/20 border-2 border-sky-400 text-left transition cursor-pointer';
    }
  },

  startQuizTimer() {
    this.stopQuizTimer();
    const timerEl = document.getElementById('quiz-timer-live');
    if (this.state.playMode !== 'speed') {
      if (timerEl) timerEl.classList.add('hidden');
      this.state.quizElapsedSec = 0;
      return;
    }

    this.state.quizStartTimeMs = performance.now();
    this.state.quizElapsedSec = 0;
    if (timerEl) {
      timerEl.textContent = '⏱️ 0.0с';
      timerEl.classList.remove('hidden');
    }

    this.state.timerIntervalId = setInterval(() => {
      const sec = (performance.now() - this.state.quizStartTimeMs) / 1000;
      this.state.quizElapsedSec = Math.round(sec * 10) / 10;
      if (timerEl) {
        timerEl.textContent = `⏱️ ${this.state.quizElapsedSec.toFixed(1)}с`;
      }
    }, 100);
  },

  stopQuizTimer() {
    if (this.state.timerIntervalId) {
      clearInterval(this.state.timerIntervalId);
      this.state.timerIntervalId = null;
    }
    if (this.state.playMode === 'speed' && this.state.quizStartTimeMs) {
      const sec = (performance.now() - this.state.quizStartTimeMs) / 1000;
      this.state.quizElapsedSec = Math.round(sec * 10) / 10;
    }
  },

  init() {
    this.state.username = '';
    this.updateUserDisplay();
    this.createParticles();
    this.loadData();
    this.loadOwnerSession();
    this.bindEvents();

    if (window.location.hash === '#admin') {
      this.toggleAdminModal();
    }

    const routeQuizId = this.getQuizIdFromUrl();
    this.state.initialRouteQuizId = routeQuizId;

    this.renderHome();

    if (routeQuizId) {
      const localQuiz = this.state.quizzes.find(q => q.id === routeQuizId);
      if (localQuiz) {
        this.openLobby(localQuiz.id, { replaceHistory: true });
      }
    }

    this.fetchGlobalQuizzes();
    this.fetchGlobalLeaderboards();
  },

  updateUserDisplay() {
    const el = document.getElementById('current-user-display');
    if (el) {
      el.textContent = this.state.username || 'Гость';
    }
  },

  createParticles() {
    const container = document.getElementById('particles-container');
    const symbols = ['🍂', '🍁', '❄️', '✨', '🍃'];
    const count = window.innerWidth < 640 ? 14 : 24;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'particle';
      el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      el.style.left = Math.random() * 100 + 'vw';
      el.style.fontSize = (Math.random() * 12 + 12) + 'px';
      el.style.animationDuration = (Math.random() * 10 + 10) + 's';
      el.style.animationDelay = (Math.random() * 10) + 's';
      container.appendChild(el);
    }
  },

  loadData() {
    try {
      const savedQuizzes = localStorage.getItem('cozy_quizzes');
      this.state.quizzes = savedQuizzes ? JSON.parse(savedQuizzes) : [];

      const savedBoards = localStorage.getItem('cozy_leaderboards');
      this.state.leaderboards = savedBoards ? JSON.parse(savedBoards) : {};
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

  async fetchGlobalQuizzes() {
    try {
      const response = await fetch('/api/quizzes', { cache: 'no-store' });
      if (!response.ok) return;

      const data = await response.json();
      if (!Array.isArray(data.quizzes)) return;

      this.state.quizzes = data.quizzes;
      this.saveQuizzes();

      if (this.state.initialRouteQuizId) {
        const targetId = this.state.initialRouteQuizId;
        this.state.initialRouteQuizId = null;
        const foundQuiz = this.state.quizzes.find(q => q.id === targetId);
        if (foundQuiz) {
          this.openLobby(foundQuiz.id, { replaceHistory: true });
          return;
        } else {
          this.showToast('Интерактив по этой ссылке не найден', '🕯️');
          this.syncUrlForHome(true);
        }
      }

      if (!document.getElementById('view-home').classList.contains('hidden')) {
        this.renderHome();
      }
      if (this.state.activeQuiz) {
        const refreshed = this.state.quizzes.find(q => q.id === this.state.activeQuiz.id);
        if (refreshed) {
          this.state.activeQuiz = refreshed;
          if (!document.getElementById('view-lobby').classList.contains('hidden')) {
            this.openLobby(refreshed.id, { replaceHistory: true });
          }
        }
      }
    } catch {
      // Оставляем локальный кэш при отсутствии сети или API
    }
  },

  async publishQuizToGlobal(newQuiz) {
    if (!this.state.adminPasscode) {
      return { ok: false, error: 'Введите пароль админа заново для публикации на сервере' };
    }

    try {
      const response = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode: this.state.adminPasscode,
          quiz: newQuiz
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false, error: data.error || 'Не удалось сохранить квиз на сервере' };
      }

      if (Array.isArray(data.quizzes)) {
        this.state.quizzes = data.quizzes;
        this.saveQuizzes();
      }

      return { ok: true };
    } catch {
      return { ok: false, error: 'Сеть недоступна: квиз сохранён только локально' };
    }
  },

  async fetchGlobalLeaderboards(targetQuizId = null) {
    try {
      const query = targetQuizId ? `?quizId=${encodeURIComponent(targetQuizId)}` : '';
      const response = await fetch(`/api/leaderboard${query}`, { cache: 'no-store' });
      if (!response.ok) return;

      const data = await response.json();

      if (targetQuizId && Array.isArray(data.leaderboard)) {
        this.state.leaderboards[targetQuizId] = data.leaderboard;
        this.saveLeaderboards();
        if (!document.getElementById('view-lobby').classList.contains('hidden')) {
          this.renderLeaderboard(targetQuizId, 'lobby-leaderboard');
        }
        if (!document.getElementById('view-quiz').classList.contains('hidden')) {
          this.renderLeaderboard(targetQuizId, 'quiz-live-leaderboard');
        }
        if (!document.getElementById('view-results').classList.contains('hidden')) {
          this.renderLeaderboard(targetQuizId, 'results-leaderboard');
        }
        return;
      }

      if (data.leaderboards && typeof data.leaderboards === 'object') {
        this.state.leaderboards = {
          ...this.state.leaderboards,
          ...data.leaderboards
        };
        this.saveLeaderboards();
        if (!document.getElementById('view-home').classList.contains('hidden')) {
          this.renderHome();
        }
        if (this.state.activeQuiz && !document.getElementById('view-quiz').classList.contains('hidden')) {
          this.renderLeaderboard(this.state.activeQuiz.id, 'quiz-live-leaderboard');
        }
      }
    } catch {
      // Оставляем локальный кэш при отсутствии сети или API
    }
  },

  async submitScoreToGlobal(quizId, name, score, total, date, mode = 'relaxed', durationSec = null) {
    try {
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId, name, score, total, date, mode, durationSec })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.leaderboard)) return;

      this.state.leaderboards[quizId] = data.leaderboard;
      this.saveLeaderboards();
      this.renderLeaderboard(quizId, 'results-leaderboard');
      this.renderHome();
    } catch {
      // Локальный результат уже сохранён как резервный вариант
    }
  },

  bindEvents() {
    document.getElementById('name-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('username-input');
      const name = input.value.trim().slice(0, 24);
      if (!name) return;

      const hadNameBefore = Boolean(this.state.username);
      this.state.username = name;
      this.updateUserDisplay();
      document.getElementById('name-modal').classList.add('hidden');

      if (!hadNameBefore) {
        this.showToast(`Добро пожаловать, ${name}!`, '🧣');
      } else {
        this.showToast(`Имя обновлено: ${name}`, '✏️');
      }

      const pendingQuizId = this.state.pendingQuizIdAfterName;
      const shouldStartQuiz = this.state.startQuizAfterNameSubmit;
      this.state.pendingQuizIdAfterName = null;
      this.state.startQuizAfterNameSubmit = false;

      if (pendingQuizId) {
        const quiz = this.state.quizzes.find(q => q.id === pendingQuizId);
        if (quiz) {
          this.state.activeQuiz = quiz;
          if (shouldStartQuiz) {
            this.startQuiz();
            return;
          }
        }
      }

      if (shouldStartQuiz && this.state.activeQuiz) {
        this.startQuiz();
      }
    });

    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#admin') {
        this.toggleAdminModal();
      }
    });

    window.addEventListener('popstate', () => {
      const routeQuizId = this.getQuizIdFromUrl();
      if (routeQuizId) {
        const quiz = this.state.quizzes.find(q => q.id === routeQuizId);
        if (quiz) {
          this.openLobby(quiz.id, { skipHistory: true });
          return;
        }
      }
      this.showHome({ skipHistory: true });
    });

    document.getElementById('admin-pass-input').addEventListener('keydown', (e) => {
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

    document.getElementById('gift-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.sendGiftViaResend();
    });

    const inviteForm = document.getElementById('invite-form');
    if (inviteForm) {
      inviteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('invite-code-input');
        await this.redeemInviteCode(input ? input.value : '');
      });
    }

    const ownerQuizForm = document.getElementById('owner-quiz-form');
    if (ownerQuizForm) {
      ownerQuizForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveOwnedQuiz();
      });
    }

    window.addEventListener('resize', () => {
      if (!document.getElementById('view-quiz').classList.contains('hidden')) {
        this.renderJourneyMap();
      }
      if (!document.getElementById('view-results').classList.contains('hidden')) {
        this.renderJourneyMap();
        this.renderFinalMapPreview();
      }
    });
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

    setTimeout(() => {
      toast.classList.add('translate-x-full', 'opacity-0');
    }, 3500);
  },

  switchView(viewId) {
    ['view-home', 'view-lobby', 'view-quiz', 'view-results'].forEach(id => {
      document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');

    const wrapper = document.getElementById('main-wrapper');
    if (viewId === 'view-quiz') {
      wrapper.classList.remove('max-w-4xl');
      wrapper.classList.add('max-w-7xl');
    } else {
      wrapper.classList.remove('max-w-7xl');
      wrapper.classList.add('max-w-4xl');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  showHome(options = {}) {
    this.stopQuizTimer();
    if (!options.skipHistory) {
      this.syncUrlForHome(Boolean(options.replaceHistory));
    } else {
      document.title = 'Уютные интерактивы';
    }
    this.renderHome();
    this.fetchGlobalQuizzes();
    this.fetchGlobalLeaderboards();
    this.switchView('view-home');
  },

  goToQuizzes() {
    this.syncUrlForHome();
    this.renderHome();
    this.fetchGlobalQuizzes();
    this.fetchGlobalLeaderboards();
    this.switchView('view-home');

    const grid = document.getElementById('quizzes-grid');
    if (grid) {
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.showToast('Список интерактивов открыт', '🍂');
  },

  getRankedLeaderboard(quizId) {
    const rawList = [...(this.state.leaderboards[quizId] || [])];
    const isInActiveQuiz =
      this.state.activeQuiz &&
      this.state.activeQuiz.id === quizId &&
      this.state.username &&
      document.getElementById('view-quiz') &&
      !document.getElementById('view-quiz').classList.contains('hidden');

    if (isInActiveQuiz) {
      const playerName = String(this.state.username);
      const liveScore = Number(this.state.currentScore) || 0;
      const liveTotal = this.state.activeQuiz.questions.length;
      const idx = rawList.findIndex(item => String(item?.name || '').toLowerCase() === playerName.toLowerCase());
      const nowStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

      if (idx !== -1) {
        const bestKnown = Math.max(Number(rawList[idx].score) || 0, liveScore);
        rawList[idx] = { ...rawList[idx], name: playerName, score: bestKnown, total: liveTotal };
      } else {
        rawList.push({ name: playerName, score: liveScore, total: liveTotal, date: nowStr });
      }
    }

    rawList.sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));

    let currentPosition = 0;
    let previousScore = null;

    return rawList.map((entry) => {
      const scoreNum = Number(entry?.score) || 0;
      if (previousScore === null || scoreNum < previousScore) {
        currentPosition += 1;
        previousScore = scoreNum;
      }
      return {
        ...entry,
        name: String(entry?.name || 'Игрок'),
        score: scoreNum,
        position: currentPosition
      };
    });
  },

  getPositionBadge(position) {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return `#${position}`;
  },

  getQuizMeta(quiz) {
    const author = String(quiz?.author || quiz?.createdBy || 'Iakov').trim() || 'Iakov';
    let createdAtText = '';

    if (quiz?.createdAt) {
      const parsed = new Date(quiz.createdAt);
      if (!Number.isNaN(parsed.getTime())) {
        createdAtText = parsed.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } else {
        createdAtText = String(quiz.createdAt);
      }
    } else if (typeof quiz?.id === 'string' && quiz.id.startsWith('quiz-')) {
      const ts = Number(quiz.id.replace('quiz-', ''));
      if (!Number.isNaN(ts) && ts > 1600000000000) {
        createdAtText = new Date(ts).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }
    }

    if (!createdAtText) {
      createdAtText = 'осенью 2026';
    }

    return { author, createdAtText };
  },

  renderHome() {
    const grid = document.getElementById('quizzes-grid');
    const tagsContainer = document.getElementById('home-tag-filters');
    grid.innerHTML = '';

    if (tagsContainer) {
      const uniqueBadges = Array.from(new Set(this.state.quizzes.map(q => q.badge).filter(Boolean)));
      const chips = ['ALL', ...uniqueBadges];
      tagsContainer.innerHTML = chips.map(tag => {
        const isActive = this.state.homeTagFilter === tag;
        const label = tag === 'ALL' ? '✨ Все темы' : this.escapeHtml(tag);
        return `
          <button
            type="button"
            onclick="app.setHomeTagFilter('${this.escapeHtml(tag)}')"
            class="px-3 py-1 rounded-full text-xs transition cursor-pointer ${
              isActive
                ? 'bg-amber-400 text-stone-950 font-bold'
                : 'bg-stone-900/80 hover:bg-stone-800 border border-amber-500/20 text-amber-200/80'
            }"
          >
            ${label}
          </button>
        `;
      }).join('');
    }

    const searchQ = this.state.homeSearch.trim().toLowerCase();
    const visibleQuizzes = this.state.quizzes.filter(quiz => {
      const matchesTag = this.state.homeTagFilter === 'ALL' || quiz.badge === this.state.homeTagFilter;
      if (!matchesTag) return false;
      if (!searchQ) return true;
      const meta = this.getQuizMeta(quiz);
      const hay = `${quiz.title} ${quiz.description} ${quiz.badge} ${meta.author}`.toLowerCase();
      return hay.includes(searchQ);
    });

    if (visibleQuizzes.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full cozy-card rounded-3xl p-8 text-center">
          <div class="text-4xl mb-3">🕯️</div>
          <h3 class="font-serif text-2xl font-bold text-amber-200 mb-2">
            ${this.state.quizzes.length === 0 ? 'Интерактивы скоро появятся' : 'Ничего не найдено'}
          </h3>
          <p class="text-amber-200/70 text-sm max-w-md mx-auto">
            ${this.state.quizzes.length === 0
              ? 'Автор ещё готовит вопросы для этого вечера. Загляни чуть позже!'
              : 'Попробуйте изменить поисковый запрос или сбросить фильтр по тегам.'}
          </p>
        </div>
      `;
      return;
    }

    visibleQuizzes.forEach(quiz => {
      const rankedBoard = this.getRankedLeaderboard(quiz.id);
      const firstPlace = rankedBoard.find(item => item.position === 1);
      const secondPlace = rankedBoard.find(item => item.position === 2);
      const thirdPlace = rankedBoard.find(item => item.position === 3);

      const podiumParts = [
        firstPlace ? `🥇 <strong class="text-amber-300">${this.escapeHtml(firstPlace.name)}</strong> (${firstPlace.score}/${firstPlace.total})` : '',
        secondPlace ? `🥈 <strong class="text-amber-200">${this.escapeHtml(secondPlace.name)}</strong> (${secondPlace.score}/${secondPlace.total})` : '',
        thirdPlace ? `🥉 <strong class="text-amber-200">${this.escapeHtml(thirdPlace.name)}</strong> (${thirdPlace.score}/${thirdPlace.total})` : ''
      ].filter(Boolean);

      const topSummary = podiumParts.length > 0
        ? `<div class="flex flex-wrap items-center gap-x-3 gap-y-1">${podiumParts.join('<span class="text-amber-500/40">•</span>')}</div>`
        : '✨ В таблице лидеров пока никого нет';

      const meta = this.getQuizMeta(quiz);
      const card = document.createElement('div');
      card.className = 'cozy-card rounded-3xl p-6 flex flex-col justify-between hover:border-amber-400/50 transition group';
      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-medium">
              ${this.escapeHtml(quiz.badge)}
            </span>
            <span class="text-xs text-amber-200/60">${quiz.questions.length} вопросов</span>
          </div>
          <h3 class="font-serif text-2xl font-bold text-amber-100 group-hover:text-amber-300 transition mb-2">
            ${this.escapeHtml(quiz.title)}
          </h3>
          <p class="text-amber-200/75 text-sm mb-3 line-clamp-2">
            ${this.escapeHtml(quiz.description)}
          </p>
          <div class="text-[11px] text-amber-200/60 mb-4 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>✍️ Создал: <strong class="text-amber-200/90 font-medium">${this.escapeHtml(meta.author)}</strong></span>
            <span>•</span>
            <span>📅 ${this.escapeHtml(meta.createdAtText)}</span>
          </div>
        </div>

        <div class="pt-4 border-t border-amber-500/15 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <div class="text-xs text-amber-200/80 min-w-0">
            ${topSummary}
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onclick="event.stopPropagation(); app.copyQuizLink('${this.escapeHtml(quiz.id)}')"
              title="Скопировать ссылку на страницу интерактива"
              class="px-2.5 py-2 rounded-xl bg-stone-900/80 hover:bg-stone-800 border border-amber-500/25 text-amber-200/85 text-xs transition cursor-pointer"
            >
              🔗
            </button>
            <button
              type="button"
              onclick="app.openLobby('${this.escapeHtml(quiz.id)}')"
              class="cozy-btn text-stone-950 font-bold px-4 py-2 rounded-xl text-sm cursor-pointer"
            >
              Открыть →
            </button>
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
    if (!this.state.username) {
      this.openNameModal({ quizId: quiz.id, startQuiz: true });
      return;
    }

    this.startQuiz();
  },

  openLobby(quizId, options = {}) {
    const quiz = this.state.quizzes.find(q => q.id === quizId);
    if (!quiz) return;

    this.state.activeQuiz = quiz;
    if (!options.skipHistory) {
      this.syncUrlForQuiz(quiz.id, Boolean(options.replaceHistory));
    }
    document.title = `${quiz.title} — Уютные интерактивы`;

    const meta = this.getQuizMeta(quiz);
    document.getElementById('lobby-badge').textContent = quiz.badge;
    const countEl = document.getElementById('lobby-questions-count');
    if (countEl) {
      countEl.textContent = `${quiz.questions.length} вопросов`;
    }
    document.getElementById('lobby-title').textContent = quiz.title;
    document.getElementById('lobby-desc').innerHTML = `
      <span>${this.escapeHtml(quiz.description)}</span>
      <span class="block mt-2 text-xs text-amber-200/60">✍️ Создал: <strong class="text-amber-200/90 font-medium">${this.escapeHtml(meta.author)}</strong> • 📅 ${this.escapeHtml(meta.createdAtText)}</span>
    `;

    const editBtn = document.getElementById('lobby-edit-owner-btn');
    if (editBtn) {
      const sess = this.state.ownerSession;
      if (sess && sess.ownerToken && sess.ownedQuizId === quiz.id) {
        editBtn.classList.remove('hidden');
      } else {
        editBtn.classList.add('hidden');
      }
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
      container.innerHTML = `
        <div class="text-center py-6 px-4 bg-stone-900/50 rounded-2xl border border-amber-500/15 text-amber-200/70 text-sm">
          В таблице лидеров этого интерактива пока никого нет. Пройди его первым, чтобы занять первое место! 🎄
        </div>
      `;
      return;
    }

    container.innerHTML = list.map((entry) => {
      const isCurrentUser = this.state.username && entry.name.toLowerCase() === this.state.username.toLowerCase();
      const posBadge = this.getPositionBadge(entry.position);

      return `
        <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3.5 sm:px-4 py-3 rounded-2xl ${isCurrentUser ? 'bg-amber-500/20 border border-amber-400/50' : 'bg-stone-900/65 border border-amber-500/15'}">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <span class="text-base sm:text-lg font-bold w-7 sm:w-8 text-center shrink-0">${posBadge}</span>
            <div class="min-w-0 flex-1">
              <span class="font-semibold text-sm sm:text-base break-words ${isCurrentUser ? 'text-amber-300' : 'text-amber-100'}">
                ${this.escapeHtml(entry.name)} ${isCurrentUser ? '(Ты)' : ''}
              </span>
              <span class="block text-[11px] text-amber-200/50">${this.escapeHtml(entry.date || 'Недавно')}</span>
            </div>
          </div>
          <div class="text-left sm:text-right shrink-0 flex items-center gap-1.5">
            ${
              entry.mode === 'speed' && typeof entry.durationSec === 'number'
                ? `<span class="inline-block px-2 py-1 rounded-xl bg-sky-950/90 border border-sky-500/30 text-sky-300 font-mono font-semibold text-xs whitespace-nowrap">⚡ ${entry.durationSec.toFixed(1)}с</span>`
                : ''
            }
            <span class="inline-block px-2.5 sm:px-3 py-1 rounded-xl bg-emerald-950/90 border border-emerald-500/30 text-emerald-300 font-bold text-xs sm:text-sm whitespace-nowrap">
              ${Number(entry.score)} / ${Number(entry.total)} верных
            </span>
          </div>
        </div>
      `;
    }).join('');
  },

  startQuiz() {
    if (!this.state.activeQuiz) return;
    if (!this.state.username) {
      this.openNameModal({ quizId: this.state.activeQuiz.id, startQuiz: true });
      return;
    }

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
    const total = quiz.questions.length;
    const qData = quiz.questions[idx];

    document.getElementById('quiz-progress-text').textContent = `Этап ${idx + 1} из ${total}`;
    document.getElementById('quiz-score-live').textContent = `Верно: ${this.state.currentScore}`;
    document.getElementById('question-text').textContent = qData.q;

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    qData.options.forEach((optText, optIdx) => {
      const btn = document.createElement('button');
      btn.className = 'w-full text-left p-4 rounded-2xl bg-stone-900/80 hover:bg-amber-500/20 border border-amber-500/25 hover:border-amber-400 text-amber-100 text-sm sm:text-base transition flex items-center gap-3 cursor-pointer';
      btn.innerHTML = `
        <span class="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
          ${['A', 'B', 'C', 'D'][optIdx]}
        </span>
        <span>${this.escapeHtml(optText)}</span>
      `;
      btn.onclick = () => this.handleAnswer(optIdx, btn);
      optionsContainer.appendChild(btn);
    });
  },

  handleAnswer(selectedIdx, clickedBtn) {
    const quiz = this.state.activeQuiz;
    const qData = quiz.questions[this.state.currentQuestionIndex];
    const allBtns = document.getElementById('options-container').querySelectorAll('button');

    allBtns.forEach(b => b.disabled = true);

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
      allBtns[qData.correct].className = 'w-full text-left p-4 rounded-2xl bg-emerald-900/60 border border-emerald-400 text-emerald-100 text-sm sm:text-base flex items-center gap-3 transition-all duration-150';
    }

    this.renderJourneyMap();
    this.renderLeaderboard(quiz.id, 'quiz-live-leaderboard');

    const delay = isCorrect ? 800 : 450;

    setTimeout(() => {
      this.state.currentQuestionIndex++;
      if (this.state.currentQuestionIndex < quiz.questions.length) {
        this.renderQuestion();
      } else {
        this.finishQuiz();
      }
    }, delay);
  },

  formatStepsCount(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return `${count} шаг`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} шага`;
    return `${count} шагов`;
  },

  getRouteStats() {
    const steps = this.state.routeHistory.slice(1);
    const yellowSteps = steps.filter(s => s.lane === 'main').length;
    const blueSteps = steps.filter(s => s.lane === 'detour').length;
    const total = steps.length || 10;

    let conclusion = '';
    let emoji = '🧣';

    if (yellowSteps === 0) {
      emoji = '❄️';
      conclusion = `Все ${this.formatStepsCount(blueSteps)} ушли на синие обходы, а жёлтая тропа (${this.formatStepsCount(yellowSteps)}) осталась нетронутой — зато маршрут получился самым непредсказуемым! Отличный повод поболтать по душам за какао! ☕❄️`;
    } else if (blueSteps === 0) {
      emoji = '🎄';
      conclusion = `Абсолютная точность: ${this.formatStepsCount(yellowSteps)} по жёлтому пути и ни одного синего поворота (${this.formatStepsCount(blueSteps)}). Ты прошёл всю карту с первой попытки — браво! 🎄✨`;
    } else if (yellowSteps > blueSteps && blueSteps <= 2) {
      emoji = '🕯️';
      conclusion = `Почти идеальный маршрут: ${this.formatStepsCount(yellowSteps)} по жёлтой тропе против всего ${this.formatStepsCount(blueSteps)} по синей. Небольшой морозный занос только добавил азарта! 🕯️✨`;
    } else if (yellowSteps > blueSteps) {
      emoji = '🍂';
      conclusion = `Уверенный перевес в пользу верного пути: ${this.formatStepsCount(yellowSteps)} по жёлтой тропе и ${this.formatStepsCount(blueSteps)} по синей. Большинство развилок разгадано чётко, а парочка синих крюков лишь украсила карту! 🍂🕯️`;
    } else if (yellowSteps === blueSteps) {
      emoji = '⚖️';
      conclusion = `Идеальный баланс на развилках: ровно ${this.formatStepsCount(yellowSteps)} по жёлтому пути и ${this.formatStepsCount(blueSteps)} по синему. Половина — точные попадания, половина — смелые обходные манёвры! ⚖️🧣`;
    } else if (yellowSteps >= 2) {
      emoji = '🧭';
      conclusion = `Извилистая экспедиция: ${this.formatStepsCount(yellowSteps)} по жёлтой тропе и ${this.formatStepsCount(blueSteps)} по синей. Синие тропы оказались длиннее, но каждый жёлтый шаг был на вес золота — до ёлки всё равно дошли! 🧭🎄`;
    } else {
      emoji = '🌨️';
      conclusion = `Редкий золотой след среди метели: всего ${this.formatStepsCount(yellowSteps)} по жёлтой тропе и целых ${this.formatStepsCount(blueSteps)} по синей. Зато теперь точно есть что обсудить у тёплого очага! 🌨️☕`;
    }

    return { yellowSteps, blueSteps, total, conclusion, emoji };
  },

  finishQuiz() {
    this.stopQuizTimer();
    const quiz = this.state.activeQuiz;
    const score = this.state.currentScore;
    const total = quiz.questions.length;
    const mode = this.state.playMode || 'relaxed';
    const durationSec = mode === 'speed' ? this.state.quizElapsedSec : null;

    if (!this.state.leaderboards[quiz.id]) {
      this.state.leaderboards[quiz.id] = [];
    }

    const board = this.state.leaderboards[quiz.id];
    const playerName = this.state.username || 'Гость';
    const existingIdx = board.findIndex(item => item.name.toLowerCase() === playerName.toLowerCase());
    const nowStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

    if (existingIdx !== -1) {
      const prev = board[existingIdx];
      const isBetterScore = score > prev.score;
      const isSameFaster =
        score === prev.score &&
        durationSec !== null &&
        (typeof prev.durationSec !== 'number' || durationSec < prev.durationSec);
      if (isBetterScore || isSameFaster) {
        board[existingIdx] = { name: playerName, score, total, date: nowStr, mode, durationSec };
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

  renderFinalMapPreview() {
    const preview = document.getElementById('final-map-preview');
    const sourceSvg = document.getElementById('journey-map-svg');
    if (!preview || !sourceSvg) return;

    const clonedSvg = sourceSvg.cloneNode(true);
    clonedSvg.removeAttribute('id');
    clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    clonedSvg.style.display = 'block';
    clonedSvg.style.width = '100%';
    clonedSvg.style.height = 'auto';

    clonedSvg.querySelectorAll('.js-animated-stroke').forEach(el => {
      el.style.strokeDasharray = 'none';
      el.style.strokeDashoffset = '0';
    });

    // Гарантируем видимость неба, гор, снежных холмов и непрозрачного домика в итоговом превью
    const skyRect = clonedSvg.querySelector('rect');
    if (skyRect) {
      skyRect.setAttribute('fill', '#1a243b');
      skyRect.style.opacity = '1';
    }

    const mountains = clonedSvg.querySelectorAll('#map-mountains-layer polygon');
    mountains.forEach((poly, idx) => {
      poly.style.opacity = '0.9';
      if (idx % 2 === 1) {
        poly.setAttribute('fill', '#f1f5f9');
      } else {
        poly.setAttribute('fill', '#3b4d6b');
      }
    });

    const hills = clonedSvg.querySelectorAll('#map-hills-layer path');
    hills.forEach((hp, idx) => {
      hp.style.opacity = '1';
      hp.setAttribute('fill', idx === 0 ? '#e2e8f0' : '#f8fafc');
    });

    const cabinEl = clonedSvg.querySelector('#festive-cabin');
    if (cabinEl) {
      cabinEl.style.opacity = '1';
      const wall = cabinEl.querySelector('rect[fill*="cabinWallGrad"]');
      if (wall) {
        wall.setAttribute('fill', '#6b3416');
      }
      const roofSnow = cabinEl.querySelector('path[fill*="cabinSnowRoof"]');
      if (roofSnow) {
        roofSnow.setAttribute('fill', '#f8fafc');
      }
    }

    preview.innerHTML = '';
    preview.appendChild(clonedSvg);
  },

  downloadRouteMap() {
    const quiz = this.state.activeQuiz;
    const stats = this.getRouteStats();
    const total = quiz ? quiz.questions.length : 10;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 680;
    const ctx = canvas.getContext('2d');

    const bgGrad = ctx.createLinearGradient(0, 0, 0, 680);
    bgGrad.addColorStop(0, '#111827');
    bgGrad.addColorStop(0.55, '#221814');
    bgGrad.addColorStop(1, '#11261d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 680);

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, 1168, 648);

    ctx.fillStyle = 'rgba(41, 29, 24, 0.9)';
    ctx.beginPath();
    ctx.moveTo(0, 420);
    ctx.quadraticCurveTo(300, 290, 620, 390);
    ctx.quadraticCurveTo(920, 480, 1200, 320);
    ctx.lineTo(1200, 680);
    ctx.lineTo(0, 680);
    ctx.fill();

    ctx.fillStyle = 'rgba(25, 51, 38, 0.88)';
    ctx.beginPath();
    ctx.moveTo(0, 510);
    ctx.quadraticCurveTo(400, 410, 780, 495);
    ctx.quadraticCurveTo(1020, 540, 1200, 440);
    ctx.lineTo(1200, 680);
    ctx.lineTo(0, 680);
    ctx.fill();

    const playerName = this.state.username || 'Гость';
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(`Маршрут игрока: ${playerName}`, 48, 68);

    ctx.fillStyle = '#fbbf24';
    ctx.font = '600 22px sans-serif';
    ctx.fillText(`${quiz ? quiz.title : 'Интерактив'} — Итог: ${this.state.currentScore} из ${total}`, 48, 104);

    const waypoints = [
      { main: { x: 95,   y: 470 }, detour: { x: 95,   y: 470 } },
      { main: { x: 195,  y: 375 }, detour: { x: 185,  y: 520 } },
      { main: { x: 300,  y: 300 }, detour: { x: 290,  y: 460 } },
      { main: { x: 405,  y: 370 }, detour: { x: 395,  y: 525 } },
      { main: { x: 510,  y: 280 }, detour: { x: 500,  y: 450 } },
      { main: { x: 615,  y: 240 }, detour: { x: 605,  y: 415 } },
      { main: { x: 720,  y: 325 }, detour: { x: 710,  y: 495 } },
      { main: { x: 825,  y: 255 }, detour: { x: 815,  y: 430 } },
      { main: { x: 930,  y: 210 }, detour: { x: 920,  y: 380 } },
      { main: { x: 1025, y: 260 }, detour: { x: 1015, y: 410 } },
      { main: { x: 1110, y: 195 }, detour: { x: 1110, y: 195 } }
    ];

    const getPt = (step, lane) => {
      const idx = Math.min(step, waypoints.length - 1);
      return lane === 'detour' ? waypoints[idx].detour : waypoints[idx].main;
    };

    for (let i = 1; i < this.state.routeHistory.length; i++) {
      const prev = getPt(this.state.routeHistory[i - 1].step, this.state.routeHistory[i - 1].lane);
      const curr = getPt(this.state.routeHistory[i].step, this.state.routeHistory[i].lane);
      const isDetour = this.state.routeHistory[i].lane === 'detour';

      const ctrlX = (prev.x + curr.x) / 2;
      const ctrlY = isDetour ? Math.max(prev.y, curr.y) + 24 : Math.min(prev.y, curr.y) - 24;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, curr.x, curr.y);
      ctx.strokeStyle = isDetour ? '#38bdf8' : '#fbbf24';
      ctx.shadowColor = isDetour ? '#38bdf8' : '#fbbf24';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.state.routeHistory.forEach(item => {
      if (item.step > total) return;
      const pt = getPt(item.step, item.lane);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = item.lane === 'detour' ? '#38bdf8' : '#fbbf24';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#1c120d';
      ctx.stroke();

      ctx.fillStyle = '#1c120d';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(item.step === 0 ? '★' : String(item.step), pt.x, pt.y + 1);
    });

    ctx.font = '44px sans-serif';
    ctx.fillText('🌙', 1115, 78);
    ctx.fillText('🏡', 65, 515);
    ctx.font = '56px sans-serif';
    ctx.fillText('🎄', 1125, 165);

    ctx.textAlign = 'left';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`● По жёлтому (верно): ${this.formatStepsCount(stats.yellowSteps)}`, 48, 600);

    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`● По синему (неверно): ${this.formatStepsCount(stats.blueSteps)}`, 390, 600);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#fef3c7';
    ctx.fillText(stats.conclusion, 48, 634);

    const link = document.createElement('a');
    const safeName = playerName.replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '_');
    link.download = `route-map-${safeName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    this.showToast('Карта маршрута сохранена в PNG!', '📥');
  },

  async sendGiftViaResend() {
    const btn = document.getElementById('send-gift-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Отправляем подарок...</span> ❄️';

    const stats = this.getRouteStats();
    const payload = {
      senderName: (this.state.username || 'Гость').slice(0, 30),
      quizTitle: (this.state.activeQuiz ? this.state.activeQuiz.title : 'Интерактив').slice(0, 100),
      score: `${this.state.currentScore} из ${this.state.activeQuiz ? this.state.activeQuiz.questions.length : 10} (жёлтый путь: ${stats.yellowSteps}, синий путь: ${stats.blueSteps})`,
      rating: document.getElementById('selected-rating').value,
      gift: document.getElementById('selected-gift').value,
      message: (document.getElementById('gift-message').value.trim() || 'Без дополнительного текста, но с теплом!').slice(0, 500)
    };

    try {
      const response = await fetch('/api/send-gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка отправки');
      }

      this.showToast('Подарок и оценка успешно отправлены!', '🎁');
      document.getElementById('gift-message').value = '';
    } catch (err) {
      this.showToast(err.message || 'Не удалось отправить письмо. Проверьте настройки Resend.', '⚠️');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  toggleAdminModal() {
    const modal = document.getElementById('admin-modal');
    modal.classList.toggle('hidden');
    if (modal.classList.contains('hidden') && window.location.hash === '#admin') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  },

  grantAdminAccess(adminHtml) {
    this.state.isAdminUnlocked = true;
    document.getElementById('admin-auth-box').classList.add('hidden');

    const container = document.getElementById('admin-panel-container');
    if (adminHtml) {
      container.innerHTML = adminHtml;
      this.renderAdminQuestionInputs();
      const form = document.getElementById('create-quiz-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleCreateQuiz();
        });
      }
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
      const response = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.authorized && data.adminHtml) {
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

  renderAdminQuestionInputs() {
    const container = document.getElementById('admin-questions-list');
    if (!container) return;
    let html = '';

    for (let i = 0; i < 10; i++) {
      html += `
        <div class="p-4 rounded-2xl bg-stone-900/90 border border-amber-500/20 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-amber-400">Вопрос #${i + 1}</span>
            <label class="text-xs text-amber-200/80 flex items-center gap-1.5">
              Верный вариант:
              <select id="q-correct-${i}" class="bg-stone-800 border border-amber-500/30 rounded px-2 py-0.5 text-amber-300">
                <option value="0">A</option>
                <option value="1">B</option>
                <option value="2">C</option>
                <option value="3">D</option>
              </select>
            </label>
          </div>
          <input type="text" id="q-text-${i}" required maxlength="200" placeholder="Текст вопроса ${i + 1}..." class="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-500/20 text-amber-100 text-xs sm:text-sm">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" id="q-${i}-opt-0" required maxlength="100" placeholder="Вариант A" class="px-3 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs">
            <input type="text" id="q-${i}-opt-1" required maxlength="100" placeholder="Вариант B" class="px-3 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs">
            <input type="text" id="q-${i}-opt-2" required maxlength="100" placeholder="Вариант C" class="px-3 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs">
            <input type="text" id="q-${i}-opt-3" required maxlength="100" placeholder="Вариант D" class="px-3 py-1.5 rounded-lg bg-stone-950 border border-amber-500/15 text-amber-100 text-xs">
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  async handleCreateQuiz() {
    const title = document.getElementById('new-quiz-title').value.trim();
    const badge = document.getElementById('new-quiz-badge').value;
    const description = document.getElementById('new-quiz-desc').value.trim();

    const questions = [];
    for (let i = 0; i < 10; i++) {
      questions.push({
        q: document.getElementById(`q-text-${i}`).value.trim(),
        options: [
          document.getElementById(`q-${i}-opt-0`).value.trim(),
          document.getElementById(`q-${i}-opt-1`).value.trim(),
          document.getElementById(`q-${i}-opt-2`).value.trim(),
          document.getElementById(`q-${i}-opt-3`).value.trim()
        ],
        correct: parseInt(document.getElementById(`q-correct-${i}`).value, 10)
      });
    }

    const nowIso = new Date().toISOString();
    const authorName = (this.state.username || 'Iakov').trim() || 'Iakov';
    const newQuiz = {
      id: 'quiz-' + Date.now(),
      title,
      badge,
      description,
      author: authorName,
      createdAt: nowIso,
      questions
    };

    this.state.quizzes.unshift(newQuiz);
    this.saveQuizzes();
    this.renderHome();
    this.toggleAdminModal();
    document.getElementById('create-quiz-form').reset();

    const syncRes = await this.publishQuizToGlobal(newQuiz);
    if (syncRes.ok) {
      this.openLobby(newQuiz.id);
      this.showToast('Новый интерактив опубликован! Открыта его личная страница', '🎄');
    } else {
      this.openLobby(newQuiz.id);
      this.showToast(syncRes.error, '⚠️');
    }
  }
};

window.addEventListener('DOMContentLoaded', () => app.init());
// --- Интеграция новогоднего домика, ёлки на холме и плавной подсветки пути ---
(function() {
  const TREE_SCALE = 1.6;
  const TREE_TIP_LOCAL_Y = -10;

  function applySnowHillStyles() {
    const hillsLayer = document.getElementById('map-hills-layer');
    if (!hillsLayer) return;
    const shapes = hillsLayer.querySelectorAll('path, polygon, rect, ellipse');
    shapes.forEach((el, idx) => {
      if (idx >= 2) {
        el.setAttribute('fill', idx % 2 === 0 ? 'url(#hillBack)' : 'url(#hillFront)');
      }
      el.style.opacity = idx === 0 ? '0.96' : '1';
    });
  }

  function animatePathSegments() {
    const svg = document.getElementById('journey-map-svg');
    const pathsLayer = document.getElementById('map-paths-layer');
    if (pathsLayer) {
      pathsLayer.querySelectorAll('path, line, polyline').forEach((el) => {
        el.classList.add('path-animated');
        el.style.animationPlayState = 'running';
      });
    }

    if (svg) {
      svg.querySelectorAll('.js-animated-stroke').forEach((pathEl) => {
        try {
          const len = pathEl.getTotalLength();
          if (!len || !isFinite(len)) return;
          pathEl.style.strokeDasharray = `${len}`;
          pathEl.style.strokeDashoffset = `${len}`;

          if (typeof pathEl.animate === 'function') {
            const anim = pathEl.animate(
              [
                { strokeDashoffset: String(len) },
                { strokeDashoffset: '0' }
              ],
              {
                duration: 650,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'forwards'
              }
            );
            anim.onfinish = () => {
              pathEl.style.strokeDashoffset = '0';
            };
          } else {
            requestAnimationFrame(() => {
              pathEl.style.transition = 'stroke-dashoffset 0.65s ease-out';
              pathEl.style.strokeDashoffset = '0';
            });
          }
        } catch (e) {}
      });
    }
  }

  function getFinalElementAnchor(isMobile) {
    const total = (typeof app !== 'undefined' && app.state && app.state.activeQuiz && Array.isArray(app.state.activeQuiz.questions))
      ? app.state.activeQuiz.questions.length
      : 10;
    const finalLabel = String(total);

    // Ищем самый последний элемент пути (номер total)
    const nodesLayer = document.getElementById('map-nodes-layer');
    if (nodesLayer) {
      const texts = Array.from(nodesLayer.querySelectorAll('text'));
      const finalTexts = texts.filter((t) => (t.textContent || '').trim() === finalLabel);
      if (finalTexts.length > 0) {
        const targetText = finalTexts[0];
        const x = parseFloat(targetText.getAttribute('x'));
        const yAttr = parseFloat(targetText.getAttribute('y'));
        if (!isNaN(x) && !isNaN(yAttr)) {
          return { x, y: yAttr - 4 };
        }
      }
    }

    // Координаты последнего элемента пути (waypoints[total] -> main)
    return isMobile ? { x: 210, y: 75 } : { x: 1130, y: 105 };
  }

  function positionCabinAndTree() {
    const svg = document.getElementById('journey-map-svg');
    const cabin = document.getElementById('festive-cabin');
    const treeGroup = document.getElementById('festive-tree-group');
    if (!svg) return;

    const viewBox = svg.getAttribute('viewBox') || '0 0 1200 460';
    const parts = viewBox.split(/[\s,]+/).map(Number);
    const vbW = parts[2] || 1200;
    const isNarrow = vbW < 600;

    if (cabin) {
      if (isNarrow) {
        cabin.setAttribute('transform', 'translate(72, 295) scale(0.95)');
      } else {
        cabin.setAttribute('transform', 'translate(835, 224) scale(1.55)');
      }
    }

    if (treeGroup) {
      const scale = isNarrow ? 0.95 : TREE_SCALE;
      const tipOffsetY = Math.abs(TREE_TIP_LOCAL_Y) * scale;
      const finalPt = getFinalElementAnchor(isNarrow);
      // Статично привязываем вершину звезды ёлки к самому последнему элементу пути
      const treeX = Math.min(vbW - 45, Math.max(150, finalPt.x));
      const treeY = finalPt.y + tipOffsetY - 10;

      treeGroup.setAttribute('transform', `translate(${treeX.toFixed(1)}, ${treeY.toFixed(1)}) scale(${scale})`);
    }
  }

  function enhanceMapLayout() {
    applySnowHillStyles();
    animatePathSegments();
    requestAnimationFrame(positionCabinAndTree);
  }

  if (typeof app !== 'undefined' && typeof app.renderJourneyMap === 'function') {
    const originalRenderJourneyMap = app.renderJourneyMap.bind(app);
    app.renderJourneyMap = function(...args) {
      const res = originalRenderJourneyMap(...args);
      enhanceMapLayout();
      return res;
    };
  }

  window.addEventListener('DOMContentLoaded', () => {
    enhanceMapLayout();
  });

  window.addEventListener('resize', () => {
    requestAnimationFrame(positionCabinAndTree);
  });
})();
