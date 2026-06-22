// Libera la semana 4 del mes 1 + todo el mes 2 para Tomas Chandia.
// Idempotente. Crea backup del estado previo en un .json para revertir.
//
// Uso:
//   node scripts/unlock-tomas-chandia.mjs           → ejecuta
//   node scripts/unlock-tomas-chandia.mjs --revert  → vuelve al estado previo
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const TOMAS_ID = '54aae061-8edc-447f-9e64-ce904c06f314';
const TARGETS = ['mod-4', 'mod-5', 'mod-6', 'mod-7', 'mod-8']; // S4 mes1 + todo mes 2

const BACKUP_FILE = new URL('./unlock-tomas-chandia-backup.json', import.meta.url);

if (process.argv.includes('--revert')) {
  if (!existsSync(BACKUP_FILE)) {
    console.error('No hay backup para revertir. Abort.');
    process.exit(1);
  }
  const prev = JSON.parse(readFileSync(BACKUP_FILE, 'utf8'));
  console.log('Revirtiendo a estado previo:', prev.length, 'filas');
  for (const row of prev) {
    await sb.from('user_access').upsert(row, { onConflict: 'user_id,module_id' });
  }
  console.log('✔ Reverted.');
  process.exit(0);
}

// 1) Backup del estado actual de esos módulos
const { data: prev } = await sb
  .from('user_access')
  .select('*')
  .eq('user_id', TOMAS_ID)
  .in('module_id', TARGETS);
writeFileSync(BACKUP_FILE, JSON.stringify(prev || [], null, 2));
console.log('✔ Backup guardado:', prev?.length ?? 0, 'rows →', BACKUP_FILE.pathname);

// 2) Upsert is_unlocked=true para los 5 módulos
const rows = TARGETS.map((module_id) => ({
  user_id: TOMAS_ID, module_id, is_unlocked: true,
}));
const { error: upErr } = await sb.from('user_access').upsert(rows, { onConflict: 'user_id,module_id' });
if (upErr) { console.error('ERROR upsert:', upErr.message); process.exit(1); }
console.log('✔ Upsert exitoso —', rows.length, 'módulos abiertos');

// 3) Verificar
const { data: after } = await sb
  .from('user_access')
  .select('module_id, is_unlocked')
  .eq('user_id', TOMAS_ID)
  .in('module_id', TARGETS);
console.log('\nEstado final:');
for (const r of (after || []).sort((a, b) => a.module_id.localeCompare(b.module_id))) {
  console.log(' ', r.module_id, '→', r.is_unlocked ? '✅ abierto' : '🔒 CERRADO');
}
console.log('\n--- Para revertir: node scripts/unlock-tomas-chandia.mjs --revert ---');
