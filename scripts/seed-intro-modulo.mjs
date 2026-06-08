// seed-intro-modulo — agrega el módulo "Cómo usar la app" (mod-intro,
// semana_numero=-1) a todos los alumnos que tienen planilla asignada.
//
// Para cada alumno:
//   1) Upsert en course_data: módulo mod-intro con las 5 lecciones.
//   2) Upsert en user_access: is_unlocked=true (siempre).
//
// Idempotente: si el alumno ya tiene mod-intro, lo deja como está (upsert
// con ignoreDuplicates para no pisar progreso).
//
// Backup completo de course_data antes de tocar nada.
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

// Plantilla de las 5 lecciones del módulo intro. Se replican por alumno con
// lesson IDs que incluyen su planilla (mismo schema que getPlanillaForSave).
const INTRO_LESSONS_TEMPLATE = [
  { titulo: 'Intro + Módulos',         youtube_id: '0JfFIickw04', descripcion: '' },
  {
    titulo: 'El Diario',
    youtube_id: 'xwozOn-7olk',
    descripcion: 'Importante: bajá la aplicación al celular — la vas a usar durante el entrenamiento para leer tus objetivos y anotar en el diario. Para descargarla, andá a https://alumno.jiujitsulatino.com desde tu celular: te va a ofrecer instalar la app, o vas a ver la opción de "Instalar en escritorio" (o similar) según tu navegador.',
  },
  { titulo: 'Subir Videos',            youtube_id: 'r8snUHF1jnQ', descripcion: '' },
  { titulo: 'Chat y Soporte',          youtube_id: '140Zo0s1o7s', descripcion: '' },
  { titulo: 'Herramientas Adicionales', youtube_id: '_wWGANPTKLU', descripcion: '' },
];

function buildIntroLessons(planillaId) {
  return INTRO_LESSONS_TEMPLATE.map((l, idx) => ({
    id: `${planillaId}-intro-${idx}`,
    titulo: l.titulo,
    tipo: 'video',
    youtube_id: l.youtube_id,
    descripcion: l.descripcion,
    orden: idx,
  }));
}

// Backup
const { data: backup, error: backupErr } = await sb.from('course_data').select('*');
if (backupErr) { console.error('Backup fallo:', backupErr.message); process.exit(1); }
const stamp = '2026-06-08-intro';
const backupPath = new URL(`./course-data-backup-${stamp}.json`, import.meta.url);
writeFileSync(backupPath, JSON.stringify(backup, null, 2));
console.log(`✔ Backup: ${backupPath.pathname.slice(1)} (${(backup || []).length} rows)\n`);

// Alumnos con planilla
const { data: alumnos, error: alErr } = await sb
  .from('users')
  .select('id, nombre, email, planilla_id')
  .not('planilla_id', 'is', null);
if (alErr) { console.error('Error fetching alumnos:', alErr.message); process.exit(1); }

console.log(`Alumnos con planilla: ${(alumnos || []).length}\n`);

let courseInserted = 0, courseSkipped = 0, accessInserted = 0;
for (const al of alumnos || []) {
  const lessons = buildIntroLessons(al.planilla_id);

  // course_data — upsert con ignoreDuplicates para NO pisar si ya existe.
  // (Si el alumno ya completó la lección y se la volviera a meter, perderíamos
  // su progreso. ignoreDuplicates evita eso.)
  const { data: cdInsert, error: cdErr } = await sb
    .from('course_data')
    .upsert(
      {
        user_id: al.id,
        module_id: 'mod-intro',
        semana_numero: -1,
        titulo: 'Cómo usar la app',
        descripcion: '',
        lessons,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,module_id', ignoreDuplicates: true }
    )
    .select('user_id');
  if (cdErr) {
    console.error(`  ✗ course_data ${al.email}: ${cdErr.message}`);
    continue;
  }
  if (cdInsert && cdInsert.length > 0) courseInserted++;
  else courseSkipped++;

  // user_access — siempre is_unlocked=true para este módulo. Usamos upsert
  // sin ignoreDuplicates para asegurar el flag activado (sobreescribe si
  // estaba bloqueado por error).
  const { error: uaErr } = await sb
    .from('user_access')
    .upsert(
      { user_id: al.id, module_id: 'mod-intro', is_unlocked: true },
      { onConflict: 'user_id,module_id' }
    );
  if (uaErr) {
    console.error(`  ✗ user_access ${al.email}: ${uaErr.message}`);
    continue;
  }
  accessInserted++;
}

console.log(`\nResultado:`);
console.log(`  course_data: ${courseInserted} insertados · ${courseSkipped} ya existían (saltados)`);
console.log(`  user_access: ${accessInserted} con is_unlocked=true`);

// Verificación
const { count: countCd } = await sb
  .from('course_data')
  .select('user_id', { count: 'exact', head: true })
  .eq('module_id', 'mod-intro');
const { count: countUa } = await sb
  .from('user_access')
  .select('user_id', { count: 'exact', head: true })
  .eq('module_id', 'mod-intro')
  .eq('is_unlocked', true);

console.log(`\nVerificación:`);
console.log(`  ${countCd === (alumnos || []).length ? '✓' : '⚠'} course_data con mod-intro: ${countCd}/${(alumnos || []).length}`);
console.log(`  ${countUa === (alumnos || []).length ? '✓' : '⚠'} user_access desbloqueados: ${countUa}/${(alumnos || []).length}`);

const ok = countCd === (alumnos || []).length && countUa === (alumnos || []).length;
console.log(`\n${ok ? '✅ Todo OK' : '⚠ Revisar arriba'}`);
