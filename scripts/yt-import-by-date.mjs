// READ-ONLY. Lista TODOS los uploads del canal JJL Latino (incluidos
// unlisted) via playlistItems.list de la playlist 'uploads' del canal.
// Filtra los que matchean exclude regex y los cruza con course_data.
//
// Uso: node scripts/yt-import-by-date.mjs [date YYYY-MM-DD] [exclude]
// Defaults: 2026-06-01, "ADN DISTANCIA MEDIA"
//
// NOTA: search.list?channelId=X solo trae publicos. playlistItems.list
// sobre uploadsPlaylist trae todo lo que el usuario autenticado tiene
// permiso de ver — incluyendo unlisted si sos owner/manager del canal.

import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const date = process.argv[2] || '2026-06-01';
const excludeStr = process.argv[3] ?? 'ADN DISTANCIA MEDIA';
const exclude = excludeStr ? new RegExp(excludeStr, 'i') : null;

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('date debe ser YYYY-MM-DD'); process.exit(1);
}

const afterTs = new Date(`${date}T00:00:00Z`).getTime();
const beforeDate = new Date(`${date}T00:00:00Z`); beforeDate.setUTCDate(beforeDate.getUTCDate() + 1);
const beforeTs = beforeDate.getTime();

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.YOUTUBE_CLIENT_ID,
      client_secret: env.YOUTUBE_CLIENT_SECRET,
      refresh_token: env.YOUTUBE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

// Uploads playlist del canal JJL: el ID es el channelId con la C inicial -> UU
function uploadsPlaylistFor(channelId) {
  // channelId empieza con UC, uploadsPlaylist es UU + el resto
  return channelId.startsWith('UC') ? 'UU' + channelId.slice(2) : null;
}

async function listAllPlaylistItems(token, playlistId) {
  const all = [];
  let pageToken;
  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`playlistItems ${res.status}: ${await res.text()}`);
    const j = await res.json();
    for (const it of j.items || []) {
      const s = it.snippet || {};
      const cd = it.contentDetails || {};
      all.push({
        id: cd.videoId || s.resourceId?.videoId,
        title: s.title || '',
        publishedAt: cd.videoPublishedAt || s.publishedAt || '', // videoPublishedAt es el real, publishedAt es cuando se agregó a la playlist
      });
    }
    pageToken = j.nextPageToken;
    // Cortamos paginacion temprano si ya pasamos la fecha objetivo (uploads
    // playlist viene en orden cronologico inverso, mas nuevos primero)
    if (all.length > 0) {
      const oldestSoFar = all[all.length - 1].publishedAt;
      if (oldestSoFar && new Date(oldestSoFar).getTime() < afterTs) break;
    }
  } while (pageToken);
  return all;
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const nk = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

console.log(`\n=== YouTube import por fecha ===`);
console.log(`Fecha (UTC):     ${date}`);
console.log(`Exclude:         ${excludeStr || '(nada)'}`);
console.log(`Canal target:    ${env.YOUTUBE_CHANNEL_ID}\n`);

const token = await getAccessToken();
const playlistId = uploadsPlaylistFor(env.YOUTUBE_CHANNEL_ID);
console.log(`Listando playlist uploads ${playlistId}...`);
const allItems = await listAllPlaylistItems(token, playlistId);
console.log(`Total items traidos (con paginacion temprana): ${allItems.length}\n`);

// Filtrar por fecha
const inDate = allItems.filter((v) => {
  if (!v.publishedAt) return false;
  const t = new Date(v.publishedAt).getTime();
  return t >= afterTs && t < beforeTs;
});
console.log(`Subidos en ${date} (UTC): ${inDate.length}`);
const filtered = inDate.filter((v) => !exclude || !exclude.test(v.title));
console.log(`Tras exclude:           ${filtered.length}\n`);

// Indexar course_data
const { data: rows } = await sb.from('course_data').select('module_id, lessons');
const indexByTitle = new Map();
for (const r of rows || []) {
  for (const l of (r.lessons || [])) {
    const t = nk(l?.titulo || '');
    if (!t) continue;
    if (!indexByTitle.has(t)) indexByTitle.set(t, { modules: new Set(), currentYtIds: new Set(), rowCount: 0 });
    const e = indexByTitle.get(t);
    e.modules.add(r.module_id);
    if (l.youtube_id) e.currentYtIds.add(l.youtube_id);
    e.rowCount++;
  }
}

// Clasificar
const groups = { replace: [], same: [], nomatch: [] };
for (const v of filtered) {
  const t = nk(v.title);
  const e = indexByTitle.get(t);
  if (!e) { groups.nomatch.push(v); continue; }
  const cur = [...e.currentYtIds];
  const isSame = cur.length === 1 && cur[0] === v.id;
  if (isSame) groups.same.push({ ...v, modules: [...e.modules], current: cur, rowCount: e.rowCount });
  else groups.replace.push({ ...v, modules: [...e.modules], current: cur, rowCount: e.rowCount });
}

console.log(`🟢 PARA REEMPLAZAR: ${groups.replace.length}`);
console.log(`🟡 YA ESTÁN:       ${groups.same.length}`);
console.log(`⚪ SIN MATCH:      ${groups.nomatch.length}\n`);

if (groups.replace.length) {
  console.log('--- 🟢 PARA REEMPLAZAR ---');
  groups.replace.forEach((v, i) => {
    console.log(`${i + 1}. "${v.title}"`);
    console.log(`   nuevo: ${v.id}  | actual: ${v.current.join(', ') || '(vacío)'}`);
    console.log(`   ${v.rowCount} filas · modulos: ${v.modules.join(', ')}`);
  });
  console.log('');
}
if (groups.same.length) {
  console.log('--- 🟡 YA ESTÁN ---');
  groups.same.forEach((v) => console.log(`  · ${v.title}  (${v.id})`));
  console.log('');
}
if (groups.nomatch.length) {
  console.log('--- ⚪ SIN MATCH ---');
  groups.nomatch.forEach((v) => console.log(`  · ${v.title}  (${v.id})`));
  console.log('');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(new URL(`./yt-import-${stamp}.json`, import.meta.url), JSON.stringify({
  date, excludeStr, replace: groups.replace, same: groups.same, nomatch: groups.nomatch,
}, null, 2));
console.log(`Snapshot: scripts/yt-import-${stamp}.json`);
