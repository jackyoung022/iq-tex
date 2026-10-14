import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Use the same locked Wrangler/Miniflare version as Vite's local runtime.
// Remote migrations remain managed by the cf deployment script.
const root = fileURLToPath(new URL('../', import.meta.url));
const { env: { DB } } = JSON.parse(await readFile(join(root, 'cloudflare.deploy.json'), 'utf8'));
if (!DB?.id || !DB?.name) throw new Error('Configure env.DB in cloudflare.deploy.json first.');
const directory = join(root, '.wrangler');
await mkdir(directory, { recursive: true });
const config = join(directory, 'local-db.json');
await writeFile(config, JSON.stringify({
  name: 'iq-tax-check-local',
  compatibility_date: '2026-05-15',
  d1_databases: [{ binding: 'DB', database_name: DB.name, database_id: DB.id, migrations_dir: join(root, 'drizzle') }],
}));
const result = spawnSync(process.execPath, [join(root, 'node_modules/wrangler/bin/wrangler.js'),
  'd1', 'migrations', 'apply', 'DB', '--local', '--config', config,
  '--persist-to', join(directory, 'state'),
], { cwd: root, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false' } });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
