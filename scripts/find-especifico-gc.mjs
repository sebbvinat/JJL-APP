// READ-ONLY: ubica "Específico de guardia cerrada" en course_data
// y muestra qué hay actualmente en Mes 2 sem 1 (=sem 5) de cada planilla.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const nk = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
const TARGET = nk('Específico de guardia cerrada');

const { data: users } = await sb.from('users').select('id, planilla_id').not('planilla_id', 'is', null);
const userPlanilla = new Map((users || []).map((u) => [u.id, u.planilla_id]));

const { data: rows } = await sb.from('course_data').select('user_id, module_id, semana_numero, titulo, lessons');

console.log('========== ¿DÓNDE EXISTE "Específico de guardia cerrada" HOY? ==========\n');
const places = new Map(); // key: planilla|sem|module|moduleTitulo -> { yt, count }
for (const r of rows || []) {
  const p = userPlanilla.get(r.user_id);
  if (!p) continue;
  for (const l of (r.lessons || [])) {
    if (nk(l?.titulo) !== TARGET) continue;
    const k = `${p}|sem ${r.semana_numero}|${r.module_id}|${r.titulo}`;
    if (!places.has(k)) places.set(k, { yt: new Set(), count: 0 });
    const e = places.get(k);
    e.count++;
    if (l.youtube_id) e.yt.add(l.youtube_id);
  }
}
if (places.size === 0) console.log('  ❌ NO existe en ningún course_data');
else for (const [k, e] of places) {
  console.log(`  ${k}  → ${e.count} alumno${e.count === 1 ? '' : 's'}  yt: ${[...e.yt].join(',') || '(vacío)'}`);
}

console.log('\n========== QUÉ HAY HOY EN SEM 5 (=Mes 2 sem 1) DE CADA PLANILLA ==========');
function dumpSem(planilla, semana) {
  // Buscar un user de esa planilla con sem 5
  const userOfPlanilla = [...userPlanilla.entries()].find(([, p]) => p === planilla)?.[0];
  if (!userOfPlanilla) { console.log(`\n${planilla}: sin usuarios con esa planilla`); return; }
  const r = (rows || []).find((x) => x.user_id === userOfPlanilla && x.semana_numero === semana);
  if (!r) { console.log(`\n${planilla} sem ${semana}: sin curso cargado para esa semana`); return; }
  console.log(`\n${planilla.toUpperCase()} sem ${semana}  "${r.titulo}"  (modulo ${r.module_id})`);
  for (const l of (r.lessons || [])) {
    if (l?.tipo === 'reflection') continue;
    console.log(`  ${l.orden ?? '?'}. ${l.titulo}  ${l.youtube_id ? '[yt:' + l.youtube_id + ']' : '[sin yt]'}`);
  }
}
for (const p of ['livianos', 'medios', 'simbio', 'atleticos']) dumpSem(p, 5);
