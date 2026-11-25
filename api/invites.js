import crypto from 'crypto';
import { getData, setData, verifyAdminPasscode } from './_storage.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
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
    return res.status(200).json({ invites });
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
      if (!inv || inv.revoked || inv.status === 'revoked') {
        return res.status(200).json({ valid: false, reason: 'revoked' });
      }
      if (inv.ownerTokenHash !== hashToken(ownerToken)) {
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
      if (!code) {
        return res.status(400).json({ error: 'Введите инвайт-код' });
      }

      const invites = await getData('invites', []);
      const idx = invites.findIndex(inv => inv.code === code);
      if (idx === -1) {
        return res.status(404).json({ error: 'Инвайт-код не найден' });
      }

      const inv = invites[idx];
      if (inv.revoked || inv.status === 'revoked') {
        return res.status(403).json({ error: 'Этот инвайт-код был отозван администратором' });
      }

      const ownerToken = crypto.randomBytes(24).toString('hex');
      inv.ownerTokenHash = hashToken(ownerToken);
      if (!inv.quizId) {
        inv.status = 'redeemed';
      }
      inv.redeemedAt = new Date().toISOString();

      await setData('invites', invites);
      return res.status(200).json({
        ok: true,
        code: inv.code,
        ownerToken,
        ownedQuizId: inv.quizId || null
      });
    }

    if (action === 'create') {
      if (!verifyAdminPasscode(body.passcode)) {
        return res.status(401).json({ error: 'Неверный пароль администратора' });
      }
      const invites = await getData('invites', []);
      const code = generateInviteCode();
      const note = String(body.note || '').trim().slice(0, 80);

      invites.unshift({
        code,
        note,
        status: 'active',
        createdAt: new Date().toISOString(),
        quizId: null,
        quizTitle: null,
        ownerTokenHash: null
      });

      await setData('invites', invites);
      return res.status(200).json({ ok: true, code, invites });
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