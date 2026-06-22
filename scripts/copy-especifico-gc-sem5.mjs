// WRITE (idempotente). Copia el video YXkwsg4Wy3g (de "Específico de
// guardia cerrada" en sem 4) a la misma lección en sem 5, en todos los
// alumnos. NO toca la version de sem 4. Tambien upserta el override
// canonico para que nuevos alumnos lo reciban en lectura.
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const VIDEO_ID = 'YXkwsg4Wy3g';
const TARGET_TITLE = 'Específico de guardia cerrada';
const nk = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
const TARGET_NORM = nk(TARGET_TITLE);

// 1. Backup
const { data: backup } = await sb.from('course_data')
  .select('*').eq('semana_numero', 5);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(new URL(`./copy-especifico-gc-backup-${stamp}.json`, import.meta.url), JSON.stringify(backup, null, 2));
console.log(`Backup: ${backup.length} filas (sem 5) -> scripts/copy-especifico-gc-backup-${stamp}.json\n`);

// 2. Aplicar a course_data
let updated = 0, skipped = 0, notFound = 0;
const moduleIds = new Set();
for (const r of backup || []) {
  const lessons = Array.isArray(r.lessons) ? r.lessons : [];
  const idx = lessons.findIndex((l) => nk(l?.titulo) === TARGET_NORM);
  if (idx === -1) { notFound++; continue; }
  if (lessons[idx].youtube_id === VIDEO_ID) { skipped++; continue; }
  moduleIds.add(r.module_id);
  const next = lessons.map((l, i) => i === idx ? { ...l, youtube_id: VIDEO_ID } : l);
  const { error } = await sb.from('course_data')
    .update({ lessons: next, updated_at: new Date().toISOString() })
    .eq('user_id', r.user_id).eq('module_id', r.module_id);
  if (error) { console.error(`Update ${r.user_id}/${r.module_id}:`, error.message); continue; }
  updated++;
}
console.log(`course_data:`);
console.log(`  ✓ Actualizados: ${updated}`);
console.log(`  → Ya tenían el video (idempotente): ${skipped}`);
console.log(`  → Sin la lección (sem 5 no tiene "${TARGET_TITLE}"): ${notFound}\n`);

// 3. Override canonico (uno por module_id afectado)
for (const mid of moduleIds) {
  const { error } = await sb.from('lesson_video_overrides').upsert({
    module_id: mid,
    lesson_key: TARGET_NORM,
    youtube_id: VIDEO_ID,
    titulo: TARGET_TITLE,
  }, { onConflict: 'module_id,lesson_key' });
  if (error) console.error(`Override ${mid}:`, error.message);
  else console.log(`  ✓ Override upserted: module_id=${mid}`);
}

// 4. Verificación
const { data: verify } = await sb.from('course_data')
  .select('user_id, module_id, lessons').eq('semana_numero', 5);
let withVid = 0, withoutVid = 0;
for (const r of verify || []) {
  for (const l of (r.lessons || [])) {
    if (nk(l?.titulo) !== TARGET_NORM) continue;
    if (l.youtube_id === VIDEO_ID) withVid++;
    else withoutVid++;
  }
}
console.log(`\nVerificación:`);
console.log(`  Lecciones "${TARGET_TITLE}" en sem 5 CON el video correcto: ${withVid}`);
console.log(`  Sin el video o con otro: ${withoutVid}`);
