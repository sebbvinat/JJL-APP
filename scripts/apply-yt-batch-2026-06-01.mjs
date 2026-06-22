// WRITE (idempotente). Aplica 7 reemplazos de youtube_id derivados del
// batch de videos reuploadeados el 1/6/2026 por el coach. Match por
// titulo normalizado exacto, escribe tanto en course_data.lessons como
// en lesson_video_overrides (override canonico).
//
// Mapping: ver scripts/apply-yt-batch-2026-06-01.json — generado por
// este script al terminar para auditoria + posible rollback.
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const nk = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

const MAPPINGS = [
  { num: 3,  yt: 'MCHEDVVgW7w', titulo: 'De la Riva variante 4' },
  { num: 6,  yt: 'tRca9K3uKhA', titulo: 'Drill 2: Lower Leg Shift' },
  { num: 8,  yt: 'qwVhIy4UXJY', titulo: 'Conceptos de 100kg' },
  { num: 11, yt: 'pzvQ6NvGkms', titulo: 'Drill 1: Escape de 100kg' },
  { num: 14, yt: 'nEX_NCNiBqE', titulo: '1/2 guardia: Lower Leg Shift' },
  { num: 16, yt: 'S9q2PeuzK54', titulo: 'De la Riva variante 3' },
  { num: 20, yt: 'hR-GSqv0LMM', titulo: 'De la Riva variante 2' },
];

// 1. Pull todas las filas (es chico, ~50 filas course_data)
const { data: allRows } = await sb.from('course_data').select('*');

// 2. Backup de las filas que tienen al menos una de las 7 lecciones
const targetNorms = new Set(MAPPINGS.map((m) => nk(m.titulo)));
const backupRows = (allRows || []).filter((r) =>
  Array.isArray(r.lessons) && r.lessons.some((l) => targetNorms.has(nk(l?.titulo)))
);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(new URL(`./yt-batch-backup-${stamp}.json`, import.meta.url), JSON.stringify(backupRows, null, 2));
console.log(`Backup: ${backupRows.length} filas con al menos una de las 7 lecciones`);
console.log(`        scripts/yt-batch-backup-${stamp}.json\n`);

// 3. Aplicar por mapping
const results = [];
for (const m of MAPPINGS) {
  const norm = nk(m.titulo);
  let updated = 0, alreadyOk = 0, notFound = 0;
  const moduleCount = new Map();   // module_id -> count, para elegir el "mas comun" para el override

  for (const r of allRows || []) {
    const lessons = Array.isArray(r.lessons) ? r.lessons : [];
    const idx = lessons.findIndex((l) => nk(l?.titulo) === norm);
    if (idx === -1) continue;
    moduleCount.set(r.module_id, (moduleCount.get(r.module_id) || 0) + 1);
    if (lessons[idx].youtube_id === m.yt) { alreadyOk++; continue; }
    const next = lessons.map((l, i) => i === idx ? { ...l, youtube_id: m.yt } : l);
    const { error } = await sb.from('course_data')
      .update({ lessons: next, updated_at: new Date().toISOString() })
      .eq('user_id', r.user_id).eq('module_id', r.module_id);
    if (error) {
      console.error(`  ERROR update ${r.user_id}/${r.module_id}:`, error.message);
      continue;
    }
    updated++;
  }
  if (moduleCount.size === 0) notFound = 1;

  // Override canonico — usamos el module_id mas frecuente
  let topModule = '', topCount = -1;
  for (const [mid, c] of moduleCount) if (c > topCount) { topModule = mid; topCount = c; }

  let overrideOk = false;
  if (topModule) {
    const { error } = await sb.from('lesson_video_overrides').upsert({
      module_id: topModule,
      lesson_key: norm,
      youtube_id: m.yt,
      titulo: m.titulo,
    }, { onConflict: 'module_id,lesson_key' });
    overrideOk = !error;
    if (error) console.error(`  ERROR override ${m.titulo}:`, error.message);
  }

  results.push({
    num: m.num, yt: m.yt, titulo: m.titulo,
    updated, alreadyOk, modules: [...moduleCount.keys()],
    overrideModule: topModule, overrideOk, notFound: notFound === 1,
  });

  console.log(`#${m.num}  "${m.titulo}"  -> ${m.yt}`);
  console.log(`   ✓ actualizadas ${updated} · ya estaban ${alreadyOk} · modulos: ${[...moduleCount.keys()].join(', ') || '(ninguno)'}`);
  console.log(`   override ${overrideOk ? '✓' : '✗'} en ${topModule || '(skip)'}\n`);
}

// 4. Verificacion post-write
console.log('---- Verificación post-write ----');
const { data: verifyRows } = await sb.from('course_data').select('user_id, module_id, lessons');
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
  const status = withOther === 0 ? '✓' : '⚠';
  console.log(`${status} #${m.num} "${m.titulo}": ${withNew} con ${m.yt} · ${withOther} con otro yt`);
}

writeFileSync(new URL(`./yt-batch-report-${stamp}.json`, import.meta.url), JSON.stringify({ stamp, results }, null, 2));
console.log(`\nReporte: scripts/yt-batch-report-${stamp}.json`);
