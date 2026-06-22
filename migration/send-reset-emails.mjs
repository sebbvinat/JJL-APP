// Envia mail de "set your password" a los clientes migrados desde
// WordPress. Genera un link de recovery con Supabase y manda un mail
// branded via Resend desde el dominio institucional.
//
// Uso:
//   node --env-file=.env.local migration/send-reset-emails.mjs         # DRY RUN (default)
//   node --env-file=.env.local migration/send-reset-emails.mjs --send  # ENVIA DE VERDAD
//
// Filtros: solo manda a users con rol='cliente_cursos' AND con al menos
// un cursos_access vigente. No spamea ni admins ni alumnos del programa.

import { createClient } from '@supabase/supabase-js';

const SEND = process.argv.includes('--send');
const INCLUDE_EXPIRED = process.argv.includes('--include-expired');
const REDIRECT_TO = 'https://jiujitsulatino.com/auth/set-password';
const FROM_NAME = 'Jiu Jitsu Latino';
const FROM_EMAIL = process.env.JJL_FROM_EMAIL || 'cursos@jiujitsulatino.com';
const REPLY_TO = process.env.JJL_REPLY_TO || FROM_EMAIL;
const SUBJECT = 'Tu acceso a Jiu Jitsu Latino — plataforma nueva';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function firstName(nombre) {
  if (!nombre) return null;
  const f = nombre.trim().split(/\s+/)[0];
  return f && f.length > 1 ? f : null;
}

function joinSpanish(items) {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return items.slice(0, -1).join(', ') + ' y ' + items[items.length - 1];
}

const INSTAGRAM_HANDLE = 'jjl.oficial';

