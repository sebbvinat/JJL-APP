// Que meta_keys existen en wp_postmeta — para entender si hay WooCommerce
// y donde estan los telefonos.
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

function parseTuple(line) {
  const start = line.indexOf('(');
  if (start < 0) return null;
  let i = start + 1;
  const fields = [];
  let cur = '';
  let inStr = false;
  while (i < line.length) {
    const ch = line[i];
    if (inStr) {
      if (ch === "'" && line[i + 1] === "'") { cur += "'"; i += 2; continue; }
      if (ch === '\\' && i + 1 < line.length) {
        const nxt = line[i + 1];
        if (nxt === "'") { cur += "'"; i += 2; continue; }
        if (nxt === '\\') { cur += '\\'; i += 2; continue; }
        cur += nxt; i += 2; continue;
      }
      if (ch === "'") { inStr = false; i++; continue; }
      cur += ch; i++; continue;
    }
    if (ch === "'") { inStr = true; i++; continue; }
    if (ch === ',' || ch === ')') {
      fields.push(cur.trim());
      cur = '';
      if (ch === ')') return fields;
      i++; continue;
    }
    cur += ch; i++;
  }
  return fields.length ? fields : null;
}

const keys = new Map();
const stream = createReadStream('C:/Users/sebas/Downloads/u863922915_re2q1.sql', { encoding: 'utf8' });
const rl = createInterface({ input: stream, crlfDelay: Infinity });
let mode = null;
let tableNames = new Set();
for await (const line of rl) {
  const insMatch = line.match(/^INSERT INTO `([^`]+)`/);
  if (insMatch) {
    tableNames.add(insMatch[1]);
    mode = insMatch[1] === 'wp_postmeta' ? 'postmeta' : null;
    continue;
  }
  if (mode !== 'postmeta') continue;
  if (!line.startsWith('(')) { mode = null; continue; }
  const f = parseTuple(line);
  if (!f || f.length < 3) continue;
  const k = f[2];
  if (k) keys.set(k, (keys.get(k) || 0) + 1);
}

console.log('=== Tablas en el dump (con INSERT) ===');
console.log([...tableNames].sort().join('\n'));

console.log(`\n=== top 60 wp_postmeta meta_keys ===`);
[...keys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)
  .forEach(([k, c]) => console.log(`  ${c.toString().padStart(7)}  ${k}`));

// posibles claves de telefono
const phoneish = [...keys.entries()].filter(([k]) => /phone|telef|mobile|celular|whats/i.test(k));
console.log(`\n=== posibles claves de telefono en postmeta: ${phoneish.length} ===`);
phoneish.forEach(([k, c]) => console.log(`  ${c}  ${k}`));
