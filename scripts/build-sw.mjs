import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = join(__dirname, '..', 'public', 'sw.js');

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  String(Date.now());

const source = readFileSync(swPath, 'utf8');
const updated = source.replace(
  /const CACHE_NAME = '[^']*';/,
  `const CACHE_NAME = 'jjl-${buildId}';`
);

if (updated === source) {
  console.warn('[build-sw] CACHE_NAME no encontrado en sw.js — nada que actualizar');
  process.exit(0);
}

writeFileSync(swPath, updated);
console.log(`[build-sw] sw.js actualizado con CACHE_NAME = 'jjl-${buildId}'`);