function emailHtml(nombre, link, courses) {
  const hi = firstName(nombre);
  const saludo = hi ? `Hola ${hi}` : 'Hola';
  const courseList = joinSpanish(courses);
  const bought = courseList ? `<p style="margin:0 0 14px;">Hace un tiempo compraste <strong>${courseList}</strong> en Jiu Jitsu Latino.</p>` : '';
  const igUrl = `https://instagram.com/${INSTAGRAM_HANDLE}`;
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;background:#f5f5f4;margin:0;padding:24px;color:#141414;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
    <div style="background:#000;padding:24px 32px;">
      <div style="color:#fff;font-size:15px;font-weight:800;letter-spacing:-0.01em;line-height:1;">Jiu Jitsu Latino</div>
      <div style="color:#dc2626;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.22em;margin-top:6px;">Cursos</div>
    </div>
    <div style="padding:36px 32px;line-height:1.65;font-size:16px;">
      <h1 style="font-size:22px;font-weight:800;margin:0 0 18px;letter-spacing:-0.02em;line-height:1.3;">${saludo} 🥋</h1>
      ${bought}
      <p style="margin:0 0 14px;">Estrenamos una <strong>plataforma nueva</strong> para que veas tus cursos con mejor experiencia. <strong>Tu acceso sigue intacto</strong> — solo necesitás setear una contraseña nueva (las del sistema viejo no se traen por una cuestión de seguridad).</p>
      <div style="text-align:center;margin:32px 0 24px;">
        <a href="${link}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">Entrar a mi plataforma</a>
      </div>
      <p style="margin:0 0 18px;font-size:13.5px;color:#6b7280;">El link funciona una vez. Después entrás siempre desde <a href="https://jiujitsulatino.com" style="color:#dc2626;text-decoration:none;font-weight:600;">jiujitsulatino.com</a>.</p>
      <div style="margin-top:24px;padding:14px 16px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:10px;font-size:13.5px;color:#374151;">
        Este es un mail oficial de Jiu Jitsu Latino. Si tenés cualquier duda, escribinos por Instagram a <a href="${igUrl}" style="color:#dc2626;text-decoration:none;font-weight:600;">@${INSTAGRAM_HANDLE}</a> y te respondemos.
      </div>
    </div>
  </div>
</body></html>`;
}

function emailText(nombre, link, courses) {
  const hi = firstName(nombre);
  const saludo = hi ? `Hola ${hi}` : 'Hola';
  const bought = courses && courses.length ? `Hace un tiempo compraste ${joinSpanish(courses)} en Jiu Jitsu Latino.\n\n` : '';
  return `${saludo},

${bought}Estrenamos una plataforma nueva para que veas tus cursos con mejor experiencia. Tu acceso sigue intacto — solo necesitas setear una contrasenia nueva (las del sistema viejo no se traen por seguridad).

Entrar a tu plataforma:
${link}

El link funciona una vez. Despues entras siempre desde jiujitsulatino.com.

Este es un mail oficial de Jiu Jitsu Latino. Si tenes cualquier duda, escribinos por Instagram a @${INSTAGRAM_HANDLE} y te respondemos.

Equipo Jiu Jitsu Latino`;
}

async function fetchRecipients() {
  // "Cliente migrado" = tiene un cursos_access con notas que empiezan con
  // "migrado de WordPress". Trae tambien los titulos de los cursos para
  // personalizar el mail ("compraste X").
  const { data: grants, error } = await supabase
    .from('cursos_access')
    .select('user_id, course_id, notas, revoked, expires_at')
    .ilike('notas', 'migrado de WordPress%')
    .eq('revoked', false);
  if (error) throw error;
  const now = Date.now();
  const filtered = (grants || []).filter(
    (g) => INCLUDE_EXPIRED || !g.expires_at || new Date(g.expires_at).getTime() > now
  );
  const userIds = new Set(filtered.map((g) => g.user_id));
  if (userIds.size === 0) return [];
  const courseIds = new Set(filtered.map((g) => g.course_id));
  const [{ data: users }, { data: courses }] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, nombre, rol')
      .in('id', [...userIds])
      .neq('rol', 'admin'),
    supabase.from('cursos_courses').select('id, titulo').in('id', [...courseIds]),
  ]);
  const titleById = new Map((courses || []).map((c) => [c.id, c.titulo]));
  const userCourses = new Map();
  for (const g of filtered) {
    if (!userCourses.has(g.user_id)) userCourses.set(g.user_id, new Set());
    const t = titleById.get(g.course_id);
    if (t) userCourses.get(g.user_id).add(t);
  }
  return (users || [])
    .filter((u) => u.email)
    .map((u) => ({ ...u, courses: [...(userCourses.get(u.id) || [])].sort() }));
}

async function countAll() {
  // Conteo: vigentes vs vencidos migrados (solo no-admin).
  const { data: grants } = await supabase
    .from('cursos_access')
    .select('user_id, expires_at')
    .ilike('notas', 'migrado de WordPress%')
    .eq('revoked', false);
  const now = Date.now();
  const vigentes = new Set();
  const vencidos = new Set();
  for (const g of grants || []) {
    if (!g.expires_at || new Date(g.expires_at).getTime() > now) vigentes.add(g.user_id);
    else vencidos.add(g.user_id);
  }
  // Quitar los que tambien tienen vigente del set de vencidos
  for (const id of vigentes) vencidos.delete(id);
  return { vigentes: vigentes.size, vencidos: vencidos.size };
}

async function generateRecoveryLink(email) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: REDIRECT_TO },
  });
  if (error) return { error };
  const link = data?.properties?.action_link;
  return link ? { link } : { error: new Error('sin action_link') };
}

async function sendViaResend(to, html, text) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY_CURSOS}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      reply_to: REPLY_TO,
      subject: SUBJECT,
      html,
      text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}

console.log('Resolviendo destinatarios...');
const stats = await countAll();
console.log(`  Clientes migrados con acceso vigente: ${stats.vigentes}`);
console.log(`  Clientes migrados con acceso vencido: ${stats.vencidos}`);
const recipients = await fetchRecipients();
console.log(
  `  → A mandar: ${recipients.length}${INCLUDE_EXPIRED ? ' (incluye vencidos)' : ' (solo vigentes, sin admins)'}`
);

if (!SEND) {
  const sample = recipients[0];
  console.log('\n*** DRY RUN — no se envia nada ***');
  console.log(`\nRemitente: ${FROM_NAME} <${FROM_EMAIL}>`);
  console.log(`Reply-to:  ${REPLY_TO}`);
  console.log(`Subject:   ${SUBJECT}`);
  console.log(`Redirect:  ${REDIRECT_TO}`);
  console.log('\n--- Cuerpo (plain text, ejemplo para el primero) ---');
  console.log(emailText(sample?.nombre, '[LINK GENERADO DINAMICAMENTE]', sample?.courses));
  console.log('\n--- Primeros destinatarios ---');
  recipients.slice(0, 10).forEach((r) => console.log(`  - ${r.email} (${r.nombre || 'sin nombre'})`));
  if (recipients.length > 10) console.log(`  ... y ${recipients.length - 10} mas`);
  console.log('\nCorre con --send para enviar de verdad.');
  process.exit(0);
}

if (!process.env.RESEND_API_KEY_CURSOS) {
  console.error('Falta RESEND_API_KEY en .env.local');
  process.exit(1);
}

console.log('\nEnviando...');
let sent = 0;
let failed = 0;
for (const r of recipients) {
  const { link, error: lkErr } = await generateRecoveryLink(r.email);
  if (!link) {
    console.log(`  ✗ ${r.email} — link: ${lkErr?.message || 'fallo'}`);
    failed++;
    continue;
  }
  try {
    await sendViaResend(r.email, emailHtml(r.nombre, link, r.courses), emailText(r.nombre, link, r.courses));
    console.log(`  ✓ ${r.email}`);
    sent++;
    await new Promise((rs) => setTimeout(rs, 250)); // rate limit suave
  } catch (e) {
    console.log(`  ✗ ${r.email} — send: ${e.message}`);
    failed++;
  }
}
console.log(`\n${sent} enviados, ${failed} fallaron de ${recipients.length}.`);
