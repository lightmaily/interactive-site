import crypto from 'node:crypto';

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const BLOCK_WINDOW_MS = 15 * 60 * 1000;

const ADMIN_FORM_HTML = `
  <form id="create-quiz-form" class="space-y-5">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-medium text-amber-200 mb-1">Название интерактива</label>
        <input type="text" id="new-quiz-title" required maxlength="80" placeholder="Например: Узнай меня лучше!" class="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-amber-500/30 text-amber-100 text-sm">
      </div>
      <div>
        <label class="block text-xs font-medium text-amber-200 mb-1">Сезонный тег</label>
        <select id="new-quiz-badge" class="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-amber-500/30 text-amber-100 text-sm">
          <option value="🍂 Осенний вайб">🍂 Осенний вайб</option>
          <option value="🎄 Новогодний спецвыпуск">🎄 Новогодний спецвыпуск</option>
          <option value="❄️ Предновогодняя магия">❄️ Предновогодняя магия</option>
          <option value="🕯️ Уютный вечер">🕯️ Уютный вечер</option>
        </select>
      </div>
    </div>

    <div>
      <label class="block text-xs font-medium text-amber-200 mb-1">Короткое описание</label>
      <input type="text" id="new-quiz-desc" required maxlength="180" placeholder="Ответь на 10 вопросов обо мне и пройди карту до конца!" class="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-amber-500/30 text-amber-100 text-sm">
    </div>

    <div class="pt-2">
      <h3 class="font-serif text-xl font-bold text-amber-300">10 вопросов интерактива</h3>
    </div>

    <div id="admin-questions-list" class="space-y-4 max-h-[45vh] overflow-y-auto pr-1"></div>

    <div class="pt-3 border-t border-amber-500/20 flex justify-end gap-3">
      <button type="button" onclick="app.toggleAdminModal()" class="px-4 py-2.5 rounded-xl bg-stone-800 text-amber-200 text-sm cursor-pointer">Отмена</button>
      <button type="submit" class="cozy-btn text-stone-950 font-bold px-6 py-2.5 rounded-xl text-sm cursor-pointer">Опубликовать на главную ✨</button>
    </div>
  </form>
`;

function safeCompare(input, secret) {
  const a = Buffer.from(String(input));
  const b = Buffer.from(String(secret));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizeEnvSecret(raw) {
  if (typeof raw !== 'string') return '';
  let val = raw.trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const record = loginAttempts.get(clientIp);

  if (record && record.count >= MAX_ATTEMPTS && now - record.firstAttempt < BLOCK_WINDOW_MS) {
    return res.status(429).json({ error: 'Слишком много попыток. Попробуйте через 15 минут.' });
  }

  const { passcode } = req.body || {};
  const validPasscode = normalizeEnvSecret(process.env.ADMIN_PASSCODE);

  if (!validPasscode) {
    return res.status(500).json({ error: 'ADMIN_PASSCODE не настроен в переменных окружения Vercel' });
  }

  if (typeof passcode === 'string' && passcode.length <= 128 && safeCompare(passcode.trim(), validPasscode)) {
    loginAttempts.delete(clientIp);
    return res.status(200).json({
      authorized: true,
      adminHtml: ADMIN_FORM_HTML
    });
  }

  if (!record || now - record.firstAttempt >= BLOCK_WINDOW_MS) {
    loginAttempts.set(clientIp, { count: 1, firstAttempt: now });
  } else {
    record.count += 1;
  }

  return res.status(401).json({ error: 'Неверный код доступа' });
}