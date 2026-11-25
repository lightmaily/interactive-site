function getStorageStatus() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    '';
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    '';
  const persistent = Boolean(url && token);

  return {
    persistent,
    driver: persistent
      ? 'Vercel KV / Upstash Redis'
      : 'Server Memory + /tmp (подключите KV_REST_API_URL для вечного хранения)'
  };
}

function stripOuterQuotes(value) {
  const s = String(value ?? '').trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function verifyAdminPasscode(passcode) {
  const expectedRaw = process.env.ADMIN_PASSCODE || process.env.ADMIN_PASSWORD || 'cozy2026';
  const input = stripOuterQuotes(passcode);
  const expected = stripOuterQuotes(expectedRaw);
  return input.length > 0 && input === expected;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = body.trim() ? JSON.parse(body) : {};
    } catch {
      return res.status(400).json({ error: 'Некорректный формат запроса' });
    }
  }

  if (!verifyAdminPasscode(body.passcode)) {
    return res.status(401).json({ error: 'Неверный пароль доступа' });
  }

  return res.status(200).json({
    authorized: true,
    storage: getStorageStatus()
  });
}