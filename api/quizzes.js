import crypto from 'crypto';
import { getData, setData, getStorageStatus, verifyAdminPasscode } from './_storage.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function isInviteRevoked(inv) {
  return !inv || Boolean(inv.revoked) || inv.status === 'revoked';
}

function sanitizeQuizPayload(rawQuiz, existingQuiz = null) {
  const title = String(rawQuiz.title || '').trim().slice(0, 120);
  const badge = String(rawQuiz.badge || '🍂 Осенний вечер').trim().slice(0, 50);
  const description = String(rawQuiz.description || '').trim().slice(0, 400);
  const author = String(rawQuiz.author || (existingQuiz && existingQuiz.author) || 'Iakov').trim().slice(0, 40);
  const timerSeconds = Math.max(0, Math.min(180, Number(rawQuiz.timerSeconds) || 0));

  if (!title || !description) {
    return { error: 'Заполните название и описание интерактива' };
  }

  const rawQuestions = Array.isArray(rawQuiz.questions) ? rawQuiz.questions : [];
  if (rawQuestions.length < 3 || rawQuestions.length > 30) {
    return { error: 'Количество вопросов должно быть от 3 до 30' };
  }

  const questions = [];
  for (let i = 0; i < rawQuestions.length; i++) {
    const item = rawQuestions[i] || {};
    const q = String(item.q || '').trim().slice(0, 240);
    const opts = Array.isArray(item.options) ? item.options.map(o => String(o || '').trim().slice(0, 120)) : [];
    const correct = Number(item.correct);

    if (
      !q ||
      opts.length < 2 ||
      opts.length > 6 ||
      opts.some(o => !o) ||
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct >= opts.length
    ) {
      return { error: `Проверьте заполнение вопроса #${i + 1} (нужно от 2 до 6 непустых вариантов)` };
    }
    questions.push({ q, options: opts, correct });
  }

  return {
    quiz: {
      id: existingQuiz ? existingQuiz.id : (String(rawQuiz.id || '').trim() || `quiz-${Date.now()}`),
      title,
      badge,
      description,
      author,
      timerSeconds,
      hidden: existingQuiz ? Boolean(existingQuiz.hidden) : false,
      createdAt: existingQuiz ? existingQuiz.createdAt : (rawQuiz.createdAt || new Date().toISOString()),
      updatedAt: new Date().toISOString(),
      inviteCode: existingQuiz ? (existingQuiz.inviteCode || null) : (rawQuiz.inviteCode || null),
      ownerTokenHash: existingQuiz ? (existingQuiz.ownerTokenHash || null) : null,
      questions
    }
  };
}

function stripSecrets(quiz) {
  const { ownerTokenHash, ...publicFields } = quiz;
  return publicFields;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const quizzes = await getData('quizzes', []);
    const includeHidden = req.query && req.query.includeHidden === '1' && verifyAdminPasscode(req.query.passcode);
    const filtered = includeHidden ? quizzes : quizzes.filter(q => !q.hidden);
    return res.status(200).json({
      quizzes: filtered.map(stripSecrets),
      storage: getStorageStatus()
    });
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
    const isAdmin = verifyAdminPasscode(body.passcode);
    const inviteCode = String(body.inviteCode || '').trim().toUpperCase();
    const ownerToken = String(body.ownerToken || '').trim();

    let matchedInviteIdx = -1;
    let invites = [];

    if (!isAdmin) {
      if (!inviteCode || !ownerToken) {
        return res.status(401).json({ error: 'Нужен пароль админа или активированный инвайт-код' });
      }
      invites = await getData('invites', []);
      matchedInviteIdx = invites.findIndex(inv => inv.code === inviteCode);
      if (matchedInviteIdx === -1) {
        return res.status(403).json({ error: 'Инвайт-код не найден' });
      }
      const inv = invites[matchedInviteIdx];
      if (isInviteRevoked(inv)) {
        return res.status(403).json({ error: 'Этот инвайт-код отозван администратором' });
      }
      if (inv.status === 'completed' || inv.quizId) {
        return res.status(403).json({ error: 'По этому инвайт-коду уже создан интерактив (лимит: 1 шт.)' });
      }
      if (inv.status !== 'redeemed' || inv.ownerTokenHash !== hashToken(ownerToken)) {
        return res.status(403).json({ error: 'Недействительный токен владельца для этого кода' });
      }
    }

    const parsed = sanitizeQuizPayload(body.quiz || {});
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const newQuiz = parsed.quiz;
    if (!isAdmin) {
      newQuiz.inviteCode = inviteCode;
      newQuiz.ownerTokenHash = hashToken(ownerToken);
    }

    const quizzes = await getData('quizzes', []);
    quizzes.unshift(newQuiz);
    await setData('quizzes', quizzes);

    if (!isAdmin && matchedInviteIdx !== -1) {
      invites[matchedInviteIdx].status = 'completed';
      invites[matchedInviteIdx].quizId = newQuiz.id;
      invites[matchedInviteIdx].quizTitle = newQuiz.title;
      await setData('invites', invites);
    }

    return res.status(200).json({
      ok: true,
      quiz: stripSecrets(newQuiz),
      quizzes: quizzes.filter(q => !q.hidden).map(stripSecrets)
    });
  }

  if (req.method === 'PUT') {
    const isAdmin = verifyAdminPasscode(body.passcode);
    const ownerToken = String(body.ownerToken || '').trim();
    const rawQuiz = body.quiz || {};
    const targetId = String(rawQuiz.id || body.quizId || '').trim();

    if (!targetId) {
      return res.status(400).json({ error: 'Не указан ID интерактива' });
    }

    const quizzes = await getData('quizzes', []);
    const idx = quizzes.findIndex(q => q.id === targetId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Интерактив не найден' });
    }

    const existing = quizzes[idx];
    let isOwner = Boolean(existing.ownerTokenHash && ownerToken && existing.ownerTokenHash === hashToken(ownerToken));

    if (isOwner && existing.inviteCode) {
      const invites = await getData('invites', []);
      const inv = invites.find(item => item.code === existing.inviteCode);
      if (isInviteRevoked(inv)) {
        isOwner = false;
      }
    }

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Доступ отозван или редактировать может только владелец' });
    }

    if (isAdmin && typeof body.hidden === 'boolean' && !body.quiz) {
      quizzes[idx].hidden = body.hidden;
      quizzes[idx].updatedAt = new Date().toISOString();
      await setData('quizzes', quizzes);
      return res.status(200).json({
        ok: true,
        quizzes: quizzes.map(stripSecrets)
      });
    }

    const parsed = sanitizeQuizPayload(rawQuiz, existing);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    quizzes[idx] = parsed.quiz;
    await setData('quizzes', quizzes);

    return res.status(200).json({
      ok: true,
      quiz: stripSecrets(parsed.quiz),
      quizzes: (isAdmin ? quizzes : quizzes.filter(q => !q.hidden)).map(stripSecrets)
    });
  }

  if (req.method === 'DELETE') {
    if (!verifyAdminPasscode(body.passcode)) {
      return res.status(401).json({ error: 'Неверный пароль администратора' });
    }
    const targetId = String(body.quizId || '').trim();
    const quizzes = await getData('quizzes', []);
    const filtered = quizzes.filter(q => q.id !== targetId);
    await setData('quizzes', filtered);

    const boards = await getData('leaderboards', {});
    if (boards[targetId]) {
      delete boards[targetId];
      await setData('leaderboards', boards);
    }

    return res.status(200).json({
      ok: true,
      quizzes: filtered.map(stripSecrets)
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}