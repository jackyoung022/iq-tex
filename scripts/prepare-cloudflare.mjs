import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

// cf's Build Output Specification v0 accepts the existing Vinext bundle without
// migrating the Sites starter or upgrading its framework dependencies.
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(join(root, 'cloudflare.deploy.json'), 'utf8'));
const server = join(root, 'dist/server');
await readFile(join(server, 'index.js')); // Fail before deleting output if not built.
const output = join(root, '.cloudflare/output/v0');
const worker = join(output, 'workers/default');
await rm(output, { recursive: true, force: true });
await mkdir(worker, { recursive: true });
await cp(server, join(worker, 'bundle'), { recursive: true });
await cp(join(root, 'dist/client'), join(worker, 'assets'), { recursive: true });

const modules = {};
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (/\.(m?js)$/.test(entry.name)) {
      modules[relative(server, path).split('\\').join('/')] = { type: 'esm' };
    }
  }
}
await collect(server);
await writeFile(join(output, 'config.json'), JSON.stringify({ buildContext: { isPreview: false } }));
await writeFile(join(worker, 'worker.config.json'), JSON.stringify({
  ...config,
  manifest: { type: 'complete', mainModule: 'index.js', modules },
}));
console.log(`Prepared cf build output for ${config.name}.`);
