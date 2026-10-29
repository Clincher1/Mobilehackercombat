import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const game = resolve(root, 'game');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const args of [['ci', '--ignore-scripts', '--no-audit', '--no-fund'], ['run', 'build']]) {
  const result = spawnSync(npm, args, { cwd: game, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status || 1);
}
const dest = resolve(root, 'android/app/src/main/assets/web');
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(resolve(game, 'dist'), dest, { recursive: true });
console.log('Offline web files copied to Android assets.');
