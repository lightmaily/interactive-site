const QUIZZES_KEY = 'interactive_site:quizzes:v1';
const MAX_QUIZZES = 100;

function cleanEnvValue(val) {
  if (typeof val !== 'string') return '';
  let trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function getRedisConfig() {
  const url = cleanEnvValue(process.env.UPSTASH_REDIS_REST_URL);
  const token = cleanEnvValue(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

function getAdminPasscode() {
  return cleanEnvValue(process.env.ADMIN_PASSCODE);
}

async function upstashPipeline(commands, config) {
  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Upstash HTTP ${response.status}: ${text.slice(0, 160)}`);
  }

  return response.json();
}

function sanitizeText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function normalizeQuiz(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = sanitizeText(raw.title, 120);
  const badge = sanitizeText(raw.badge, 40) || 'Интерактив';
  const description = sanitizeText(raw.description, 400);
  const idRaw = sanitizeText(raw.id, 64).replace(/[^a-zA-Z0-9_-]/g, '_');
  const id = idRaw || `quiz-${Date.now()}`;

  if (!title || !Array.isArray(raw.questions) || raw.questions.length === 0) {
    return null;
  }

  const questions = [];
  for (const item of raw.questions.slice(0, 30)) {
    if (!item || typeof item !== 'object') continue;
    const q = sanitizeText(item.q, 240);
    const opts = Array.isArray(item.options)
      ? item.options.slice(0, 4).map((o) => sanitizeText(o, 120))
      : [];
    const correctNum = Number(item.correct);
    const correct = Number.isInteger(correctNum) && correctNum >= 0 && correctNum < opts.length
      ? correctNum
      : 0;

    if (q && opts.length >= 2 && opts.every(Boolean)) {
      questions.push({ q, options: opts, correct });
    }
  }

  if (questions.length === 0) return null;
  return { id, title, badge, description, questions };
}

function parseQuizzesFromRedis(rawValue) {
  if (!rawValue) return [];
  let parsed = rawValue;
  if (typeof rawValue === 'string') {
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeQuiz).filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(204).end();
  }

  const redis = getRedisConfig();
  if (!redis) {
    return res.status(500).json({
      error: 'Upstash Redis не настроен (проверьте UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN)',
    });
  }

  if (req.method === 'GET') {
    try {
      const data = await upstashPipeline([['GET', QUIZZES_KEY]], redis);
      const quizzes = parseQuizzesFromRedis(data?.[0]?.result);
      return res.status(200).json({ quizzes });
    } catch {
      return res.status(502).json({ error: 'Не удалось загрузить квизы' });
    }
  }

  if (req.method === 'POST') {
    const adminPasscode = getAdminPasscode();
    const body = parseBody(req);
    const providedPasscode = cleanEnvValue(body.passcode || req.headers?.['x-admin-passcode'] || '');

    if (!adminPasscode) {
      return res.status(500).json({ error: 'Не задан ADMIN_PASSCODE на сервере' });
    }
    if (!providedPasscode || providedPasscode !== adminPasscode) {
      return res.status(401).json({ error: 'Неверный код администратора' });
    }

    const newQuiz = normalizeQuiz(body.quiz || body);
    if (!newQuiz) {
      return res.status(400).json({ error: 'Заполните название, вопросы и варианты ответа' });
    }

    try {
      const existingRes = await upstashPipeline([['GET', QUIZZES_KEY]], redis);
      const currentList = parseQuizzesFromRedis(existingRes?.[0]?.result);
      const filtered = currentList.filter((q) => q.id !== newQuiz.id);
      const updatedList = [newQuiz, ...filtered].slice(0, MAX_QUIZZES);

      await upstashPipeline(
        [['SET', QUIZZES_KEY, JSON.stringify(updatedList)]],
        redis
      );

      return res.status(200).json({ ok: true, quiz: newQuiz, quizzes: updatedList });
    } catch {
      return res.status(502).json({ error: 'Не удалось сохранить квиз в базе' });
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: 'Метод не поддерживается' });
}