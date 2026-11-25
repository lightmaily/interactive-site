import { getData, setData, verifyAdminPasscode } from './_storage.js';

function sortEntries(list) {
  return [...list].sort((a, b) => {
    const scoreDiff = (Number(b.score) || 0) - (Number(a.score) || 0);
    if (scoreDiff !== 0) return scoreDiff;
    const durA = typeof a.durationSec === 'number' && a.durationSec > 0 ? a.durationSec : 999999;
    const durB = typeof b.durationSec === 'number' && b.durationSec > 0 ? b.durationSec : 999999;
    return durA - durB;
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
    return res.status(200).json({ leaderboards: boards });
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
    const durationSec = typeof body.durationSec === 'number' && body.durationSec >= 0 ? Math.round(body.durationSec * 10) / 10 : null;

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
      const isBetterScore = score > (Number(prev.score) || 0);
      const isSameScoreFaster =
        score === (Number(prev.score) || 0) &&
        durationSec !== null &&
        (typeof prev.durationSec !== 'number' || durationSec < prev.durationSec);

      if (isBetterScore || isSameScoreFaster) {
        list[idx] = { name, score, total, date, mode, durationSec };
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