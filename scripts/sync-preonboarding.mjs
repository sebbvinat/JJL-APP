/**
 * Copia la presentación de los 3 pilares ("Tu juego, conectado") a
 * public/preonboarding/, para que viva en alumno.jiujitsulatino.com/preonboarding.
 *
 * La presentación NO vive en este repo: se edita en jjl-manager (un solo
 * index.html con todo adentro) y de ahí se copia acá. Cada vez que la toques,
 * corré esto y volvé a deployar:
 *
 *     node scripts/sync-preonboarding.mjs
 *
 * Lo único que le cambia al copiar es agregarle <base href="/preonboarding/">.
 * Sin eso, la página servida en /preonboarding (sin barra final) busca las
 * capturas en la raíz del sitio y no las encuentra.
 */
import { cp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = join(RAIZ, '..', 'jjl-manager', 'presentacion-3-pilares', 'final');
const DESTINO = join(RAIZ, 'public', 'preonboarding');
const BASE = '<base href="/preonboarding/">';

async function existe(p) {
  try { await stat(p); return true; } catch { return false; }
}

if (!(await existe(join(ORIGEN, 'index.html')))) {
  console.error('No encuentro la presentación en:\n  ' + ORIGEN + '\n' +
    'Tiene que estar el repo jjl-manager al lado de este.');
  process.exit(1);
}

await rm(DESTINO, { recursive: true, force: true });
await mkdir(DESTINO, { recursive: true });

let html = await readFile(join(ORIGEN, 'index.html'), 'utf8');
if (!html.includes(BASE)) {
  html = html.replace('<head>', '<head>\n' + BASE);
}
await writeFile(join(DESTINO, 'index.html'), html, 'utf8');

let pesoMedia = 0;
for (const carpeta of ['capturas', 'videos']) {
  const desde = join(ORIGEN, carpeta);
  if (!(await existe(desde))) continue;
  await cp(desde, join(DESTINO, carpeta), { recursive: true });
}

// Aviso de peso: todo esto se sube al repo y se deploya en cada push.
const { execSync } = await import('node:child_process');
try {
  const salida = execSync('du -sk "' + DESTINO + '"', { encoding: 'utf8' });
  pesoMedia = parseInt(salida, 10) / 1024;
} catch { /* du no está en Windows sin git bash: no es crítico */ }

console.log('Listo: ' + DESTINO);
if (pesoMedia) console.log('Pesa ' + pesoMedia.toFixed(1) + ' MB (va al repo y al deploy).');
console.log('Ahora: commit + push, y queda en alumno.jiujitsulatino.com/preonboarding');
