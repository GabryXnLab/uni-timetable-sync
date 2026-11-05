import { build as buildServer } from 'esbuild';
import { build as buildClient } from 'vite';
import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = resolve(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await buildServer({
  entryPoints: [resolve(root, 'src/server/index.ts')],
  outfile: resolve(dist, 'Code.gs'),
  bundle: true,
  format: 'iife',
  globalName: 'TimetableSync',
  platform: 'neutral',
  target: 'es2020',
});

const globals = ['doGet', 'previewNextWeek', 'syncNextWeek', 'checkThisWeek', 'installTriggers', 'getStatus', 'verifySetup'];
let code = readFileSync(resolve(dist, 'Code.gs'), 'utf8');
code += '\n' + globals.map(name => `function ${name}() { return TimetableSync.${name}.apply(this, arguments); }`).join('\n') + '\n';
writeFileSync(resolve(dist, 'Code.gs'), code);
await buildClient({ configFile: resolve(root, 'vite.config.ts') });
renameSync(resolve(dist, 'index.html'), resolve(dist, 'Dashboard.html'));
copyFileSync(resolve(root, 'appsscript.json'), resolve(dist, 'appsscript.json'));
for (const file of ['Code.gs', 'Dashboard.html', 'appsscript.json']) {
  if (!readFileSync(resolve(dist, file), 'utf8').trim()) throw new Error(`Build vuota: ${file}`);
}
