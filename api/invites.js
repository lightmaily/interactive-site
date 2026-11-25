import crypto from 'crypto';
import { getData, setData, verifyAdminPasscode } from './_storage.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function isInviteRevoked(inv) {
  return !inv || Boolean(inv.revoked) || inv.status === 'revoked';
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[Math.floor(Math.random() * chars.length)];
    part2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `COZY-${part1}-${part2}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = body.trim() ? JSON.parse(body) : {};
    } catch {
      return res.status(400).json({ error: 'Некорректный формат запроса' });
    }
  }

  if (req.method === 'GET') {
    if (!verifyAdminPasscode(req.query?.passcode)) {
      return res.status(401).json({ error: 'Неверный пароль администратора' });
    }
    const invites = await getData('invites', []);
    const quizzes = await getData('quizzes', []);
    const quizMap = new Map(quizzes.map(q => [q.id, q]));

    const enriched = invites.map(inv => {
      const linkedQuiz = inv.quizId ? quizMap.get(inv.quizId) : null;
      return {
        ...inv,
        usedBy: linkedQuiz?.author || inv.usedBy || inv.redeemedBy || null,
        quizTitle: linkedQuiz?.title || inv.quizTitle || null
      };
    });

    return res.status(200).json({ invites: enriched });
  }

  if (req.method === 'POST') {
    const action = String(body.action || '').trim();

    if (action === 'verify') {
      const code = String(body.code || '').trim().toUpperCase();
      const ownerToken = String(body.ownerToken || '').trim();
      if (!code || !ownerToken) {
        return res.status(200).json({ valid: false });
      }

      const invites = await getData('invites', []);
      const inv = invites.find(item => item.code === code);
      if (isInviteRevoked(inv)) {
        return res.status(200).json({ valid: false, reason: 'revoked' });
      }
      if (!inv.ownerTokenHash || inv.ownerTokenHash !== hashToken(ownerToken)) {
        return res.status(200).json({ valid: false, reason: 'invalid_token' });
      }

      return res.status(200).json({
        valid: true,
        code: inv.code,
        ownedQuizId: inv.quizId || null
      });
    }

    if (action === 'redeem') {
      const code = String(body.code || '').trim().toUpperCase();
      const username = String(body.username || '').trim().slice(0, 40);
      if (!code) {
        return res.status(400).json({ error: 'Введите инвайт-код' });
      }

      const invites = await getData('invites', []);
      const idx = invites.findIndex(inv => inv.code === code);
      if (idx === -1) {
        return res.status(404).json({ error: 'Инвайт-код не найден' });
      }

      const inv = invites[idx];
      if (isInviteRevoked(inv)) {
        return res.status(403).json({ error: 'Этот инвайт-код был отозван администратором' });
      }
      if (inv.status === 'completed' || inv.quizId) {
        return res.status(403).json({ error: 'Этот инвайт-код уже использован' });
      }
      if (inv.status === 'redeemed' || inv.ownerTokenHash) {
        return res.status(403).json({ error: 'Этот инвайт-код уже активирован' });
      }

      const ownerToken = crypto.randomBytes(24).toString('hex');
      inv.status = 'redeemed';
      inv.ownerTokenHash = hashToken(ownerToken);
      inv.redeemedAt = new Date().toISOString();
      inv.redeemedBy = username || null;

      await setData('invites', invites);
      return res.status(200).json({
        ok: true,
        code: inv.code,
        ownerToken,
        ownedQuizId: null
      });
    }

    if (action === 'create' || action === 'generate') {
      if (!verifyAdminPasscode(body.passcode)) {
        return res.status(401).json({ error: 'Неверный пароль администратора' });
      }
      const invites = await getData('invites', []);
      const code = generateInviteCode();
      const note = String(body.note || '').trim().slice(0, 80);

      const newInvite = {
        code,
        note,
        status: 'active',
        revoked: false,
        createdAt: new Date().toISOString(),
        redeemedAt: null,
        redeemedBy: null,
        usedBy: null,
        quizId: null,
        quizTitle: null,
        ownerTokenHash: null
      };

      invites.unshift(newInvite);
      await setData('invites', invites);
      return res.status(200).json({ ok: true, code, invite: newInvite, invites });
    }

    if (action === 'revoke') {
      if (!verifyAdminPasscode(body.passcode)) {
        return res.status(401).json({ error: 'Неверный пароль администратора' });
      }
      const code = String(body.code || '').trim().toUpperCase();
      const invites = await getData('invites', []);
      const idx = invites.findIndex(inv => inv.code === code);
      if (idx === -1) {
        return res.status(404).json({ error: 'Инвайт-код не найден' });
      }

      invites[idx].status = 'revoked';
      invites[idx].revoked = true;
      invites[idx].ownerTokenHash = null;
      invites[idx].revokedAt = new Date().toISOString();

      await setData('invites', invites);
      return res.status(200).json({ ok: true, invites });
    }

    return res.status(400).json({ error: 'Неизвестное действие' });
  }

  if (req.method === 'DELETE') {
    if (!verifyAdminPasscode(body.passcode)) {
      return res.status(401).json({ error: 'Неверный пароль администратора' });
    }
    const code = String(body.code || '').trim().toUpperCase();
    const invites = await getData('invites', []);
    const filtered = invites.filter(inv => inv.code !== code);
    await setData('invites', filtered);
    return res.status(200).json({ ok: true, invites: filtered });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}