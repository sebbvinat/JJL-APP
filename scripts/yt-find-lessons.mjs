// READ-ONLY. Busca las lecciones que existen en (planilla, semana)
// puntuales, mas las que matchean "babybolo" y "dog fight" en CUALQUIER
// lado. Para mapear los IDs YT a lecciones exactas.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const { data: users } = await sb.from('users')
  .select('id, planilla_id')
  .not('planilla_id', 'is', null);
const userPlanilla = new Map((users || []).map((u) => [u.id, u.planilla_id]));

const { data: rows } = await sb.from('course_data')
  .select('user_id, module_id, semana_numero, titulo, lessons');

// Agrupar por (planilla, semana) -> Set de titulos unicos
function semanaKey(planilla, semana) { return `${planilla}|s${semana}`; }
const byPlanillaSem = new Map();
for (const r of rows || []) {
  const p = userPlanilla.get(r.user_id);
  if (!p) continue;
  const k = semanaKey(p, r.semana_numero);
  if (!byPlanillaSem.has(k)) byPlanillaSem.set(k, { titulo: r.titulo, lessons: new Set() });
  const e = byPlanillaSem.get(k);
  for (const l of (r.lessons || [])) {
    if (l?.titulo && l?.tipo !== 'reflection') {
      e.lessons.add(`${l.titulo}  ${l.youtube_id ? '[yt:' + l.youtube_id + ']' : '[sin yt]'}`);
    }
  }
}

function dumpWeek(planilla, semana) {
  const k = semanaKey(planilla, semana);
  const e = byPlanillaSem.get(k);
  console.log(`\n${planilla.toUpperCase()} sem ${semana}  ${e ? `"${e.titulo}"` : '(no existe)'}`);
  if (!e) return;
  [...e.lessons].forEach((s, i) => console.log(`  ${i}. ${s}`));
}

// Mes 5 sem 1 = sem 17, Mes 3 sem 4 = sem 12, Mes 3 sem 3 = sem 11, Mes 3 sem 2 = sem 10
console.log('========== UBICACIONES PEDIDAS POR EL SOCIO ==========');
dumpWeek('simbio', 17);        // 2 y 5
dumpWeek('simbio', 12);        // 6 y 14
dumpWeek('medios', 12);        // 3
dumpWeek('atleticos', 12);     // 3
dumpWeek('livianos', 12);      // 3
dumpWeek('medios', 11);        // 16
dumpWeek('atleticos', 11);     // 16
dumpWeek('livianos', 11);      // 16
dumpWeek('medios', 10);        // 20
dumpWeek('atleticos', 10);     // 20
dumpWeek('livianos', 10);      // 20

console.log('\n========== BUSQUEDA "babybolo" en TODAS las lecciones ==========');
const found = new Map(); // key: lesson_titulo -> { modules: Set, planillas: Set, yt: Set }
for (const r of rows || []) {
  for (const l of (r.lessons || [])) {
    const t = (l?.titulo || '').toLowerCase();
    if (!t.includes('babybolo') && !t.includes('baby bolo')) continue;
    if (!found.has(l.titulo)) found.set(l.titulo, { modules: new Set(), semanas: new Set(), planillas: new Set(), yt: new Set() });
    const e = found.get(l.titulo);
    e.modules.add(r.module_id);
    e.semanas.add(r.semana_numero);
    const p = userPlanilla.get(r.user_id);
    if (p) e.planillas.add(p);
    if (l.youtube_id) e.yt.add(l.youtube_id);
  }
}
for (const [t, e] of found) {
  console.log(`  "${t}"  modulos:${[...e.modules].join(',')}  semanas:${[...e.semanas].join(',')}  planillas:${[...e.planillas].join(',')}  yt:${[...e.yt].join(',') || '(vacio)'}`);
}
if (found.size === 0) console.log('  (no encontrado)');

console.log('\n========== BUSQUEDA "dog fight" / "dogfight" ==========');
const dog = new Map();
for (const r of rows || []) {
  for (const l of (r.lessons || [])) {
    const t = (l?.titulo || '').toLowerCase();
    if (!t.includes('dog fight') && !t.includes('dogfight')) continue;
    if (!dog.has(l.titulo)) dog.set(l.titulo, { modules: new Set(), semanas: new Set(), planillas: new Set(), yt: new Set() });
    const e = dog.get(l.titulo);
    e.modules.add(r.module_id);
    e.semanas.add(r.semana_numero);
    const p = userPlanilla.get(r.user_id);
    if (p) e.planillas.add(p);
    if (l.youtube_id) e.yt.add(l.youtube_id);
  }
}
for (const [t, e] of dog) {
  console.log(`  "${t}"  modulos:${[...e.modules].join(',')}  semanas:${[...e.semanas].join(',')}  planillas:${[...e.planillas].join(',')}  yt:${[...e.yt].join(',') || '(vacio)'}`);
}
if (dog.size === 0) console.log('  (no encontrado)');
