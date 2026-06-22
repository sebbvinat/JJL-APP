// Extrae billing_phone de wp_usermeta del dump SQL de WordPress y matchea
// contra los cliente_cursos migrados en Supabase. DRY RUN — no toca DB.
//
// El dump usa INSERTs multi-linea: una linea con "INSERT INTO ..." y luego
// una tuple por linea: (umeta_id, user_id, 'meta_key', 'meta_value'),
// terminando en ; — leemos en modo state machine.
//
// Uso: node --max-old-space-size=4096 migration/extract-phones.mjs

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

const SQL_PATH = 'C:/Users/sebas/Downloads/u863922915_re2q1.sql';
const PHONE_META_KEYS = new Set(['billing_phone', 'shipping_phone']);

const extracted = JSON.parse(
  await fs.readFile('C:/claude-projects/jjl-app/migration/extracted.json', 'utf8')
);
const idToEmail = new Map();
for (const u of extracted.users) idToEmail.set(String(u.ID), u.user_email?.toLowerCase());
console.log(`wp_users en extracted.json: ${idToEmail.size}`);

// Parser de una sola tuple SQL. Soporta '' como escape de comilla y \' tambien.
function parseTuple(line) {
  // Encontrar el '(' inicial y ')' final
  const start = line.indexOf('(');
  if (start < 0) return null;
  let i = start + 1;
  const fields = [];
  let cur = '';
  let inStr = false;
  while (i < line.length) {
    const ch = line[i];
    if (inStr) {
      if (ch === "'" && line[i + 1] === "'") {
        cur += "'";
        i += 2;
        continue;
      }
      if (ch === '\\' && i + 1 < line.length) {
        const nxt = line[i + 1];
        if (nxt === "'") {
          cur += "'";
          i += 2;
          continue;
        }
        if (nxt === '\\') {
          cur += '\\';
          i += 2;
          continue;
        }
        if (nxt === 'n') {
          cur += '\n';
          i += 2;
          continue;
        }
        if (nxt === 'r') {
          cur += '\r';
          i += 2;
          continue;
        }
        if (nxt === 't') {
          cur += '\t';
          i += 2;
          continue;
        }
        cur += nxt;
        i += 2;
        continue;
      }
      if (ch === "'") {
        inStr = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    // outside string
    if (ch === "'") {
      inStr = true;
      i++;
      continue;
    }
    if (ch === ',' || ch === ')') {
      fields.push(cur.trim());
      cur = '';
      if (ch === ')') return fields;
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  return fields.length ? fields : null;
}

const userIdToPhone = new Map();
const stream = createReadStream(SQL_PATH, { encoding: 'utf8' });
const rl = createInterface({ input: stream, crlfDelay: Infinity });

let lineCount = 0;
let mode = null; // 'usermeta' | null
let tuplesSeen = 0;
let phonesSeen = 0;
for await (const line of rl) {
  lineCount++;

  if (line.startsWith('INSERT INTO `wp_usermeta`')) {
    mode = 'usermeta';
    continue;
  }

  if (mode === 'usermeta') {
    // termina cuando la linea NO empieza con '('
    if (!line.startsWith('(')) {
      mode = null;
      continue;
    }
    const fields = parseTuple(line);
    if (!fields || fields.length < 4) continue;
    tuplesSeen++;
    const userId = fields[1];
    const key = fields[2];
    const val = fields[3];
    if (!PHONE_META_KEYS.has(key)) continue;
    if (!val) continue;
    phonesSeen++;
    const existing = userIdToPhone.get(userId);
    if (!existing || (existing.key === 'shipping_phone' && key === 'billing_phone')) {
      userIdToPhone.set(userId, { phone: val.trim(), key });
    }
  }
}
console.log(`SQL lineas leidas: ${lineCount.toLocaleString()}`);
console.log(`Tuples wp_usermeta procesadas: ${tuplesSeen.toLocaleString()}`);
console.log(`Phone tuples encontradas: ${phonesSeen}`);
console.log(`user_ids unicos con telefono: ${userIdToPhone.size}`);

const emailToPhone = new Map();
for (const [userId, { phone, key }] of userIdToPhone) {
  const email = idToEmail.get(userId);
  if (!email) continue;
  emailToPhone.set(email, { phone, key });
}
console.log(`emails matcheados con wp_users: ${emailToPhone.size}`);

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
  const hit = emailToPhone.get(c.email?.toLowerCase());
  if (hit) {
    matched.push({ id: c.id, email: c.email, nombre: c.nombre, phone: hit.phone, source: hit.key });
  } else {
    unmatched.push({ email: c.email, nombre: c.nombre });
  }
}
console.log(`\n=== MATCH RATE ===`);
console.log(
  `Con telefono: ${matched.length} / ${clientes.length} (${((matched.length / clientes.length) * 100).toFixed(0)}%)`
);
console.log(`Sin telefono: ${unmatched.length}`);

console.log(`\nMuestra (primeros 12 con telefono):`);
matched.slice(0, 12).forEach((m) =>
  console.log(`  ${m.email.padEnd(40)} | ${m.phone.padEnd(20)} | ${(m.nombre || '').slice(0, 25)}`)
);

console.log(`\nMuestra (primeros 5 sin telefono):`);
unmatched.slice(0, 5).forEach((u) => console.log(`  ${u.email}`));

const out = {
  generated_at: new Date().toISOString(),
  matched_count: matched.length,
  unmatched_count: unmatched.length,
  matched,
  unmatched,
};
await fs.writeFile(
  'C:/claude-projects/jjl-app/migration/phones-extracted.json',
  JSON.stringify(out, null, 2)
);
console.log(`\nGuardado en migration/phones-extracted.json`);
