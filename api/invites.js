const crypto = require('crypto');
const { getData, setData, verifyAdminPasscode } = require('./_storage');

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[crypto.randomInt(0, chars.length)];
    part2 += chars[crypto.randomInt(0, chars.length)];
  }
  return `COZY-${part1}-${part2}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const passcode = req.query && req.query.passcode;
    if (!verifyAdminPasscode(passcode)) {
      return res.status(401).json({ error: 'Неверный пароль администратора' });
    }
    const invites = await getData('invites', []);
    return res.status(200).json({ invites });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = req.body || {};
  const action = String(body.action || 'redeem');

  if (action === 'generate') {
    if (!verifyAdminPasscode(body.passcode)) {
      return res.status(401).json({ error: 'Неверный пароль администратора' });
    }

    const invites = await getData('invites', []);
    let code = generateInviteCode();
    while (invites.some(item => item.code === code)) {
      code = generateInviteCode();
    }

    const note = String(body.note || '').trim().slice(0, 80);
    const newInvite = {
      code,
      note,
      status: 'active', // 'active' | 'redeemed' | 'completed' | 'revoked'
      createdAt: new Date().toISOString(),
      redeemedAt: null,
      quizId: null,
      quizTitle: null,
      ownerTokenHash: null
    };

    invites.unshift(newInvite);
    await setData('invites', invites);
    return res.status(200).json({ invite: newInvite, invites });
  }

  if (action === 'revoke') {
    if (!verifyAdminPasscode(body.passcode)) {
      return res.status(401).json({ error: 'Неверный пароль администратора' });
    }
    const targetCode = String(body.code || '').trim().toUpperCase();
    const invites = await getData('invites', []);
    const idx = invites.findIndex(item => item.code === targetCode);
    if (idx === -1) {
      return res.status(404).json({ error: 'Инвайт-код не найден' });
    }
    invites[idx].status = 'revoked';
    await setData('invites', invites);
    return res.status(200).json({ invites });
  }

  if (action === 'redeem') {
    const rawCode = String(body.code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ error: 'Введите инвайт-код' });
    }

    const invites = await getData('invites', []);
    const idx = invites.findIndex(item => item.code === rawCode);
    if (idx === -1) {
      return res.status(404).json({ error: 'Такой инвайт-код не найден' });
    }

    const invite = invites[idx];
    if (invite.status === 'revoked') {
      return res.status(403).json({ error: 'Этот инвайт-код был отозван автором' });
    }
    if (invite.status === 'completed' || invite.quizId) {
      return res.status(403).json({ error: 'По этому коду интерактив уже создан (лимит: 1 интерактив на код)' });
    }

    const ownerToken = crypto.randomBytes(24).toString('hex');
    invite.status = 'redeemed';
    invite.redeemedAt = new Date().toISOString();
    invite.ownerTokenHash = hashToken(ownerToken);

    invites[idx] = invite;
    await setData('invites', invites);

    return res.status(200).json({
      ok: true,
      code: invite.code,
      ownerToken,
      canCreate: true
    });
  }

  if (action === 'verify-owner') {
    const quizId = String(body.quizId || '').trim();
    const ownerToken = String(body.ownerToken || '').trim();
    if (!quizId || !ownerToken) {
      return res.status(200).json({ isOwner: false });
    }

    const quizzes = await getData('quizzes', []);
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz || !quiz.ownerTokenHash) {
      return res.status(200).json({ isOwner: false });
    }

    const isOwner = quiz.ownerTokenHash === hashToken(ownerToken);
    return res.status(200).json({ isOwner });
  }

  return res.status(400).json({ error: 'Неизвестное действие' });
};
