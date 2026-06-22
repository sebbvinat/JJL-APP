// FIX: aplica los 7 mappings acumulando en memoria por fila antes de
// escribir. Idempotente — vuelve a hacer los OK también pero no cambia
// nada porque ya tienen el yt correcto.
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
const normToYt = new Map(MAPPINGS.map((m) => [nk(m.titulo), m.yt]));

const { data: allRows } = await sb.from('course_data').select('user_id, module_id, lessons');

// Aplicar TODOS los mappings a cada fila in-memory antes de escribir
let rowsUpdated = 0, lessonsUpdated = 0, lessonsAlready = 0;
for (const r of allRows || []) {
  const lessons = Array.isArray(r.lessons) ? r.lessons : [];
  let changed = false;
  const next = lessons.map((l) => {
    const want = normToYt.get(nk(l?.titulo));
    if (!want) return l;
    if (l.youtube_id === want) { lessonsAlready++; return l; }
    changed = true;
    lessonsUpdated++;
    return { ...l, youtube_id: want };
  });
  if (!changed) continue;
  const { error } = await sb.from('course_data')
    .update({ lessons: next, updated_at: new Date().toISOString() })
    .eq('user_id', r.user_id).eq('module_id', r.module_id);
  if (error) { console.error(`ERROR ${r.user_id}/${r.module_id}:`, error.message); continue; }
  rowsUpdated++;
}
console.log(`Filas actualizadas: ${rowsUpdated}`);
console.log(`Lecciones cambiadas: ${lessonsUpdated}`);
console.log(`Lecciones ya correctas (idempotente): ${lessonsAlready}\n`);

// Verificacion
const { data: verifyRows } = await sb.from('course_data').select('lessons');
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
  console.log(`${ok ? '✓' : '⚠'} #${m.num} "${m.titulo}": ${withNew} con ${m.yt} · ${withOther} con otro`);
}
console.log(`\n${allOk ? '✅ Todo OK' : '⚠ Hay inconsistencias'}`);
