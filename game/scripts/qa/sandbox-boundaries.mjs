// Smoke test for the *test sandbox*, not an authentication or security audit.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = resolve('api/_core.cjs');
const temp = mkdtempSync(join(tmpdir(), 'hk-boundaries-'));
process.chdir(temp);
// Even if somebody supplies these, the sandbox must not connect to an external DB
// or use a Telegram bot token. These are dummy values, never real credentials.
process.env.SUPABASE_URL = 'https://invalid.example';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-test-key';
process.env.BOT_TOKEN = '123456789:AAFakeTokenForSandboxTests_12345678';
process.env.STRICT_TELEGRAM_AUTH = 'true';
delete process.env.HK_SANDBOX_DB_DIR;
const { dispatchApiRequest } = require(core);

async function request(route) {
  const req = {
    url: `/api/${route}`, method: 'POST', body: {},
    headers: { host: 'localhost:5173', 'x-demo-user-id': '101234', 'x-demo-username': 'Tester', 'x-telegram-init-data': 'untrusted-data' },
    socket: { remoteAddress: '127.0.0.1' }, on() {},
  };
  const res = { statusCode: 200, payload: '', setHeader() {}, end(chunk) { this.payload = chunk ?? ''; } };
  await dispatchApiRequest(req, res);
  return { status: res.statusCode, body: JSON.parse(res.payload) };
}

try {
  const init = await request('init');
  assert.equal(init.status, 200);
  assert.equal(init.body.ok, true);
  assert.equal(init.body.storageMode, 'memory-fallback');
  for (const route of ['donate', 'telegram', 'referral']) {
    assert.equal((await request(route)).status, 404, `${route} must be disabled`);
  }
  console.log('PASS: isolated memory mode; Telegram, donation and referral routes disabled');
} finally {
  process.chdir(tmpdir());
  rmSync(temp, { recursive: true, force: true });
}
