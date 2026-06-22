// Batch 2026-06-03b — 3 nuevos drills del coach.
//   1) 2nErg-rCgzA → Mes 1 sem 4 "Drill 2: Toreos"
//      (titulo ambiguo — repite en sem 1 y 3 — filtrar por module_id=mod-4)
//   2) iWMphA07aGE → Mes 2 sem 5 "Drill 2: Escape + Combinación Guardia cerrada"
//   3) inimo4uUxYE → Mes 2 sem 6 "Drill 2: Drill combinación escape + guardia cerrada"
//
// Idempotente. Hace backup completo antes de tocar nada.
// Actualiza course_data y upsertea lesson_video_overrides.
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const nk = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

const MAPPINGS = [
  { num: 1, yt: '2nErg-rCgzA', titulo: 'Drill 2: Toreos',                                       module_id: 'mod-4' },
  { num: 2, yt: 'iWMphA07aGE', titulo: 'Drill 2: Escape + Combinación Guardia cerrada',         module_id: 'mod-5' },
  { num: 3, yt: 'inimo4uUxYE', titulo: 'Drill 2: Drill combinación escape + guardia cerrada',   module_id: 'mod-6' },
];

// Backup (todas las course_data por si necesitamos rollback)
const { data: allRowsBackup, error: backupErr } = await sb.from('course_data').select('*');
if (backupErr) { console.error('Backup fallo:', backupErr.message); process.exit(1); }
const stamp = '2026-06-03b';
const backupPath = new URL(`./yt-batch-${stamp}-backup.json`, import.meta.url);
writeFileSync(backupPath, JSON.stringify(allRowsBackup, null, 2));
console.log(`✔ Backup: ${backupPath.pathname.slice(1)} (${(allRowsBackup || []).length} rows)\n`);

// Index mappings por (module_id, lesson_key) y por lesson_key suelto (info)
const byModuleKey = new Map();
const byKey = new Map();
for (const m of MAPPINGS) {
  byModuleKey.set(`${m.module_id}|${nk(m.titulo)}`, m);
  byKey.set(nk(m.titulo), m);
}

// Aplicar a course_data: matchea por (module_id, titulo normalizado).
let rowsUpdated = 0, lessonsUpdated = 0, lessonsAlready = 0;
for (const r of allRowsBackup || []) {
  const lessons = Array.isArray(r.lessons) ? r.lessons : [];
  let changed = false;
  const next = lessons.map((l) => {
    const m = byModuleKey.get(`${r.module_id}|${nk(l?.titulo)}`);
    if (!m) return l;
    if (l.youtube_id === m.yt) { lessonsAlready++; return l; }
    changed = true;
    lessonsUpdated++;
    return { ...l, youtube_id: m.yt };
  });
  if (!changed) continue;
  const { error } = await sb.from('course_data')
    .update({ lessons: next, updated_at: new Date().toISOString() })
    .eq('user_id', r.user_id).eq('module_id', r.module_id);
  if (error) { console.error(`ERROR course_data ${r.user_id}/${r.module_id}:`, error.message); continue; }
  rowsUpdated++;
}
console.log(`course_data:`);
console.log(`  filas actualizadas: ${rowsUpdated}`);
console.log(`  lecciones cambiadas: ${lessonsUpdated}`);
console.log(`  lecciones ya correctas (idempotente): ${lessonsAlready}\n`);

// Upsert overrides (canónicos por module_id+lesson_key)
let ovUpserts = 0;
for (const m of MAPPINGS) {
  const lesson_key = nk(m.titulo);
  const { error } = await sb.from('lesson_video_overrides').upsert(
    {
      module_id: m.module_id,
      lesson_key,
      titulo: m.titulo,
      youtube_id: m.yt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'module_id,lesson_key' },
  );
  if (error) {
    console.error(`ERROR override ${m.module_id}/${lesson_key}:`, error.message);
    continue;
  }
  ovUpserts++;
}
console.log(`overrides upserted: ${ovUpserts}/${MAPPINGS.length}\n`);

// Verificación
console.log('Verificación:');
const { data: verifyRows } = await sb.from('course_data').select('module_id, lessons');
let allOk = true;
for (const m of MAPPINGS) {
  const norm = nk(m.titulo);
  let withNew = 0, withOther = 0, foundInWrongModule = 0;
  for (const r of verifyRows || []) {
    for (const l of (r.lessons || [])) {
      if (nk(l?.titulo) !== norm) continue;
      if (r.module_id !== m.module_id) {
        // ojo: misma lección en otro módulo — informativo, no error
        foundInWrongModule++;
        continue;
      }
      if (l.youtube_id === m.yt) withNew++;
      else withOther++;
    }
  }
  const ok = withOther === 0;
  if (!ok) allOk = false;
  const extra = foundInWrongModule ? ` · ${foundInWrongModule} en otros módulos (no tocados)` : '';
  console.log(`  ${ok ? '✓' : '⚠'} #${m.num} "${m.titulo}" (${m.module_id}): ${withNew} con ${m.yt} · ${withOther} con otro${extra}`);
}

const { data: verifyOv } = await sb.from('lesson_video_overrides')
  .select('module_id, lesson_key, youtube_id')
  .in('lesson_key', MAPPINGS.map((m) => nk(m.titulo)));
for (const m of MAPPINGS) {
  const lk = nk(m.titulo);
  const hit = (verifyOv || []).find((o) => o.module_id === m.module_id && o.lesson_key === lk);
  console.log(`  ${hit?.youtube_id === m.yt ? '✓' : '⚠'} override ${m.module_id}/${lk} → ${hit?.youtube_id || '(falta)'}`);
}

console.log(`\n${allOk ? '✅ Todo OK' : '⚠ Hay inconsistencias — revisar arriba'}`);
