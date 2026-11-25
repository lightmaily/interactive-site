Object.assign(window.app, {
  getMapWaypoints(total, isMobile) {
    const pts = [];
    for (let s = 0; s <= total; s++) {
      const t = total > 0 ? s / total : 0;
      if (isMobile) {
        if (s === 0 || s === total) {
          const y = s === 0 ? 505 : 75;
          pts.push({ main: { x: 210, y }, detour: { x: 210, y } });
        } else {
          const y = Math.round(505 - t * 430);
          const zig = s % 2 === 1 ? -55 : 50;
          pts.push({
            main: { x: 210 + zig, y },
            detour: { x: s % 2 === 1 ? 318 : 102, y: y + 5 }
          });
        }
      } else if (s === 0) {
        pts.push({ main: { x: 85, y: 360 }, detour: { x: 85, y: 360 } });
      } else if (s === total) {
        pts.push({ main: { x: 1130, y: 105 }, detour: { x: 1130, y: 105 } });
      } else {
        const x = Math.round(85 + t * 1045);
        const wave = Math.sin(t * Math.PI * 3.2) * 42;
        const mainY = Math.round(335 - t * 215 - wave);
        pts.push({
          main: { x, y: mainY },
          detour: { x: x - 10, y: Math.min(415, mainY + 145) }
        });
      }
    }
    return pts;
  },

  renderJourneyMap() {
    const total = this.state.activeQuiz ? this.state.activeQuiz.questions.length : 10;
    const svg = document.getElementById('journey-map-svg');
    if (!svg) return;

    const hillsLayer = document.getElementById('map-hills-layer');
    const masksLayer = document.getElementById('map-masks-layer');
    const guidesLayer = document.getElementById('map-guides-layer');
    const pathsLayer = document.getElementById('map-paths-layer');
    const nodesLayer = document.getElementById('map-nodes-layer');
    const traveler = document.getElementById('map-traveler');
    const starsLayer = document.getElementById('map-stars-layer');
    const mountainsLayer = document.getElementById('map-mountains-layer');

    const isMobile = window.innerWidth < 768;
    const vbW = isMobile ? 420 : 1200;
    const vbH = isMobile ? 560 : 460;
    svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);

    const skyRect = svg.querySelector('rect');
    if (skyRect) {
      skyRect.setAttribute('width', String(vbW));
      skyRect.setAttribute('height', String(vbH));
    }

    if (starsLayer) {
      starsLayer.innerHTML = isMobile
        ? `
          <circle cx="55" cy="48" r="2" fill="#fde68a" class="winter-star" />
          <circle cx="155" cy="34" r="1.7" fill="#fef3c7" class="winter-star" style="animation-delay:0.7s" />
          <circle cx="265" cy="56" r="2.1" fill="#fde047" class="winter-star" style="animation-delay:1.3s" />
          <circle cx="365" cy="42" r="1.8" fill="#fef9c3" class="winter-star" style="animation-delay:0.4s" />
        `
        : `
          <circle cx="150" cy="64" r="2.2" fill="#fde68a" class="winter-star" />
          <circle cx="340" cy="48" r="1.8" fill="#fef3c7" class="winter-star" style="animation-delay:0.7s" />
          <circle cx="520" cy="74" r="2.4" fill="#fde047" class="winter-star" style="animation-delay:1.3s" />
          <circle cx="690" cy="42" r="2" fill="#fef9c3" class="winter-star" style="animation-delay:0.4s" />
          <circle cx="860" cy="68" r="2.3" fill="#fde68a" class="winter-star" style="animation-delay:1.9s" />
        `;
    }

    if (mountainsLayer) {
      mountainsLayer.innerHTML = isMobile
        ? `
          <polygon points="-20,335 105,195 235,335" fill="url(#mountainPeakFar)" opacity="0.72" />
          <polygon points="105,195 72,228 94,238 105,226 122,238 142,226" fill="url(#snowCapGrad)" />
          <polygon points="155,340 295,175 445,340" fill="url(#mountainPeakNear)" opacity="0.78" />
          <polygon points="295,175 256,212 278,222 295,208 315,222 336,210" fill="url(#snowCapGrad)" />
        `
        : `
          <polygon points="80,255 270,92 475,255" fill="url(#mountainPeakFar)" opacity="0.78" />
          <polygon points="270,92 225,132 252,144 270,130 292,145 316,130" fill="url(#snowCapGrad)" />
          <polygon points="360,255 585,78 825,255" fill="url(#mountainPeakNear)" opacity="0.82" />
          <polygon points="585,78 532,122 562,135 585,118 612,136 640,120" fill="url(#snowCapGrad)" />
          <polygon points="690,255 895,104 1125,255" fill="url(#mountainPeakFar)" opacity="0.76" />
          <polygon points="895,104 850,140 876,152 895,136 918,153 942,138" fill="url(#snowCapGrad)" />
        `;
    }

    if (hillsLayer) {
      hillsLayer.innerHTML = isMobile
        ? `
          <path d="M 0 345 Q 140 285, 420 330 L 420 560 L 0 560 Z" fill="url(#hillBack)" />
          <path d="M 0 435 Q 220 385, 420 425 L 420 560 L 0 560 Z" fill="url(#hillFront)" />
        `
        : `
          <path d="M 0 300 Q 260 180, 580 275 T 1200 210 L 1200 460 L 0 460 Z" fill="url(#hillBack)" />
          <path d="M 0 385 Q 360 300, 750 375 T 1200 320 L 1200 460 L 0 460 Z" fill="url(#hillFront)" />
        `;
      hillsLayer.querySelectorAll('path, polygon, rect, ellipse').forEach((el, idx) => {
        if (idx >= 2) el.setAttribute('fill', idx % 2 === 0 ? 'url(#hillBack)' : 'url(#hillFront)');
        el.style.opacity = idx === 0 ? '0.96' : '1';
      });
    }

    const waypoints = this.getMapWaypoints(total, isMobile);
    const getCoords = (step, lane) => {
      const safeIdx = Math.min(step, waypoints.length - 1);
      return lane === 'detour' ? waypoints[safeIdx].detour : waypoints[safeIdx].main;
    };

    const buildCurveD = (p1, p2, lane) => {
      const isDetour = lane === 'detour';
      const ctrlX = isMobile
        ? (isDetour ? (p2.x > 210 ? p2.x + 26 : p2.x - 26) : (p1.x + p2.x) / 2)
        : (p1.x + p2.x) / 2;
      const ctrlY = isMobile
        ? (p1.y + p2.y) / 2
        : (isDetour ? Math.max(p1.y, p2.y) + 22 : Math.min(p1.y, p2.y) - 22);
      return `M ${p1.x} ${p1.y} Q ${ctrlX} ${ctrlY}, ${p2.x} ${p2.y}`;
    };

    const history = this.state.routeHistory.length ? this.state.routeHistory : [{ step: 0, lane: 'main' }];
    const latestNode = history[history.length - 1];
    const currentPos = getCoords(latestNode.step, latestNode.lane);

    if (latestNode.step < total) {
      const nextStep = latestNode.step + 1;
      const mainBranchD = buildCurveD(currentPos, getCoords(nextStep, 'main'), 'main');
      const detourBranchD = buildCurveD(currentPos, getCoords(nextStep, 'detour'), 'detour');

      masksLayer.innerHTML = `
        <mask id="mask-branch-main"><path d="${mainBranchD}" fill="none" stroke="white" stroke-width="14" class="js-animated-stroke branch-sprout" /></mask>
        <mask id="mask-branch-detour"><path d="${detourBranchD}" fill="none" stroke="white" stroke-width="14" class="js-animated-stroke branch-sprout" /></mask>
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
    for (let i = 1; i < history.length; i++) {
      const prev = getCoords(history[i - 1].step, history[i - 1].lane);
      const curr = getCoords(history[i].step, history[i].lane);
      const lane = history[i].lane;
      const strokeColor = lane === 'detour' ? '#38bdf8' : '#fbbf24';
      const isNewest = i === history.length - 1;
      pathsHtml += `<path d="${buildCurveD(prev, curr, lane)}" ${isNewest ? 'class="js-animated-stroke path-draw-active"' : ''} fill="none" stroke="${strokeColor}" stroke-width="6.5" stroke-linecap="round" />`;
    }
    pathsLayer.innerHTML = pathsHtml;

    const nodeR = isMobile ? 13 : 14;
    const nextCandidateStep = latestNode.step + 1;
    let nodesHtml = '';

    for (let s = 0; s <= total; s++) {
      const label = s === 0 ? '★' : String(s);
      const hit = history.find(h => h.step === s);
      if (hit) {
        const pos = getCoords(s, hit.lane);
        const fill = hit.lane === 'detour' ? '#38bdf8' : '#fbbf24';
        nodesHtml += `<circle cx="${pos.x}" cy="${pos.y}" r="${nodeR}" fill="${fill}" stroke="#1c120d" stroke-width="3.5" /><text x="${pos.x}" y="${pos.y + 4.5}" text-anchor="middle" fill="#1c120d" font-size="12" font-weight="bold">${label}</text>`;
      } else if (s === nextCandidateStep) {
        const mPos = getCoords(s, 'main');
        const dPos = getCoords(s, 'detour');
        nodesHtml += `
          <circle cx="${mPos.x}" cy="${mPos.y}" r="${nodeR - 1}" fill="#292524" stroke="#fbbf24" stroke-width="2.5" />
          <text x="${mPos.x}" y="${mPos.y + 4}" text-anchor="middle" fill="#fef3c7" font-size="11" font-weight="700">${label}</text>
          <circle cx="${dPos.x}" cy="${dPos.y}" r="${nodeR - 3}" fill="#1e293b" stroke="#38bdf8" stroke-width="2.5" />
          <text x="${dPos.x}" y="${dPos.y + 3.5}" text-anchor="middle" fill="#bae6fd" font-size="10" font-weight="600">${label}</text>
        `;
      } else {
        const pos = getCoords(s, 'main');
        nodesHtml += `<circle cx="${pos.x}" cy="${pos.y}" r="${nodeR - 3}" fill="#292524" stroke="#f59e0b" stroke-width="2" opacity="0.7" /><text x="${pos.x}" y="${pos.y + 3.5}" text-anchor="middle" fill="#fef3c7" font-size="10" font-weight="700" opacity="0.85">${label}</text>`;
      }
    }
    nodesLayer.innerHTML = nodesHtml;

    if (traveler) {
      traveler.style.left = `${(currentPos.x / vbW) * 100}%`;
      traveler.style.top = `${(currentPos.y / vbH) * 100}%`;
    }

    this.animateStrokesAndProps(svg, pathsLayer, vbW);
  },

  animateStrokesAndProps(svg, pathsLayer, vbW) {
    if (pathsLayer) {
      pathsLayer.querySelectorAll('path, line, polyline').forEach(el => {
        el.classList.add('path-animated');
        el.style.animationPlayState = 'running';
      });
    }

    svg.querySelectorAll('.js-animated-stroke').forEach(pathEl => {
      try {
        const shouldAnimate =
          pathEl.classList.contains('path-draw-active') ||
          pathEl.classList.contains('branch-sprout');
        if (!shouldAnimate) {
          pathEl.style.strokeDasharray = 'none';
          pathEl.style.strokeDashoffset = '0';
          return;
        }
        const len = pathEl.getTotalLength();
        if (!len || !isFinite(len)) return;
        pathEl.style.strokeDasharray = `${len}`;
        pathEl.style.strokeDashoffset = `${len}`;
        if (typeof pathEl.animate === 'function') {
          const anim = pathEl.animate(
            [{ strokeDashoffset: String(len) }, { strokeDashoffset: '0' }],
            { duration: 550, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
          );
          anim.onfinish = () => {
            pathEl.style.strokeDasharray = 'none';
            pathEl.style.strokeDashoffset = '0';
          };
        } else {
          pathEl.style.strokeDasharray = 'none';
          pathEl.style.strokeDashoffset = '0';
        }
      } catch {}
    });

    const isNarrow = vbW < 600;
    const cabin = document.getElementById('festive-cabin');
    const treeGroup = document.getElementById('festive-tree-group');

    if (cabin) {
      cabin.setAttribute('transform', isNarrow ? 'translate(72, 295) scale(0.95)' : 'translate(835, 224) scale(1.55)');
    }

    if (treeGroup) {
      const scale = isNarrow ? 0.95 : 1.6;
      const total = this.state.activeQuiz?.questions?.length || 10;
      const finalText = Array.from(document.querySelectorAll('#map-nodes-layer text'))
        .find(t => (t.textContent || '').trim() === String(total));

      let anchor = isNarrow ? { x: 210, y: 75 } : { x: 1130, y: 105 };
      if (finalText) {
        const x = parseFloat(finalText.getAttribute('x'));
        const y = parseFloat(finalText.getAttribute('y'));
        if (!isNaN(x) && !isNaN(y)) anchor = { x, y: y - 4 };
      }

      const treeX = Math.min(vbW - 45, Math.max(150, anchor.x));
      const treeY = anchor.y + 10 * scale - 10;
      treeGroup.setAttribute('transform', `translate(${treeX.toFixed(1)}, ${treeY.toFixed(1)}) scale(${scale})`);
    }
  },

  formatStepsCount(count) {
    const m10 = count % 10;
    const m100 = count % 100;
    if (m10 === 1 && m100 !== 11) return `${count} шаг`;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${count} шага`;
    return `${count} шагов`;
  },

  getRouteStats() {
    const steps = this.state.routeHistory.slice(1);
    const yellowSteps = steps.filter(s => s.lane === 'main').length;
    const blueSteps = steps.filter(s => s.lane === 'detour').length;
    const total = steps.length || 10;
    const yStr = this.formatStepsCount(yellowSteps);
    const bStr = this.formatStepsCount(blueSteps);

    let emoji = '🍂';
    let conclusion = '';

    if (yellowSteps === 0) {
      emoji = '❄️';
      conclusion = `Все ${bStr} ушли на синие обходы, а жёлтая тропа (${yStr}) осталась нетронутой — зато маршрут получился самым непредсказуемым! Отличный повод поболтать по душам за какао! ☕❄️`;
    } else if (blueSteps === 0) {
      emoji = '🎄';
      conclusion = `Абсолютная точность: ${yStr} по жёлтому пути и ни одного синего поворота (${bStr}). Ты прошёл всю карту с первой попытки — браво! 🎄✨`;
    } else if (yellowSteps > blueSteps && blueSteps <= 2) {
      emoji = '🕯️';
      conclusion = `Почти идеальный маршрут: ${yStr} по жёлтой тропе против всего ${bStr} по синей. Небольшой морозный занос только добавил азарта! 🕯️✨`;
    } else if (yellowSteps > blueSteps) {
      emoji = '🍂';
      conclusion = `Уверенный перевес в пользу верного пути: ${yStr} по жёлтой тропе и ${bStr} по синей. Большинство развилок разгадано чётко, а парочка синих крюков лишь украсила карту! 🍂🕯️`;
    } else if (yellowSteps === blueSteps) {
      emoji = '⚖️';
      conclusion = `Идеальный баланс на развилках: ровно ${yStr} по жёлтому пути и ${bStr} по синему. Половина — точные попадания, половина — смелые обходные манёвры! ⚖️🧣`;
    } else if (yellowSteps >= 2) {
      emoji = '🧭';
      conclusion = `Извилистая экспедиция: ${yStr} по жёлтой тропе и ${bStr} по синей. Синие тропы оказались длиннее, но каждый жёлтый шаг был на вес золота — до ёлки всё равно дошли! 🧭🎄`;
    } else {
      emoji = '🌨️';
      conclusion = `Редкий золотой след среди метели: всего ${yStr} по жёлтой тропе и целых ${bStr} по синей. Зато теперь точно есть что обсудить у тёплого очага! 🌨️☕`;
    }

    return { yellowSteps, blueSteps, total, conclusion, emoji };
  },

  renderFinalMapPreview() {
    const preview = document.getElementById('final-map-preview');
    const sourceSvg = document.getElementById('journey-map-svg');
    if (!preview || !sourceSvg) return;

    const cloned = sourceSvg.cloneNode(true);
    cloned.removeAttribute('id');
    cloned.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    cloned.style.display = 'block';
    cloned.style.width = '100%';
    cloned.style.height = 'auto';

    cloned.querySelectorAll('.js-animated-stroke').forEach(el => {
      el.style.strokeDasharray = 'none';
      el.style.strokeDashoffset = '0';
    });

    const skyRect = cloned.querySelector('rect');
    if (skyRect) {
      skyRect.setAttribute('fill', '#1a243b');
      skyRect.style.opacity = '1';
    }

    cloned.querySelectorAll('#map-mountains-layer polygon').forEach((poly, idx) => {
      poly.style.opacity = '0.9';
      poly.setAttribute('fill', idx % 2 === 1 ? '#f1f5f9' : '#3b4d6b');
    });

    cloned.querySelectorAll('#map-hills-layer path').forEach((hp, idx) => {
      hp.style.opacity = '1';
      hp.setAttribute('fill', idx === 0 ? '#e2e8f0' : '#f8fafc');
    });

    const cabinEl = cloned.querySelector('#festive-cabin');
    if (cabinEl) {
      cabinEl.style.opacity = '1';
      cabinEl.querySelector('rect[fill*="cabinWallGrad"]')?.setAttribute('fill', '#6b3416');
      cabinEl.querySelector('path[fill*="cabinSnowRoof"]')?.setAttribute('fill', '#f8fafc');
    }

    preview.innerHTML = '';
    preview.appendChild(cloned);
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

    const rawPts = this.getMapWaypoints(total, false);
    const waypoints = rawPts.map(pt => ({
      main: { x: Math.round(70 + (pt.main.x / 1200) * 1050), y: Math.round(160 + (pt.main.y / 460) * 340) },
      detour: { x: Math.round(70 + (pt.detour.x / 1200) * 1050), y: Math.min(545, Math.round(160 + (pt.detour.y / 460) * 340)) }
    }));

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
    link.download = `route-map-${playerName.replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    this.showToast('Карта маршрута сохранена в PNG!', '📥');
  }
});