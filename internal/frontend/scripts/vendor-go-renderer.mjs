// Re-run only when upgrading @plantuml/core or the JS compatibility layer.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, '../../render/assets');
const require = createRequire(import.meta.url);
mkdirSync(dest, { recursive: true });
const original = readFileSync(require.resolve('@plantuml/core/plantuml.js'), 'utf8');
const exports = 'export{C as render,D as renderToString};';
if (!original.endsWith(exports)) throw new Error('PlantUML exports changed; review the integration');
writeFileSync(resolve(dest, 'plantuml.js'), original.slice(0, -exports.length) + 'globalThis.renderToString=D;');
for (const name of ['buffer', 'dom']) {
  await build({ entryPoints: [resolve(here, 'render', `${name}.mjs`)], bundle: true,
    platform: 'browser', format: 'iife', outfile: resolve(dest, `${name}.js`) });
}
