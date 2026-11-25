import fs from 'fs';
import path from 'path';

const MEMORY_STORE = global.__COZY_STORE__ || (global.__COZY_STORE__ = {});
const TMP_DIR = '/tmp/cozy-interactive-store';

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

async function getData(key, defaultValue) {
  const kvRes = await kvCommand(['GET', `cozy:${key}`]);
  if (kvRes.ok) {
    if (kvRes.result === null || kvRes.result === undefined) {
      return JSON.parse(JSON.stringify(defaultValue));
    }
    try {
      const parsed = typeof kvRes.result === 'string' ? JSON.parse(kvRes.result) : kvRes.result;
      MEMORY_STORE[key] = parsed;
      return parsed;
    } catch {
      return JSON.parse(JSON.stringify(defaultValue));
    }
  }
  return readLocalFile(key, defaultValue);
}

async function setData(key, value) {
  writeLocalFile(key, value);
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
  const expectedRaw = process.env.ADMIN_PASSCODE || process.env.ADMIN_PASSWORD || 'cozy2026';
  const input = stripOuterQuotes(passcode);
  const expected = stripOuterQuotes(expectedRaw);
  return input.length > 0 && input === expected;
}

export {
  getData,
  setData,
  getStorageStatus,
  verifyAdminPasscode
};

