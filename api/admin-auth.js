const { verifyAdminPasscode, getStorageStatus } = require('./_storage');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = req.body || {};
  if (!verifyAdminPasscode(body.passcode)) {
    return res.status(401).json({ error: 'Неверный пароль доступа' });
  }
  return res.status(200).json({
    authorized: true,
    storage: getStorageStatus()
  });
};
