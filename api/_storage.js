import fs from 'fs';
import path from 'path';

const MEMORY_STORE = global.__COZY_STORE__ || (global.__COZY_STORE__ = {});
const TMP_DIR = '/tmp/cozy-interactive-store';

const QUIZZES_KEY = 'interactive_site:quizzes:v1';
const LEGACY_QUIZZES_KEY = 'cozy:quizzes';
const LB_V2_PREFIX = 'interactive_site:lb:v2:';

function getKvConfig() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    '';
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    '';
  if (url && token) {
    return { url: url.replace(/\/$/, ''), token };
  }
  return null;
}

async function kvCommand(args) {
  const cfg = getKvConfig();
  if (!cfg) return { ok: false, fallback: true };

  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    });
    if (!res.ok) {
      return { ok: false, fallback: true };
    }
    const data = await res.json();
    return { ok: true, result: data.result };
  } catch {
    return { ok: false, fallback: true };
  }
}

function readLocalFile(key, defaultValue) {
  if (Object.prototype.hasOwnProperty.call(MEMORY_STORE, key)) {
    return JSON.parse(JSON.stringify(MEMORY_STORE[key]));
  }
  try {
    const filePath = path.join(TMP_DIR, `${key}.json`);
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      MEMORY_STORE[key] = parsed;
      return JSON.parse(JSON.stringify(parsed));
    }
  } catch {
    // ignore fs read errors
  }
  return JSON.parse(JSON.stringify(defaultValue));
}

function writeLocalFile(key, value) {
  MEMORY_STORE[key] = JSON.parse(JSON.stringify(value));
  try {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
    const filePath = path.join(TMP_DIR, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  } catch {
    // ignore fs write errors on read-only environments
  }
}

function parseJsonSafe(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeQuizzesPayload(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.quizzes)) return parsed.quizzes;
  if (parsed && typeof parsed === 'object') {
    const vals = Object.values(parsed);
    if (vals.length > 0 && vals.every(v => v && typeof v === 'object' && Array.isArray(v.questions))) {
      return vals;
    }
  }
  return [];
}

function hgetallResultToEntries(result) {
  if (!result) return [];
  const entries = [];

  if (Array.isArray(result)) {
    for (let i = 0; i < result.length; i += 2) {
      const field = result[i];
      const val = parseJsonSafe(result[i + 1], null);
      if (val && typeof val === 'object') {
        entries.push({ name: val.name || String(field), ...val });
      }
    }
    return entries;
  }

  if (typeof result === 'object') {
    for (const [field, rawVal] of Object.entries(result)) {
      const val = parseJsonSafe(rawVal, null);
      if (val && typeof val === 'object') {
        entries.push({ name: val.name || field, ...val });
      }
    }
  }

  return entries;
}

async function readLeaderboardsFromRedis() {
  const keysRes = await kvCommand(['KEYS', `${LB_V2_PREFIX}*`]);
  if (!keysRes.ok || !Array.isArray(keysRes.result)) {
    return null;
  }

  const boards = {};
  for (const fullKey of keysRes.result) {
    if (typeof fullKey !== 'string' || !fullKey.startsWith(LB_V2_PREFIX)) continue;
    const quizId = fullKey.slice(LB_V2_PREFIX.length);
    const hashRes = await kvCommand(['HGETALL', fullKey]);
    if (hashRes.ok) {
      boards[quizId] = hgetallResultToEntries(hashRes.result);
    }
  }
  return boards;
}

async function writeLeaderboardsToRedis(boardsObj) {
  const safeBoards = boardsObj && typeof boardsObj === 'object' ? boardsObj : {};
  let allOk = true;

  for (const [quizId, entries] of Object.entries(safeBoards)) {
    const key = `${LB_V2_PREFIX}${quizId}`;
    await kvCommand(['DEL', key]);

    if (Array.isArray(entries) && entries.length > 0) {
      const hsetArgs = ['HSET', key];
      entries.forEach((entry, idx) => {
        const fieldKey = String(entry?.name || `player_${idx}`).trim().toLowerCase() || `player_${idx}`;
        hsetArgs.push(fieldKey, JSON.stringify(entry));
      });
      const res = await kvCommand(hsetArgs);
      if (!res.ok) allOk = false;
    }
  }

  return allOk;
}

async function getData(key, defaultValue) {
  if (key === 'quizzes') {
    const primaryRes = await kvCommand(['GET', QUIZZES_KEY]);
    if (primaryRes.ok && primaryRes.result !== null && primaryRes.result !== undefined) {
      const parsed = parseJsonSafe(primaryRes.result, []);
      const list = normalizeQuizzesPayload(parsed);
      MEMORY_STORE[key] = list;
      return list;
    }

    const legacyRes = await kvCommand(['GET', LEGACY_QUIZZES_KEY]);
    if (legacyRes.ok && legacyRes.result !== null && legacyRes.result !== undefined) {
      const parsed = parseJsonSafe(legacyRes.result, []);
      const list = normalizeQuizzesPayload(parsed);
      MEMORY_STORE[key] = list;
      return list;
    }

    return readLocalFile(key, defaultValue);
  }

  if (key === 'leaderboards') {
    const redisBoards = await readLeaderboardsFromRedis();
    if (redisBoards && Object.keys(redisBoards).length > 0) {
      MEMORY_STORE[key] = redisBoards;
      return redisBoards;
    }
    return readLocalFile(key, defaultValue);
  }

  const kvRes = await kvCommand(['GET', `cozy:${key}`]);
  if (kvRes.ok) {
    if (kvRes.result === null || kvRes.result === undefined) {
      return JSON.parse(JSON.stringify(defaultValue));
    }
    const parsed = parseJsonSafe(kvRes.result, null);
    if (parsed !== null) {
      MEMORY_STORE[key] = parsed;
      return parsed;
    }
    return JSON.parse(JSON.stringify(defaultValue));
  }

  return readLocalFile(key, defaultValue);
}

async function setData(key, value) {
  writeLocalFile(key, value);

  if (key === 'quizzes') {
    const serialized = JSON.stringify(value);
    const kvRes = await kvCommand(['SET', QUIZZES_KEY, serialized]);
    return {
      persistent: Boolean(kvRes.ok),
      driver: kvRes.ok ? 'redis-kv' : 'tmp-memory'
    };
  }

  if (key === 'leaderboards') {
    const ok = await writeLeaderboardsToRedis(value);
    return {
      persistent: Boolean(ok),
      driver: ok ? 'redis-kv' : 'tmp-memory'
    };
  }

  const serialized = JSON.stringify(value);
  const kvRes = await kvCommand(['SET', `cozy:${key}`, serialized]);
  return {
    persistent: Boolean(kvRes.ok),
    driver: kvRes.ok ? 'redis-kv' : 'tmp-memory'
  };
}

function getStorageStatus() {
  const cfg = getKvConfig();
  return {
    persistent: Boolean(cfg),
    driver: cfg ? 'Vercel KV / Upstash Redis' : 'Server Memory + /tmp (подключите KV_REST_API_URL для вечного хранения)'
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
  const expectedRaw = process.env.ADMIN_PASSCODE || process.env.ADMIN_PASSWORD;
  if (!expectedRaw) return false;
  const input = stripOuterQuotes(passcode);
  const expected = stripOuterQuotes(expectedRaw);
  return input.length > 0 && expected.length > 0 && input === expected;
}

export {
  getData,
  setData,
  getStorageStatus,
  verifyAdminPasscode
};