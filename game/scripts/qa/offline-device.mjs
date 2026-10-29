import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const bundle = await build({
  entryPoints: ['src/offline/dispatcher.ts'], bundle: true, write: false,
  platform: 'browser', format: 'cjs', target: 'es2022',
  alias: {
    'node:crypto': resolve('src/offline/crypto.ts'),
    'node:fs': resolve('src/offline/fs.ts'),
    'node:path': resolve('src/offline/path.ts'),
  },
  define: { 'process.env': '{}' },
});
const store = new Map();
const localStorage = {
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
};
function app(storage = localStorage) {
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, window: {}, localStorage: storage, crypto: webcrypto,
    TextEncoder, TextDecoder, URL, URLSearchParams, Uint8Array, DataView, setTimeout, clearTimeout, console });
  vm.runInContext(bundle.outputFiles[0].text, context);
  return module.exports.dispatchOffline;
}
const headers = { 'X-Demo-User-Id': '1234', 'X-Demo-Username': 'Tester' };
const first = app();
const init = await first('/api/init', 'POST', {}, headers);
assert.equal(init.data.ok, true, JSON.stringify(init.data));
assert.ok(store.has('hk_offline_save_v1'));
const clicks = await first('/api/click', 'POST', { clicks: 3 }, headers);
assert.equal(clicks.data.ok, true, JSON.stringify(clicks.data));
const saved = JSON.parse(store.get('hk_offline_save_v1'));
const player = Object.values(saved.playersByTgId)[0];
assert.ok(player.totalClicks > 0);
const reload = await app()('/api/init', 'POST', {}, headers);
assert.equal(reload.data.ok, true);
const savedReload = JSON.parse(store.get('hk_offline_save_v1'));
assert.ok(Object.values(savedReload.playersByTgId)[0].totalClicks >= player.totalClicks);
const unavailable = app({ getItem: () => null, setItem: () => { throw new Error('storage full'); } });
const failed = await unavailable('/api/init', 'POST', {}, headers);
assert.equal(failed.data.ok, false, 'storage errors must not be reported as successful saves');
console.log('PASS: offline init, clicks, local save, reload and storage failure without a server');
