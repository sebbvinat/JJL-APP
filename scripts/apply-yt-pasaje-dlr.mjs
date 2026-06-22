// Reemplaza los 3 videos de Pasaje DLR en los alumnos con planilla MEDIOS,
// semana 9 ("Pasaje De la Riva + De la Riva I"). Match por titulo exacto.
// Idempotente. Backup completo del array `lessons` por alumno → reversible.
//
// Uso:
//   node scripts/apply-yt-pasaje-dlr.mjs           → aplica
//   node scripts/apply-yt-pasaje-dlr.mjs --revert  → restaura el backup
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

// Mapeo titulo → youtube_id NUEVO
const NEW_IDS = {
  'Conceptos Pasaje De la Riva': 'Fu8VKpEh1R0',
  'Pasaje De la Riva 1':         '1puX4ukkyPk',
  'Drill 1: Pasaje de la Riva':  'hK7M5_dqg6o',
};

const BACKUP_FILE = new URL('./apply-yt-pasaje-dlr-backup.json', import.meta.url);

// ── Modo revert ──────────────────────────────────────────────────────────
if (process.argv.includes('--revert')) {
  if (!existsSync(BACKUP_FILE)) { console.error('No hay backup. Abort.'); process.exit(1); }
  const prev = JSON.parse(readFileSync(BACKUP_FILE, 'utf8'));
  console.log('Revirtiendo', prev.length, 'rows…');
  for (const row of prev) {
    const { error } = await sb.from('course_data').update({ lessons: row.lessons })
      .eq('user_id', row.user_id).eq('module_id', row.module_id);
    if (error) console.error('  ✗', row.user_id, '→', error.message);
    else console.log('  ✓', row.user_id);
  }
  console.log('Reverted.');
  process.exit(0);
}

// ── Aplicar ──────────────────────────────────────────────────────────────
// 1) Encontrar los 8 alumnos MEDIOS
const { data: alumnos } = await sb.from('users').select('id, nombre').eq('planilla_id', 'medios');
console.log('Alumnos MEDIOS:', alumnos.length);

// 2) Por cada uno: leer row sem 9, hacer backup, aplicar reemplazo
const backups = [];
let updated = 0, skipped = 0;

for (const a of alumnos) {
  const { data: row } = await sb.from('course_data')
    .select('user_id, module_id, semana_numero, lessons')
    .eq('user_id', a.id).eq('semana_numero', 9).maybeSingle();
  if (!row) { console.log('  ⚠️  ', a.nombre, ': sin row sem 9'); skipped++; continue; }

  // Backup completo de las lessons originales (para revert exacto)
  backups.push({ user_id: row.user_id, module_id: row.module_id, lessons: row.lessons });

  // Construir nueva lista de lessons con los IDs nuevos donde matchee titulo
  let touchedCount = 0;
  const newLessons = row.lessons.map((l) => {
    const newId = NEW_IDS[l.titulo];
    if (newId && l.youtube_id !== newId) {
      touchedCount++;
      return { ...l, youtube_id: newId };
    }
    return l;
  });

  if (touchedCount === 0) { console.log('  =', a.nombre, ': ya tenía los IDs nuevos (idempotente)'); skipped++; continue; }

  const { error: upErr } = await sb.from('course_data').update({ lessons: newLessons })
    .eq('user_id', row.user_id).eq('module_id', row.module_id);
  if (upErr) { console.error('  ✗', a.nombre, ':', upErr.message); continue; }
  console.log('  ✓', a.nombre, '→', touchedCount, 'videos actualizados');
  updated++;
}

writeFileSync(BACKUP_FILE, JSON.stringify(backups, null, 2));
console.log('\nBackup guardado en', BACKUP_FILE.pathname);
console.log(`Resumen: ${updated} alumnos actualizados, ${skipped} skip.`);
console.log('--- Para revertir: node scripts/apply-yt-pasaje-dlr.mjs --revert ---');
