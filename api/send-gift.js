export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.GIFT_TO_EMAIL || process.env.ADMIN_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Cozy Quiz <onboarding@resend.dev>';

  if (!apiKey || !toEmail) {
    return res.status(200).json({
      ok: true,
      simulated: true,
      note: 'Добавьте RESEND_API_KEY и GIFT_TO_EMAIL в переменные окружения Vercel для отправки писем'
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

  const { senderName, quizTitle, score, rating, gift, message } = body;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `🎁 Новый подарок от ${senderName || 'Гостя'} (${rating || 5}⭐) — ${quizTitle || 'Интерактив'}`,
        html: `
          <h2>Новый отзыв и подарок!</h2>
          <p><strong>Игрок:</strong> ${senderName || 'Гость'}</p>
          <p><strong>Интерактив:</strong> ${quizTitle || 'Без названия'}</p>
          <p><strong>Результат:</strong> ${score || '-'}</p>
          <p><strong>Оценка:</strong> ${rating || 5} / 5 ⭐</p>
          <p><strong>Подарок:</strong> ${gift || '☕ Какао'}</p>
          <p><strong>Сообщение:</strong> ${message || 'Без текста'}</p>
        `
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(502).json({ error: errData.message || 'Ошибка Resend API' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Внутренняя ошибка отправки' });
  }
}