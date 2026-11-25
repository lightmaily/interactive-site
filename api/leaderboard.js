import { getData, setData, verifyAdminPasscode } from './_storage.js';

function sortEntries(list) {
  return [...list].sort((a, b) => {
    const scoreDiff = (Number(b?.score) || 0) - (Number(a?.score) || 0);
    if (scoreDiff !== 0) return scoreDiff;

    const aHasTime = typeof a?.durationSec === 'number' && Number.isFinite(a.durationSec) && a.durationSec >= 0;
    const bHasTime = typeof b?.durationSec === 'number' && Number.isFinite(b.durationSec) && b.durationSec >= 0;

    if (aHasTime && bHasTime) return a.durationSec - b.durationSec;
    if (aHasTime) return -1;
    if (bHasTime) return 1;
    return 0;
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const boards = await getData('leaderboards', {});
    const quizId = req.query && req.query.quizId;
    if (quizId) {
      return res.status(200).json({ leaderboard: sortEntries(boards[quizId] || []) });
    }

    const sortedBoards = {};
    if (boards && typeof boards === 'object') {
      for (const [key, list] of Object.entries(boards)) {
        sortedBoards[key] = Array.isArray(list) ? sortEntries(list) : [];
      }
    }
    return res.status(200).json({ leaderboards: sortedBoards });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = body.trim() ? JSON.parse(body) : {};
    } catch {
      return res.status(400).json({ error: 'Некорректный формат запроса' });
    }
  }

  if (req.method === 'POST') {
    const quizId = String(body.quizId || '').trim();
    const name = String(body.name || 'Гость').trim().slice(0, 24);
    const score = Math.max(0, Number(body.score) || 0);
    const total = Math.max(1, Number(body.total) || 10);
    const date = String(body.date || '').trim() || new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const mode = body.mode === 'speed' ? 'speed' : 'relaxed';
    const durationSec = typeof body.durationSec === 'number' && Number.isFinite(body.durationSec) && body.durationSec >= 0
      ? Math.round(body.durationSec * 10) / 10
      : null;

    if (!quizId) {
      return res.status(400).json({ error: 'quizId обязателен' });
    }

    const boards = await getData('leaderboards', {});
    if (!Array.isArray(boards[quizId])) {
      boards[quizId] = [];
    }

    const list = boards[quizId];
    const idx = list.findIndex(item => String(item.name || '').toLowerCase() === name.toLowerCase());

    if (idx !== -1) {
      const prev = list[idx];
      const prevScore = Number(prev.score) || 0;
      const prevDur = typeof prev.durationSec === 'number' && Number.isFinite(prev.durationSec) ? prev.durationSec : null;

      if (score > prevScore) {
        list[idx] = {
          name,
          score,
          total,
          date,
          mode: durationSec !== null ? mode : (prev.mode || mode),
          durationSec: durationSec !== null ? durationSec : prevDur
        };
      } else if (score === prevScore && durationSec !== null && (prevDur === null || durationSec < prevDur)) {
        list[idx] = {
          name,
          score,
          total,
          date,
          mode: 'speed',
          durationSec
        };
      }
    } else {
      list.push({ name, score, total, date, mode, durationSec });
    }

    boards[quizId] = sortEntries(list).slice(0, 100);
    await setData('leaderboards', boards);

    return res.status(200).json({ leaderboard: boards[quizId] });
  }

  if (req.method === 'DELETE') {
    if (!verifyAdminPasscode(body.passcode)) {
      return res.status(401).json({ error: 'Неверный пароль администратора' });
    }
    const quizId = String(body.quizId || '').trim();
    const boards = await getData('leaderboards', {});
    if (quizId) {
      boards[quizId] = [];
      await setData('leaderboards', boards);
    }
    return res.status(200).json({ ok: true, leaderboard: [] });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}