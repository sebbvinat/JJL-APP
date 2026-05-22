// Importador: lleva los cursos sueltos + clientes + accesos desde
// migration/extracted.json a Supabase.
//
// Uso: node --env-file=.env.local --max-old-space-size=2048 migration/import.mjs
//
// Idempotente: las secciones+lecciones de los cursos target se BORRAN y
// re-insertan. Los cursos en sí NO se tocan a nivel de campos del seed
// (precio_label/sales_copy/payment_url/cover_url están preservados).
// Los clientes se crean si no existen; los accesos se hacen upsert.

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('migration/extracted.json', 'utf8'));

// Mapeo: WP course post ID -> slug en cursos_courses.
// Solo los 7 cursos sueltos. Los 'Personalizado *' (programa de 6 meses) quedan fuera.
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

// ---------- Supabase ----------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ---------- Helpers ----------
const ytIdFromUrl = (url) => {
  if (!url) return null;
  const m =
    url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    url.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    url.match(/embed\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};
const reKey = (k) => new RegExp(`s:\\d+:"${k}";s:\\d+:"([^"]*)"`);
const parseVideo = (val) => {
  if (!val) return { youtube_id: null, duracion: null };
  const yt = (val.match(reKey('source_youtube')) ?? [])[1] ?? '';
  const runtime = (val.match(reKey('runtime')) ?? [])[1] ?? '';
  return { youtube_id: ytIdFromUrl(yt), duracion: runtime || null };
};

const metaByPost = new Map();
for (const m of data.postmeta) {
  if (!metaByPost.has(m.post_id)) metaByPost.set(m.post_id, []);
  metaByPost.get(m.post_id).push(m);
}
const getMeta = (postId, key) => {
  const list = metaByPost.get(postId) ?? [];
  const r = list.find((m) => m.meta_key === key);
  return r ? r.meta_value : null;
};

// ---------- 1. Resolver UUIDs de los cursos target ----------
console.log('Resolviendo cursos en Supabase...');
const { data: cursoRows, error: cErr } = await supabase
  .from('cursos_courses')
  .select('id, slug, duracion_acceso_meses')
  .in('slug', Object.values(SLUG_MAP));
if (cErr) {
  console.error(cErr);
  process.exit(1);
}
const slugToUuid = new Map(cursoRows.map((c) => [c.slug, c.id]));
const courseExpiryMonths = new Map(cursoRows.map((c) => [c.id, c.duracion_acceso_meses]));
const wpToCourseUuid = new Map();
for (const [wpId, slug] of Object.entries(SLUG_MAP)) {
  const uuid = slugToUuid.get(slug);
  if (uuid) wpToCourseUuid.set(Number(wpId), uuid);
  else console.warn(`  ! falta el curso ${slug} en Supabase`);
}
console.log(`  ${wpToCourseUuid.size}/${Object.keys(SLUG_MAP).length} cursos resueltos`);

// ---------- 2. Borrar secciones existentes (cascade lecciones) ----------
console.log('Borrando secciones previas...');
const targetCourseUuids = [...wpToCourseUuid.values()];
const { error: delErr } = await supabase
  .from('cursos_sections')
  .delete()
  .in('course_id', targetCourseUuids);
if (delErr) console.error(delErr);

// ---------- 3. Insertar secciones y lecciones ----------
console.log('Insertando secciones y lecciones...');
let secOk = 0,
  lessOk = 0;
const courseRows = data.posts.filter((p) => p.post_type === 'courses' && TARGET_IDS.has(p.ID));
for (const c of courseRows) {
  const courseUuid = wpToCourseUuid.get(c.ID);
  if (!courseUuid) continue;
  const topics = data.posts
    .filter((p) => p.post_type === 'topics' && p.post_parent === c.ID)
    .sort((a, b) => a.menu_order - b.menu_order);
  for (let ti = 0; ti < topics.length; ti++) {
    const t = topics[ti];
    const { data: secRow, error: secErr } = await supabase
      .from('cursos_sections')
      .insert({
        course_id: courseUuid,
        titulo: t.post_title,
        descripcion: t.post_content || null,
        orden: ti,
      })
      .select('id')
      .single();
    if (secErr) {
      console.error('  ✗ sección', t.post_title, secErr.message);
      continue;
    }
    secOk++;
    const lessons = data.posts
      .filter((p) => p.post_type === 'lesson' && p.post_parent === t.ID)
      .sort((a, b) => a.menu_order - b.menu_order);
    if (lessons.length === 0) continue;
    const rows = lessons.map((l, li) => {
      const { youtube_id, duracion } = parseVideo(getMeta(l.ID, '_video'));
      return {
        section_id: secRow.id,
        course_id: courseUuid,
        tipo: youtube_id ? 'video' : 'texto',
        titulo: l.post_title,
        youtube_id,
        contenido: l.post_content || null,
        duracion,
        orden: li,
      };
    });
    const { error: lErr } = await supabase.from('cursos_lessons').insert(rows);
    if (lErr) {
      console.error(`  ✗ lecciones en "${t.post_title}":`, lErr.message);
    } else {
      lessOk += rows.length;
    }
  }
  console.log(`  ✓ "${c.post_title}": ${topics.length} secciones`);
}
console.log(`  total: ${secOk} secciones, ${lessOk} lecciones`);

// ---------- 4. Clientes + accesos ----------
console.log('\nImportando clientes y accesos...');
const enrollments = data.posts.filter(
  (p) => p.post_type === 'tutor_enrolled' && TARGET_IDS.has(p.post_parent)
);
const wpUserIds = new Set(enrollments.map((e) => e.post_author));
const wpUsers = new Map(data.users.map((u) => [u.ID, u]));
const newUsers = [...wpUserIds].map((id) => wpUsers.get(id)).filter(Boolean);
console.log(`  ${enrollments.length} enrollments → ${newUsers.length} usuarios únicos`);

// Pre-cargar todo auth.users en un mapa email -> id (paginado).
console.log('  cargando auth.users existentes...');
const emailToAuthId = new Map();
let page = 1;
const perPage = 1000;
while (true) {
  const { data: pg, error } = await supabase.auth.admin.listUsers({ page, perPage });
  if (error || !pg) break;
  for (const u of pg.users) {
    if (u.email) emailToAuthId.set(u.email.toLowerCase(), u.id);
  }
  if (!pg.users || pg.users.length < perPage) break;
  page++;
}
console.log(`    ${emailToAuthId.size} auth users en total`);

const wpToSupabaseUser = new Map();
let created = 0,
  existed = 0,
  skipped = 0;
for (const u of newUsers) {
  const email = (u.user_email ?? '').trim().toLowerCase();
  if (!email) {
    skipped++;
    continue;
  }
  let authId = emailToAuthId.get(email);
  if (!authId) {
    const { data: cu, error: cuErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nombre: u.display_name || '' },
    });
    if (cuErr || !cu?.user) {
      console.error(`  ✗ no se pudo crear ${email}: ${cuErr?.message}`);
      skipped++;
      continue;
    }
    authId = cu.user.id;
    emailToAuthId.set(email, authId);
    created++;
  } else {
    existed++;
  }
  // Asegurar public.users (upsert por id) sin pisar admin/alumno existentes.
  const { data: profile } = await supabase
    .from('users')
    .select('id, rol')
    .eq('id', authId)
    .maybeSingle();
  if (!profile) {
    await supabase.from('users').insert({
      id: authId,
      email,
      nombre: u.display_name || email.split('@')[0],
      rol: 'cliente_cursos',
    });
    wpToSupabaseUser.set(u.ID, { id: authId, rol: 'cliente_cursos' });
  } else {
    // Si era 'alumno' o 'admin' lo dejamos. Si no tenía rol válido (o era cliente_cursos), reafirmamos.
    const keepRol = profile.rol === 'admin' || profile.rol === 'alumno';
    if (!keepRol) {
      await supabase
        .from('users')
        .update({ rol: 'cliente_cursos', nombre: u.display_name || email.split('@')[0] })
        .eq('id', authId);
    }
    wpToSupabaseUser.set(u.ID, { id: authId, rol: profile.rol ?? 'cliente_cursos' });
  }
}
console.log(`  usuarios: ${created} creados, ${existed} ya existían en auth, ${skipped} omitidos`);

