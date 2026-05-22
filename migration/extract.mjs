// Extractor del dump SQL de WordPress (TutorLMS + WooCommerce) a JSON limpio.
// Lee el .sql completo y saca solo lo necesario: posts (cursos/secciones/
// lecciones/enrollments), su postmeta, y users. Salida en extracted.json.
//
// Uso: node --max-old-space-size=4096 migration/extract.mjs <ruta.sql>

import fs from 'node:fs';

const SQL_PATH = process.argv[2] ?? 'C:/Users/sebas/Downloads/u863922915_re2q1.sql';
const OUT_PATH = 'migration/extracted.json';

const WANT_POST_TYPES = new Set([
  'courses',
  'topics',
  'lesson',
  'tutor_enrolled',
  'course-bundle',
]);

console.log(`Cargando ${SQL_PATH}…`);
const sql = fs.readFileSync(SQL_PATH, 'utf8');
console.log(`  ${(sql.length / 1024 / 1024).toFixed(1)} MB en memoria.`);

// ---------- Parsers ----------

// Devuelve un array de columnas según el CREATE TABLE de la tabla dada.
function createTableColumns(table) {
  const head = 'CREATE TABLE `' + table + '`';
  const i = sql.indexOf(head);
  if (i === -1) return null;
  const start = sql.indexOf('(', i);
  // Encontrar el cierre balanceado de paréntesis para el CREATE TABLE.
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
      // Excluir índices: las líneas de KEY no empiezan por `col` (las saqué arriba)
      cols.push(m[1]);
    }
  }
  return cols;
}

// Parsea una tupla SQL `(v,v,...)` empezando en idx (apuntando al `(`).
// Devuelve { values, end }. end es el índice justo después del `)`.
function parseTuple(idx) {
  const n = sql.length;
  let i = idx + 1; // pasar `(`
  const values = [];
  while (i < n) {
    while (i < n && (sql[i] === ' ' || sql[i] === '\t' || sql[i] === '\n' || sql[i] === '\r')) i++;
    if (sql[i] === ')') {
      i++;
      return { values, end: i };
    }
    if (sql[i] === ',') { i++; continue; }
    if (sql[i] === "'") {
      // string con escapes de mysql
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
          else if (nx === 'Z') s += '\x1a';
          else s += nx;
          i += 2;
        } else if (c === "'") {
          if (sql[i + 1] === "'") { s += "'"; i += 2; }
          else { i++; break; }
        } else { s += c; i++; }
      }
      values.push(s);
    } else {
      // bare token: número, NULL, true/false
      let t = '';
      while (i < n && sql[i] !== ',' && sql[i] !== ')') { t += sql[i]; i++; }
      t = t.trim();
      values.push(t === 'NULL' ? null : t);
    }
  }
  return { values, end: i };
}

// Itera todas las tuplas de los INSERTs hacia la tabla dada.
// onRow recibe un objeto {col: value} por fila.
function eachRow(table, onRow) {
  const cols = createTableColumns(table);
  const needle = 'INSERT INTO `' + table + '`';
  let i = 0;
  while ((i = sql.indexOf(needle, i)) !== -1) {
    // Localizar VALUES
    const afterTable = i + needle.length;
    const valuesIdx = sql.indexOf(' VALUES', afterTable);
    if (valuesIdx === -1) break;
    // ¿Hay lista de columnas explícita entre la tabla y VALUES?
    let columns = cols;
    const between = sql.slice(afterTable, valuesIdx).trim();
    if (between.startsWith('(')) {
      const closeParen = between.lastIndexOf(')');
      columns = between.slice(1, closeParen).split(',').map((c) => c.trim().replace(/`/g, ''));
    }
    // Parsear tuplas desde justo después de VALUES
    let p = valuesIdx + ' VALUES'.length;
    // Saltar espacios
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

// ---------- Pass 1: wp_posts ----------
console.log('Escaneando wp_posts…');
const posts = [];
const postIdSet = new Set();
const typeCount = {};
eachRow('wp_posts', (r) => {
  const tipo = r.post_type;
  typeCount[tipo] = (typeCount[tipo] ?? 0) + 1;
  if (!WANT_POST_TYPES.has(tipo)) return;
  posts.push({
    ID: Number(r.ID),
    post_author: Number(r.post_author),
    post_date: r.post_date,
    post_content: r.post_content,
    post_title: r.post_title,
    post_status: r.post_status,
    post_name: r.post_name,
    post_parent: Number(r.post_parent),
    menu_order: Number(r.menu_order),
    post_type: tipo,
  });
  postIdSet.add(Number(r.ID));
});
console.log(`  posts totales por tipo:`, typeCount);
console.log(`  posts retenidos: ${posts.length} (IDs únicos: ${postIdSet.size})`);

// ---------- Pass 2: wp_postmeta filtrado por post_id ----------
console.log('Escaneando wp_postmeta…');
const postmeta = [];
let metaSeen = 0;
eachRow('wp_postmeta', (r) => {
  metaSeen++;
  const pid = Number(r.post_id);
  if (!postIdSet.has(pid)) return;
  postmeta.push({
    post_id: pid,
    meta_key: r.meta_key,
    meta_value: r.meta_value,
  });
});
console.log(`  postmeta filas escaneadas: ${metaSeen}, retenidas: ${postmeta.length}`);

// ---------- Pass 3: wp_users ----------
console.log('Escaneando wp_users…');
const users = [];
eachRow('wp_users', (r) => {
  users.push({
    ID: Number(r.ID),
    user_login: r.user_login,
    user_email: r.user_email,
    display_name: r.display_name,
    user_registered: r.user_registered,
  });
});
console.log(`  usuarios: ${users.length}`);

// ---------- Salida ----------
const out = { posts, postmeta, users, generated_at: new Date().toISOString() };
fs.writeFileSync(OUT_PATH, JSON.stringify(out));
const stat = fs.statSync(OUT_PATH);
console.log(`\nListo. ${OUT_PATH} (${(stat.size / 1024 / 1024).toFixed(1)} MB).`);
