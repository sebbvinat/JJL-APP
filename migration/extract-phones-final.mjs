// Extrae phone de wp_wc_order_addresses (HPOS) y matchea contra cliente_cursos.
//
// Esquema: (id, order_id, address_type, first_name, last_name, company,
//           address_1, address_2, city, state, postcode, country, email, phone)
//
// DRY RUN — no toca DB.

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

const SQL_PATH = 'C:/Users/sebas/Downloads/u863922915_re2q1.sql';

function parseTuple(line) {
  const start = line.indexOf('(');
  if (start < 0) return null;
  let i = start + 1;
  const fields = [];
  let cur = '';
  let inStr = false;
  let curIsNull = true;
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
    if (ch === "'") { inStr = true; curIsNull = false; i++; continue; }
    if (ch === ',' || ch === ')') {
      const val = cur.trim();
      fields.push(curIsNull && val.toUpperCase() === 'NULL' ? null : val);
      cur = '';
      curIsNull = true;
      if (ch === ')') return fields;
      i++; continue;
    }
    cur += ch; i++;
  }
  return fields.length ? fields : null;
}

const stream = createReadStream(SQL_PATH, { encoding: 'utf8' });
const rl = createInterface({ input: stream, crlfDelay: Infinity });
let mode = null;
let total = 0;
let withPhone = 0;
const emailToPhone = new Map();

for await (const line of rl) {
  if (line.startsWith('INSERT INTO `wp_wc_order_addresses`')) { mode = true; continue; }
  if (!mode) continue;
  if (!line.startsWith('(')) { mode = false; continue; }
  const f = parseTuple(line);
  if (!f || f.length < 14) continue;
  total++;
  const email = (f[12] || '').toLowerCase();
  const phone = (f[13] || '').trim();
  if (!email || !phone) continue;
  withPhone++;
  if (!emailToPhone.has(email)) emailToPhone.set(email, phone);
}

console.log(`Filas wp_wc_order_addresses leidas: ${total}`);
console.log(`Filas con email + phone: ${withPhone}`);
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
  if (phone) matched.push({ id: c.id, email: c.email, nombre: c.nombre, phone });
  else unmatched.push({ email: c.email, nombre: c.nombre });
}
console.log(`\n=== MATCH RATE ===`);
console.log(
  `Con telefono: ${matched.length} / ${clientes.length} (${((matched.length / clientes.length) * 100).toFixed(0)}%)`
);

console.log(`\nMuestra primeros 15 con telefono:`);
matched.slice(0, 15).forEach((m) =>
  console.log(`  ${m.email.padEnd(38)} | ${m.phone.padEnd(20)} | ${(m.nombre || '').slice(0, 25)}`)
);

await fs.writeFile(
  'C:/claude-projects/jjl-app/migration/phones-extracted.json',
  JSON.stringify({
    generated_at: new Date().toISOString(),
    source: 'wp_wc_order_addresses (HPOS).phone',
    matched_count: matched.length,
    unmatched_count: unmatched.length,
    matched,
    unmatched,
  }, null, 2)
);
console.log(`\nGuardado en migration/phones-extracted.json`);
