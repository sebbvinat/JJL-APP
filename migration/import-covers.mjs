// Importa las portadas reales de los cursos desde WordPress.
// Lee el _thumbnail_id de cada curso, busca el archivo en wp_postmeta,
// lo descarga de jiujitsulatino.com, lo guarda en public/cursos/covers/,
// y actualiza cursos_courses.cover_url en Supabase.
//
// Uso: node --env-file=.env.local --max-old-space-size=4096 migration/import-covers.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SQL_PATH = 'C:/Users/sebas/Downloads/u863922915_re2q1.sql';
const COVERS_DIR = 'public/cursos/covers';
const WP_BASE = 'https://jiujitsulatino.com';

const SLUG_MAP = {
  26595: 'front-headlock',
  26701: 'escapes-de-la-espalda',
  26702: 'retencion-de-guardia',
  28557: 'fundamento-adn-guardia',
  28643: 'fundamento-adn-escapes',
  28692: 'fundamento-adn-control-finalizacion',
  29023: 'fundamento-adn-pasaje-de-guardia',
};
const TARGET_IDS = new Set(Object.keys(SLUG_MAP).map(Number));

// ---------- 1. _thumbnail_id por curso ----------
const data = JSON.parse(fs.readFileSync('migration/extracted.json', 'utf8'));
const metaByPost = new Map();
for (const m of data.postmeta) {
  if (!metaByPost.has(m.post_id)) metaByPost.set(m.post_id, []);
  metaByPost.get(m.post_id).push(m);
}

const wpToThumbId = {}; // wpCourseId -> attachmentId
for (const wpId of TARGET_IDS) {
  const meta = metaByPost.get(wpId) ?? [];
  const t = meta.find((m) => m.meta_key === '_thumbnail_id');
  if (t) wpToThumbId[wpId] = Number(t.meta_value);
}
console.log('Thumbnails por curso:', wpToThumbId);
const wantedAttachIds = new Set(Object.values(wpToThumbId));
if (wantedAttachIds.size === 0) {
  console.log('No hay thumbnails. Salida.');
  process.exit(0);
}

// ---------- 2. Parser SQL para sacar _wp_attached_file ----------
console.log('Cargando dump...');
const sql = fs.readFileSync(SQL_PATH, 'utf8');

function createTableColumns(table) {
  const head = 'CREATE TABLE `' + table + '`';
  const i = sql.indexOf(head);
  if (i === -1) return null;
  const start = sql.indexOf('(', i);
  let depth = 0;
  let j = start;
  while (j < sql.length) {
    if (sql[j] === '(') depth++;
    else if (sql[j] === ')') {
      depth--;
      if (depth === 0) break;
    }
    j++;
  }
  const body = sql.slice(start + 1, j);
  const cols = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*`([^`]+)`/);
    if (m && !['PRIMARY', 'KEY', 'UNIQUE', 'CONSTRAINT', 'FULLTEXT', 'INDEX', 'SPATIAL'].includes(m[1].toUpperCase())) {
      cols.push(m[1]);
    }
  }
  return cols;
}

function parseTuple(idx) {
  const n = sql.length;
  let i = idx + 1;
  const values = [];
  while (i < n) {
    while (i < n && /\s/.test(sql[i])) i++;
    if (sql[i] === ')') return { values, end: i + 1 };
    if (sql[i] === ',') { i++; continue; }
    if (sql[i] === "'") {
      i++;
      let s = '';
      while (i < n) {
        const c = sql[i];
        if (c === '\\') {
          const nx = sql[i + 1];
          if (nx === 'n') s += '\n';
          else if (nx === 't') s += '\t';
          else if (nx === 'r') s += '\r';
          else if (nx === '0') s += '\0';
          else s += nx;
          i += 2;
        } else if (c === "'") {
          if (sql[i + 1] === "'") { s += "'"; i += 2; }
          else { i++; break; }
        } else { s += c; i++; }
      }
      values.push(s);
    } else {
      let t = '';
      while (i < n && sql[i] !== ',' && sql[i] !== ')') { t += sql[i]; i++; }
      t = t.trim();
      values.push(t === 'NULL' ? null : t);
    }
  }
  return { values, end: i };
}

function eachRow(table, onRow) {
  const cols = createTableColumns(table);
  const needle = 'INSERT INTO `' + table + '`';
  let i = 0;
  while ((i = sql.indexOf(needle, i)) !== -1) {
    const afterTable = i + needle.length;
    const valuesIdx = sql.indexOf(' VALUES', afterTable);
    if (valuesIdx === -1) break;
    let columns = cols;
    const between = sql.slice(afterTable, valuesIdx).trim();
    if (between.startsWith('(')) {
      const closeParen = between.lastIndexOf(')');
      columns = between.slice(1, closeParen).split(',').map((c) => c.trim().replace(/`/g, ''));
    }
    let p = valuesIdx + ' VALUES'.length;
    while (p < sql.length && /\s/.test(sql[p])) p++;
    while (p < sql.length && sql[p] === '(') {
      const { values, end } = parseTuple(p);
      const row = {};
      for (let k = 0; k < columns.length; k++) row[columns[k]] = values[k] ?? null;
      onRow(row);
      p = end;
      while (p < sql.length && /\s/.test(sql[p])) p++;
      if (sql[p] === ',') { p++; while (p < sql.length && /\s/.test(sql[p])) p++; continue; }
      if (sql[p] === ';') break;
    }
    i = p;
  }
}

// ---------- 3. Buscar _wp_attached_file para los attachment IDs ----------
console.log('Buscando archivos en wp_postmeta...');
const attachToFile = {};
eachRow('wp_postmeta', (r) => {
  if (r.meta_key !== '_wp_attached_file') return;
  const pid = Number(r.post_id);
  if (wantedAttachIds.has(pid)) attachToFile[pid] = r.meta_value;
});
console.log('Archivos encontrados:', attachToFile);

// ---------- 4. Descargar y guardar ----------
fs.mkdirSync(COVERS_DIR, { recursive: true });
const slugToCoverPath = {};
for (const [wpCourseId, slug] of Object.entries(SLUG_MAP)) {
  const attId = wpToThumbId[wpCourseId];
  if (!attId) continue;
  const file = attachToFile[attId];
  if (!file) continue;
  const ext = path.extname(file).toLowerCase() || '.jpg';
  const localName = `${slug}${ext}`;
  const localPath = path.join(COVERS_DIR, localName);
  const url = `${WP_BASE}/wp-content/uploads/${file}`;
  process.stdout.write(`  ↓ ${slug} ← ${url} ... `);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`FALLO (${res.status})`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(localPath, buf);
    console.log(`OK (${(buf.length / 1024).toFixed(0)} KB)`);
    slugToCoverPath[slug] = `/cursos/covers/${localName}`;
  } catch (e) {
    console.log(`ERROR ${e.message}`);
  }
}

// ---------- 5. UPDATE cursos_courses.cover_url ----------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
console.log('\nActualizando cover_url en Supabase...');
let upd = 0;
for (const [slug, coverPath] of Object.entries(slugToCoverPath)) {
  const { error } = await supabase
    .from('cursos_courses')
    .update({ cover_url: coverPath })
    .eq('slug', slug);
  if (error) console.error(`  ✗ ${slug}: ${error.message}`);
  else {
    console.log(`  ✓ ${slug} → ${coverPath}`);
    upd++;
  }
}
console.log(`\n✓ ${upd} portadas listas.`);
