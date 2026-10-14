import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(join(root, 'cloudflare.deploy.json'), 'utf8'));
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--init-cookie-secret')) throw new Error('Unsupported deployment option.');
const initialize = args.includes('--init-cookie-secret');
let directory;
try {
  const deployArgs = ['deploy', '--prebuilt'];
  if (initialize) {
    const existing = spawnSync('cf', ['workers', 'scripts', 'search', '--name', config.name], { cwd: root, encoding: 'utf8' });
    if (existing.status !== 0) throw new Error('Cannot inspect existing Workers; deployment stopped.');
    const workers = JSON.parse(existing.stdout);
    if (!Array.isArray(workers) || workers.length) throw new Error('Worker already exists; use npm run deploy:cf to preserve its Cookie secret.');
    directory = await mkdtemp(join(tmpdir(), 'iq-tax-cf-'));
    const path = join(directory, 'secrets.json');
    await writeFile(path, JSON.stringify({ SETTINGS_COOKIE_SECRET: randomBytes(32).toString('base64url') }), { mode: 0o600 });
    deployArgs.push('--secrets-file', path);
  } else {
    const result = spawnSync('cf', ['workers', 'secrets', 'list', '--worker', config.name], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0 || !JSON.parse(result.stdout).some(secret => secret.name === 'SETTINGS_COOKIE_SECRET')) {
      throw new Error('Cookie secret missing. For a new Worker, use npm run deploy:cf -- --init-cookie-secret.');
    }
  }
  if (config.env.DB?.id) {
    const migration = spawnSync('cf', ['d1', 'migrations', 'apply', config.env.DB.id, '--dir', 'drizzle'], { cwd: root, stdio: 'inherit' });
    if (migration.error) throw migration.error;
    if (migration.status !== 0) throw new Error('D1 migration failed; Worker deployment stopped.');
  }
  const result = spawnSync('cf', deployArgs, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (directory) await rm(directory, { recursive: true, force: true });
}
