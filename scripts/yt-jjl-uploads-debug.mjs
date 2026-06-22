// READ-ONLY debug: dump completo de la playlist uploads de JJL para ver
// QUÉ items efectivamente devuelve la API y por qué.
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const tk = await (async () => {
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
  return (await r.json()).access_token;
})();

const playlistId = 'UU' + env.YOUTUBE_CHANNEL_ID.slice(2);
console.log(`Playlist uploads del canal: ${playlistId}\n`);

let pageToken; let pageNum = 0; let total = 0;
do {
  pageNum++;
  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  url.searchParams.set('part', 'snippet,contentDetails,status');
  url.searchParams.set('playlistId', playlistId);
  url.searchParams.set('maxResults', '50');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
  if (!r.ok) {
    console.error(`Pagina ${pageNum} ERROR: ${r.status} ${await r.text()}`);
    break;
  }
  const j = await r.json();
  console.log(`--- Pagina ${pageNum} (${(j.items || []).length} items) ---`);
  for (const it of j.items || []) {
    const s = it.snippet || {};
    const cd = it.contentDetails || {};
    const st = it.status || {};
    console.log(`  ${cd.videoPublishedAt || s.publishedAt || '?'}  [${st.privacyStatus || '?'}]  ${cd.videoId || s.resourceId?.videoId}  "${(s.title || '').slice(0, 70)}"`);
    total++;
  }
  pageToken = j.nextPageToken;
  if (pageNum > 30) { console.log('(corto en 30 paginas)'); break; }
} while (pageToken);

console.log(`\nTotal items: ${total}`);

// Tambien probamos /videos directamente con mine=true e id por busqueda
console.log(`\n--- search.list forMine=true (orden:date, sin q ni channelId) ---`);
const url2 = new URL('https://www.googleapis.com/youtube/v3/search');
url2.searchParams.set('part', 'snippet');
url2.searchParams.set('forMine', 'true');
url2.searchParams.set('type', 'video');
url2.searchParams.set('maxResults', '20');
url2.searchParams.set('order', 'date');
const r2 = await fetch(url2, { headers: { Authorization: `Bearer ${tk}` } });
if (!r2.ok) console.log(`ERROR ${r2.status}: ${(await r2.text()).slice(0, 200)}`);
else {
  const j2 = await r2.json();
  console.log(`Items: ${(j2.items || []).length}`);
  for (const it of j2.items || []) {
    const s = it.snippet || {};
    console.log(`  ${s.publishedAt || '?'}  ${it.id?.videoId}  "${(s.title || '').slice(0, 70)}"`);
  }
}
