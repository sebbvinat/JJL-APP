// Batch 2026-06-08 — 4 videos del coach (Kimura / Armbar / Toreos).
//   1) xJTSdbKn9Kw → Mes 2 sem 8 "Drill 2: Combinación toreos + Kimura"   (mod-8)
//   2) d6svZtvGqKo → Mes 2 sem 7 "Drill 2: Combinación toreos + armbar"   (mod-7)
//   3) nWdnxxYy69k → Mes 2 sem 8 "Drill 1: Kimura"                        (mod-8)
//   4) Q7E-E-Tm_eE → Mes 2 sem 8 "Finalización Kimura"                    (mod-8)
//
// Los 4 títulos son únicos en la planilla → matcheo por título solo,
// para alcanzar también a alumnos viejos cuyo course_data tiene un
// numbering distinto de module_id (ej. mod-7 = sem 5 en lugar de sem 7).
// El override sí usa el module_id canónico de planillas.ts actual.
//
// Idempotente. Hace backup completo antes de tocar nada.
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
  { num: 1, yt: 'xJTSdbKn9Kw', titulo: 'Drill 2: Combinación toreos + Kimura', module_id: 'mod-8' },
  { num: 2, yt: 'd6svZtvGqKo', titulo: 'Drill 2: Combinación toreos + armbar', module_id: 'mod-7' },
  { num: 3, yt: 'nWdnxxYy69k', titulo: 'Drill 1: Kimura',                       module_id: 'mod-8' },
  { num: 4, yt: 'Q7E-E-Tm_eE', titulo: 'Finalización Kimura',                   module_id: 'mod-8' },
];

// Backup
const { data: allRowsBackup, error: backupErr } = await sb.from('course_data').select('*');
if (backupErr) { console.error('Backup fallo:', backupErr.message); process.exit(1); }
const stamp = '2026-06-08';
const backupPath = new URL(`./yt-batch-${stamp}-backup.json`, import.meta.url);
writeFileSync(backupPath, JSON.stringify(allRowsBackup, null, 2));
console.log(`✔ Backup: ${backupPath.pathname.slice(1)} (${(allRowsBackup || []).length} rows)\n`);

// Index por lesson_key (sin filtrar module_id)
const byKey = new Map();
for (const m of MAPPINGS) byKey.set(nk(m.titulo), m);

// Aplicar a course_data: matchea SOLO por título normalizado.
let rowsUpdated = 0, lessonsUpdated = 0, lessonsAlready = 0;
for (const r of allRowsBackup || []) {
  const lessons = Array.isArray(r.lessons) ? r.lessons : [];
  let changed = false;
  const next = lessons.map((l) => {
    const m = byKey.get(nk(l?.titulo));
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

// Upsert overrides
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
  if (error) { console.error(`ERROR override ${m.module_id}/${lesson_key}:`, error.message); continue; }
  ovUpserts++;
}
console.log(`overrides upserted: ${ovUpserts}/${MAPPINGS.length}\n`);

// Verificación
console.log('Verificación:');
const { data: verifyRows } = await sb.from('course_data').select('module_id, lessons');
let allOk = true;
for (const m of MAPPINGS) {
  const norm = nk(m.titulo);
  let withNew = 0, withOther = 0;
  for (const r of verifyRows || []) {
    for (const l of (r.lessons || [])) {
      if (nk(l?.titulo) !== norm) continue;
      if (l.youtube_id === m.yt) withNew++;
      else withOther++;
    }
  }
  const ok = withOther === 0;
  if (!ok) allOk = false;
  console.log(`  ${ok ? '✓' : '⚠'} #${m.num} "${m.titulo}": ${withNew} con ${m.yt} · ${withOther} con otro`);
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
