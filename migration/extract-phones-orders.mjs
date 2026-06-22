// Extrae _billing_phone + _billing_email de wp_postmeta (ordenes WooCommerce)
// y matchea contra cliente_cursos. DRY RUN.
//
// WooCommerce guarda en wp_postmeta para cada orden:
//   _billing_phone, _billing_email, _billing_first_name, _billing_last_name
// Una persona puede tener varias ordenes — agrupamos por email y nos quedamos
// con el ultimo telefono no vacio.

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

const SQL_PATH = 'C:/Users/sebas/Downloads/u863922915_re2q1.sql';
const TARGET_KEYS = new Set(['_billing_phone', '_billing_email']);

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
        if (nxt === 'n') { cur += '\n'; i += 2; continue; }
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

// post_id -> { phone, email }
const postIdToData = new Map();

const stream = createReadStream(SQL_PATH, { encoding: 'utf8' });
const rl = createInterface({ input: stream, crlfDelay: Infinity });

let lineCount = 0;
let mode = null; // 'postmeta' | null
let tuplesSeen = 0;
for await (const line of rl) {
  lineCount++;

  if (line.startsWith('INSERT INTO `wp_postmeta`')) { mode = 'postmeta'; continue; }
  if (mode !== 'postmeta') continue;
  if (!line.startsWith('(')) { mode = null; continue; }

  const f = parseTuple(line);
  if (!f || f.length < 4) continue;
  tuplesSeen++;
  const postId = f[1];
  const key = f[2];
  const val = f[3];
  if (!TARGET_KEYS.has(key)) continue;
  if (!val) continue;
  let entry = postIdToData.get(postId);
  if (!entry) { entry = {}; postIdToData.set(postId, entry); }
  if (key === '_billing_phone') entry.phone = val.trim();
  else if (key === '_billing_email') entry.email = val.trim().toLowerCase();
}
console.log(`SQL lineas: ${lineCount.toLocaleString()}`);
console.log(`Tuples wp_postmeta procesadas: ${tuplesSeen.toLocaleString()}`);

// Filtrar las que tienen email + phone
const validOrders = [...postIdToData.values()].filter((d) => d.email && d.phone);
console.log(`Ordenes con email+phone: ${validOrders.length}`);

// email -> phone (ultimo no vacio gana — pero como no tenemos fecha, cualquiera sirve)
const emailToPhone = new Map();
for (const { email, phone } of validOrders) {
  if (!emailToPhone.has(email)) emailToPhone.set(email, phone);
}
console.log(`Emails unicos con phone: ${emailToPhone.size}`);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const { data: clientes } = await supabase
  .from('users')
  .select('id, email, nombre')
  .eq('rol', 'cliente_cursos');
console.log(`\ncliente_cursos en Supabase: ${clientes.length}`);

const matched = [];
const unmatched = [];
for (const c of clientes) {
  const phone = emailToPhone.get(c.email?.toLowerCase());
  if (phone) {
    matched.push({ id: c.id, email: c.email, nombre: c.nombre, phone });
  } else {
    unmatched.push({ email: c.email, nombre: c.nombre });
  }
}
console.log(`\n=== MATCH RATE ===`);
console.log(
  `Con telefono: ${matched.length} / ${clientes.length} (${((matched.length / clientes.length) * 100).toFixed(0)}%)`
);

console.log(`\nMuestra (primeros 15 con telefono):`);
matched.slice(0, 15).forEach((m) =>
  console.log(`  ${m.email.padEnd(38)} | ${m.phone.padEnd(20)} | ${(m.nombre || '').slice(0, 25)}`)
);

console.log(`\nMuestra (primeros 10 sin telefono):`);
unmatched.slice(0, 10).forEach((u) => console.log(`  ${u.email.padEnd(38)} | ${(u.nombre || '').slice(0, 25)}`));

await fs.writeFile(
  'C:/claude-projects/jjl-app/migration/phones-extracted.json',
  JSON.stringify({
    generated_at: new Date().toISOString(),
    source: 'wp_postmeta._billing_phone',
    matched_count: matched.length,
    unmatched_count: unmatched.length,
    matched,
    unmatched,
  }, null, 2)
);
console.log(`\nGuardado en migration/phones-extracted.json`);
