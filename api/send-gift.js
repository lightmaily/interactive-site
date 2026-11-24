const giftRateLimit = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const MAX_GIFTS_PER_WINDOW = 3;

const ALLOWED_GIFTS = new Set([
  '☕ Горячий какао с маршмеллоу',
  '🍊 Корзинка мандаринов',
  '🧣 Тёплый вязаный шарф',
  '🎇 Бенгальские огни'
]);

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const history = (giftRateLimit.get(clientIp) || []).filter(ts => now - ts < RATE_WINDOW_MS);

  if (history.length >= MAX_GIFTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Подарок уже отправлен. Подождите минуту перед следующей отправкой.' });
  }

  const { senderName, quizTitle, score, rating, gift, message } = req.body || {};

  if (!senderName || typeof senderName !== 'string' || senderName.trim().length > 40) {
    return res.status(400).json({ error: 'Некорректное имя отправителя' });
  }

  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: 'Некорректная оценка' });
  }

  const safeGift = ALLOWED_GIFTS.has(gift) ? gift : '🎁 Тёплый праздничный сюрприз';
  const safeSender = escapeHtml(senderName.trim());
  const safeQuizTitle = escapeHtml(String(quizTitle || 'Интерактив').slice(0, 100));
  const safeScore = escapeHtml(String(score || '').slice(0, 120));
  const safeMessage = escapeHtml(String(message || 'Без дополнительного текста').slice(0, 500));

  const apiKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Осенний Интерактив <onboarding@resend.dev>';

  if (!apiKey || !ownerEmail) {
    return res.status(500).json({ error: 'Не заданы RESEND_API_KEY или OWNER_EMAIL в настройках Vercel' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [ownerEmail],
        subject: `🎁 Новый подарок от ${safeSender} (${numericRating}/5 ⭐)`,
        html: `
          <div style="font-family: sans-serif; background-color: #1c120d; color: #fef3c7; padding: 24px; border-radius: 16px;">
            <h2 style="color: #f59e0b; margin-top: 0;">🍂 Пришёл новый подарок с интерактива!</h2>
            <p><strong>Участник:</strong> ${safeSender}</p>
            <p><strong>Интерактив:</strong> ${safeQuizTitle}</p>
            <p><strong>Результат:</strong> ${safeScore}</p>
            <p><strong>Оценка интерактива:</strong> ${numericRating} из 5 ⭐</p>
            <hr style="border-color: #78350f; margin: 16px 0;" />
            <p style="font-size: 18px;"><strong>Выбранный подарок:</strong> ${escapeHtml(safeGift)}</p>
            <p><strong>Пожелание:</strong><br/><em>"${safeMessage}"</em></p>
          </div>
        `
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Ошибка API Resend' });
    }

    history.push(now);
    giftRateLimit.set(clientIp, history);

    return res.status(200).json({ success: true, id: data.id });
  } catch {
    return res.status(500).json({ error: 'Внутренняя ошибка при отправке через Resend' });
  }
}