const LEADERBOARD_HASH_PREFIX = 'interactive_site:lb:v2:';
const MAX_ENTRIES = 50;
const MAX_SCORE = 10_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_POSTS = 20;

const postAttempts = new Map();

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

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const record = postAttempts.get(ip);
  if (!record || now - record.windowStart >= RATE_LIMIT_WINDOW_MS) {
    postAttempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  record.count += 1;
  return record.count > RATE_LIMIT_MAX_POSTS;
}

function sanitizeText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function sanitizeQuizId(value) {
  const clean = sanitizeText(value || 'default', 64).replace(/[^a-zA-Z0-9_-]/g, '_');
  return clean || 'default';
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

function parseHashEntries(hgetallResult) {
  const items = [];
  if (!hgetallResult) return items;

  const pushEntry = (rawValue) => {
    if (!rawValue) return;
    let parsed = rawValue;
    if (typeof rawValue === 'string') {
      try {
        parsed = JSON.parse(rawValue);
      } catch {
        return;
      }
    }
    const name = sanitizeText(parsed.name, 30) || 'Гость';
    const score = Number(parsed.score);
    const total = Number(parsed.total);
    if (!Number.isFinite(score)) return;

    items.push({
      name,
      score: Math.max(0, Math.round(score)),
      total: Number.isFinite(total) && total > 0 ? Math.min(200, Math.round(total)) : 10,
      date: sanitizeText(parsed.date, 30) || 'Недавно',
      updatedAt: parsed.updatedAt || '',
    });
  };

  if (Array.isArray(hgetallResult)) {
    for (let i = 1; i < hgetallResult.length; i += 2) {
      pushEntry(hgetallResult[i]);
    }
  } else if (typeof hgetallResult === 'object') {
    for (const val of Object.values(hgetallResult)) {
      pushEntry(val);
    }
  }

  const sorted = items
    .sort((a, b) => b.score - a.score || String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, MAX_ENTRIES);

  let currentPosition = 0;
  let previousScore = null;

  return sorted.map((entry) => {
    if (previousScore === null || entry.score < previousScore) {
      currentPosition += 1;
      previousScore = entry.score;
    }
    return {
      rank: currentPosition,
      name: entry.name,
      score: entry.score,
      total: entry.total,
      date: entry.date,
    };
  });
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

  const urlObj = new URL(req.url || '/api/leaderboard', 'http://localhost');

  if (req.method === 'GET') {
    try {
      const quizIdParam = urlObj.searchParams.get('quizId');

      if (quizIdParam) {
        const key = `${LEADERBOARD_HASH_PREFIX}${sanitizeQuizId(quizIdParam)}`;
        const data = await upstashPipeline([['HGETALL', key]], redis);
        const leaderboard = parseHashEntries(data?.[0]?.result);
        return res.status(200).json({ quizId: sanitizeQuizId(quizIdParam), leaderboard });
      }

      const keysRes = await upstashPipeline(
        [['KEYS', `${LEADERBOARD_HASH_PREFIX}*`]],
        redis
      );
      const keys = Array.isArray(keysRes?.[0]?.result) ? keysRes[0].result : [];
      const leaderboards = {};

      if (keys.length > 0) {
        const hgetCmds = keys.map((k) => ['HGETALL', k]);
        const boardsRes = await upstashPipeline(hgetCmds, redis);
        keys.forEach((fullKey, idx) => {
          const qId = fullKey.slice(LEADERBOARD_HASH_PREFIX.length);
          leaderboards[qId] = parseHashEntries(boardsRes?.[idx]?.result);
        });
      }

      return res.status(200).json({ leaderboards });
    } catch {
      return res.status(502).json({ error: 'Не удалось загрузить таблицу лидеров' });
    }
  }

  if (req.method === 'POST') {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: 'Слишком много запросов, попробуйте чуть позже' });
    }

    const body = parseBody(req);
    const quizId = sanitizeQuizId(body.quizId);
    const name = sanitizeText(body.name, 30);
    const rawScore = Number(body.score);
    const rawTotal = Number(body.total);
    const total = Number.isFinite(rawTotal) && rawTotal > 0 ? Math.min(200, Math.round(rawTotal)) : 10;

    if (!name) {
      return res.status(400).json({ error: 'Укажите имя игрока' });
    }
    if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > MAX_SCORE) {
      return res.status(400).json({ error: 'Некорректное значение очков' });
    }

    const score = Math.round(rawScore);
    const playerKey = name.toLowerCase();
    const hashKey = `${LEADERBOARD_HASH_PREFIX}${quizId}`;
    const dateStr =
      sanitizeText(body.date, 30) ||
      new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

    try {
      const existingRes = await upstashPipeline([['HGET', hashKey, playerKey]], redis);
      let bestScore = score;
      let bestTotal = total;
      let bestDate = dateStr;

      const prevRaw = existingRes?.[0]?.result;
      if (prevRaw) {
        try {
          const prev = typeof prevRaw === 'string' ? JSON.parse(prevRaw) : prevRaw;
          const prevScore = Number(prev.score);
          if (Number.isFinite(prevScore) && prevScore > score) {
            bestScore = prevScore;
            bestTotal = Number(prev.total) || total;
            bestDate = sanitizeText(prev.date, 30) || dateStr;
          }
        } catch {
          // игнорируем битую старую запись
        }
      }

      const entryPayload = JSON.stringify({
        name,
        score: bestScore,
        total: bestTotal,
        date: bestDate,
        updatedAt: new Date().toISOString(),
      });

      const writeRes = await upstashPipeline(
        [
          ['HSET', hashKey, playerKey, entryPayload],
          ['HGETALL', hashKey],
        ],
        redis
      );

      const leaderboard = parseHashEntries(writeRes?.[1]?.result);
      return res.status(200).json({ ok: true, quizId, leaderboard });
    } catch {
      return res.status(502).json({ error: 'Не удалось сохранить результат' });
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: 'Метод не поддерживается' });
}