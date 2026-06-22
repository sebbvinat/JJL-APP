// READ-ONLY. Match fuzzy: para cada YT video, busca lecciones en
// course_data con palabras en comun (token overlap) y rankea por score.
// Pensado para que el humano elija el match real cuando el titulo no es
// identico al de la leccion.
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const inputIds = [
  '-B97okiJVXM', 'MZyqmPmMqw0', 'MCHEDVVgW7w', 'PMzOdI-sIUQ',
  'mkdiCNxv9Wg', 'tRca9K3uKhA', 'I3xwhKkNfMU', 'qwVhIy4UXJY',
  'lh4UFXN1ftI', 'iWMphA07aGE', 'pzvQ6NvGkms', 'tAW7KCFqErE',
  'rqUDASE_fh0', 'nEX_NCNiBqE', 'q4j4P_DxJO0', 'S9q2PeuzK54',
  '5NwxALuzMiw', '2nErg-rCgzA', 'inimo4uUxYE', 'hR-GSqv0LMM',
];
const ids = [...new Set(inputIds)];

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
  return (await r.json()).access_token;
}

const tk = await getAccessToken();
const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.join(',')}`, {
  headers: { Authorization: `Bearer ${tk}` },
});
const j = await r.json();
const metas = (j.items || []).map((it) => ({
  id: it.id, title: it.snippet?.title || '',
}));

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const { data: rows } = await sb.from('course_data').select('module_id, lessons');

const nk = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
const STOPWORDS = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'a', 'con', 'del', 'desde', 'que']);
const tokenize = (s) => nk(s)
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter((t) => t.length >= 2 && !STOPWORDS.has(t));

// Indice de lecciones unicas por titulo normalizado
const lessonIndex = new Map(); // normTitle -> { modules: Set, currentYtIds: Set, rowCount, originalTitulo, tokens: Set }
for (const row of rows || []) {
  for (const l of (row.lessons || [])) {
    const t = nk(l?.titulo || '');
    if (!t) continue;
    if (!lessonIndex.has(t)) {
      lessonIndex.set(t, {
        modules: new Set(), currentYtIds: new Set(), rowCount: 0,
        originalTitulo: l.titulo, tokens: new Set(tokenize(l.titulo)),
      });
    }
    const e = lessonIndex.get(t);
    e.modules.add(row.module_id);
    if (l.youtube_id) e.currentYtIds.add(l.youtube_id);
    e.rowCount++;
  }
}

function scoreMatch(ytTokens, lessonTokens) {
  if (ytTokens.size === 0 || lessonTokens.size === 0) return 0;
  let inter = 0;
  for (const t of ytTokens) if (lessonTokens.has(t)) inter++;
  // Jaccard-ish, pero ponderado a favor de cobertura del YT title
  const yt_cov = inter / ytTokens.size;
  const ls_cov = inter / lessonTokens.size;
  return yt_cov * 0.7 + ls_cov * 0.3;
}

const results = [];
for (const m of metas) {
  const ytTokens = new Set(tokenize(m.title));
  const candidates = [];
  for (const [normTitle, info] of lessonIndex) {
    const sc = scoreMatch(ytTokens, info.tokens);
    if (sc >= 0.3) {
      candidates.push({
        score: sc, leccion_titulo: info.originalTitulo, leccion_norm: normTitle,
        modules: [...info.modules], current: [...info.currentYtIds], rowCount: info.rowCount,
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  results.push({ yt: m, candidates: candidates.slice(0, 5) });
}

// Imprimir
console.log(`\n=== Match fuzzy: ${results.length} videos del 1/6 ===\n`);
results.forEach((r, i) => {
  const m = r.yt;
  console.log(`${(i + 1).toString().padStart(2)}. YT  ${m.id}  "${m.title}"`);
  if (r.candidates.length === 0) {
    console.log(`    ⚪ Sin candidatos en course_data`);
  } else {
    r.candidates.forEach((c, j) => {
      const isSame = c.current.length === 1 && c.current[0] === m.id;
      const marker = isSame ? '🟡 YA APLICADO' : (c.current[0] ? `🟢 reemplaza ${c.current[0]}` : '🟢 lección sin YT actual');
      console.log(`    ${j + 1}) [score ${(c.score * 100).toFixed(0)}%]  "${c.leccion_titulo}"  → ${marker} · ${c.rowCount} filas (${c.modules.join(', ')})`);
    });
  }
  console.log('');
});

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(new URL(`./yt-fuzzy-${stamp}.json`, import.meta.url), JSON.stringify(results, null, 2));
console.log(`Snapshot: scripts/yt-fuzzy-${stamp}.json`);
