// READ-ONLY. Toma una lista de YouTube IDs, pide metadata a la API, y
// los cruza con course_data para mostrar qué lecciones serían
// reemplazadas (por título normalizado).
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

// Lista de IDs a procesar (los 21 del user, 1 duplicado)
const inputIds = [
  '-B97okiJVXM', 'MZyqmPmMqw0', 'MCHEDVVgW7w', 'PMzOdI-sIUQ',
  'mkdiCNxv9Wg', 'tRca9K3uKhA', 'I3xwhKkNfMU', 'qwVhIy4UXJY',
  'lh4UFXN1ftI', 'iWMphA07aGE', 'pzvQ6NvGkms', 'tAW7KCFqErE',
  'rqUDASE_fh0', 'nEX_NCNiBqE', 'q4j4P_DxJO0', 'S9q2PeuzK54',
  '5NwxALuzMiw', '2nErg-rCgzA', 'inimo4uUxYE', 'hR-GSqv0LMM',
];
const ids = [...new Set(inputIds)];
console.log(`Procesando ${ids.length} IDs únicos (de ${inputIds.length} provistos)\n`);

async function getAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.YOUTUBE_CLIENT_ID,
      client_secret: env.YOUTUBE_CLIENT_SECRET,
      refresh_token: env.YOUTUBE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) throw new Error(`Token refresh ${r.status}`);
  return (await r.json()).access_token;
}

const tk = await getAccessToken();

// Pido metadata de los 20 en una sola llamada (videos.list acepta hasta 50)
const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${ids.join(',')}`, {
  headers: { Authorization: `Bearer ${tk}` },
});
if (!r.ok) { console.error(await r.text()); process.exit(1); }
const j = await r.json();

const metaById = new Map();
for (const it of j.items || []) {
  metaById.set(it.id, {
    id: it.id,
    title: it.snippet?.title || '',
    publishedAt: it.snippet?.publishedAt || '',
    privacyStatus: it.status?.privacyStatus || '?',
    channelId: it.snippet?.channelId || '',
  });
}
const missingIds = ids.filter((id) => !metaById.has(id));

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const { data: rows } = await sb.from('course_data').select('module_id, lessons');
const nk = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

const indexByTitle = new Map();
for (const row of rows || []) {
  for (const l of (row.lessons || [])) {
    const t = nk(l?.titulo || '');
    if (!t) continue;
    if (!indexByTitle.has(t)) indexByTitle.set(t, { modules: new Set(), currentYtIds: new Set(), rowCount: 0, originalTitulos: new Set() });
    const e = indexByTitle.get(t);
    e.modules.add(row.module_id);
    if (l.youtube_id) e.currentYtIds.add(l.youtube_id);
    e.originalTitulos.add(l.titulo);
    e.rowCount++;
  }
}

const groups = { replace: [], same: [], nomatch: [], notfound: [] };
for (const id of ids) {
  const m = metaById.get(id);
  if (!m) { groups.notfound.push({ id }); continue; }
  const t = nk(m.title);
  const e = indexByTitle.get(t);
  if (!e) { groups.nomatch.push(m); continue; }
  const cur = [...e.currentYtIds];
  const isSame = cur.length === 1 && cur[0] === m.id;
  const entry = {
    ...m, modules: [...e.modules], current: cur, rowCount: e.rowCount,
    originalTitulo: [...e.originalTitulos][0] || m.title,
  };
  if (isSame) groups.same.push(entry);
  else groups.replace.push(entry);
}

console.log(`🟢 PARA REEMPLAZAR: ${groups.replace.length}`);
console.log(`🟡 YA ESTÁN:       ${groups.same.length}`);
console.log(`⚪ SIN MATCH:      ${groups.nomatch.length}`);
console.log(`❌ NO ACCESIBLE:   ${groups.notfound.length}\n`);

if (groups.replace.length) {
  console.log('--- 🟢 PARA REEMPLAZAR ---');
  groups.replace.forEach((v, i) => {
    console.log(`${i + 1}. "${v.title}"  [${v.privacyStatus}]  ${v.publishedAt.slice(0, 10)}`);
    console.log(`   YT nuevo: ${v.id}   YT actual: ${v.current.join(', ') || '(vacío)'}`);
    console.log(`   Reemplaza en ${v.rowCount} fila${v.rowCount === 1 ? '' : 's'} de course_data (${v.modules.length} módulo${v.modules.length === 1 ? '' : 's'}: ${v.modules.join(', ')})`);
    console.log('');
  });
}
if (groups.same.length) {
  console.log('--- 🟡 YA APLICADOS ---');
  groups.same.forEach((v) => console.log(`  ${v.id}  "${v.title}"`));
  console.log('');
}
if (groups.nomatch.length) {
  console.log('--- ⚪ SIN MATCH (titulo no encontrado en ninguna lección) ---');
  groups.nomatch.forEach((v) => console.log(`  ${v.id}  [${v.privacyStatus}]  "${v.title}"`));
  console.log('');
}
if (groups.notfound.length) {
  console.log('--- ❌ NO ACCESIBLE / NO EXISTE ---');
  groups.notfound.forEach((v) => console.log(`  ${v.id}`));
  console.log('');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(new URL(`./yt-match-${stamp}.json`, import.meta.url),
  JSON.stringify({ replace: groups.replace, same: groups.same, nomatch: groups.nomatch, notfound: groups.notfound }, null, 2));
console.log(`Snapshot: scripts/yt-match-${stamp}.json`);