// ---------- 5. Accesos (deduplicados por user_id+course_id, manteniendo el más reciente) ----------
console.log('Otorgando accesos...');
const grantMap = new Map();
for (const e of enrollments) {
  const userInfo = wpToSupabaseUser.get(e.post_author);
  const courseUuid = wpToCourseUuid.get(e.post_parent);
  if (!userInfo || !courseUuid) continue;
  const key = `${userInfo.id}|${courseUuid}`;
  const grantedAt = new Date(e.post_date);
  const prev = grantMap.get(key);
  if (prev && new Date(prev.granted_at) >= grantedAt) continue;
  const months = courseExpiryMonths.get(courseUuid);
  let expiresAt = null;
  if (months) {
    const d = new Date(grantedAt);
    d.setMonth(d.getMonth() + months);
    expiresAt = d.toISOString();
  }
  grantMap.set(key, {
    user_id: userInfo.id,
    course_id: courseUuid,
    granted_at: grantedAt.toISOString(),
    expires_at: expiresAt,
    revoked: false,
    notas: `migrado de WordPress (post #${e.ID})`,
  });
}
const grants = [...grantMap.values()];

const batchSize = 200;
let grantsOk = 0;
for (let i = 0; i < grants.length; i += batchSize) {
  const batch = grants.slice(i, i + batchSize);
  const { error } = await supabase
    .from('cursos_access')
    .upsert(batch, { onConflict: 'user_id,course_id' });
  if (error) console.error('  ✗', error.message);
  else grantsOk += batch.length;
}
console.log(`  accesos otorgados: ${grantsOk}/${grants.length}`);

console.log('\n✓ Migración completa.');
