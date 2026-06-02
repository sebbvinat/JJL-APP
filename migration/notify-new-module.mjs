// Notifica por mail a los clientes con acceso a un curso que se sumó
// un módulo nuevo. Uso:
//   node --env-file=.env.local migration/notify-new-module.mjs --send
// Sin --send es dry-run.

import { createClient } from '@supabase/supabase-js';

const SEND = process.argv.includes('--send');
const COURSE_SLUG = 'fundamento-adn-guardia';
const NEW_MODULE = 'Distancia Media';
const COURSE_LABEL = 'Fundamento ADN: Guardia';
const INSTAGRAM_HANDLE = 'jjl.oficial';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: course } = await supabase
  .from('cursos_courses')
  .select('id')
  .eq('slug', COURSE_SLUG)
  .single();
if (!course) {
  console.error('Curso no encontrado:', COURSE_SLUG);
  process.exit(1);
}

const { data: grants } = await supabase
  .from('cursos_access')
  .select('user_id, expires_at')
  .eq('course_id', course.id)
  .eq('revoked', false);

const now = Date.now();
const vigentes = (grants || []).filter(
  (g) => !g.expires_at || new Date(g.expires_at).getTime() > now
);
const userIds = [...new Set(vigentes.map((g) => g.user_id))];

const { data: users } = await supabase
  .from('users')
  .select('id, email, nombre, rol')
  .in('id', userIds);

const recipients = (users || [])
  .filter((u) => u.email && u.rol !== 'admin')
  .map((u) => ({ email: u.email, nombre: u.nombre || '' }));

console.log(`Destinatarios: ${recipients.length}`);
recipients.forEach((r) => console.log(`  - ${r.email}`));

function firstName(nombre) {
  const f = (nombre || '').trim().split(/\s+/)[0];
  return f && f.length > 1 ? f : null;
}

function emailHtml(nombre) {
  const hi = firstName(nombre);
  const saludo = hi ? `Hola ${hi}` : 'Hola';
  const courseUrl = `https://jiujitsulatino.com/ver/${COURSE_SLUG}`;
  const igUrl = `https://instagram.com/${INSTAGRAM_HANDLE}`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;background:#f5f5f4;margin:0;padding:24px;color:#141414;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
    <div style="background:#000;padding:24px 32px;">
      <div style="color:#fff;font-size:15px;font-weight:800;letter-spacing:-0.01em;line-height:1;">Jiu Jitsu Latino</div>
      <div style="color:#dc2626;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.22em;margin-top:6px;">Nuevo módulo</div>
    </div>
    <div style="padding:36px 32px;line-height:1.65;font-size:16px;">
      <h1 style="font-size:22px;font-weight:800;margin:0 0 18px;letter-spacing:-0.02em;line-height:1.3;">${saludo} 🥋</h1>
      <p style="margin:0 0 14px;">Buenas noticias: sumamos un <strong>módulo nuevo</strong> al instruccional <strong>${COURSE_LABEL}</strong>.</p>
      <div style="margin:24px 0;padding:18px 20px;background:#fafaf9;border:1px solid #e7e5e4;border-left:4px solid #dc2626;border-radius:10px;">
        <div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.18em;color:#dc2626;">Módulo nuevo</div>
        <div style="margin-top:6px;font-size:18px;font-weight:800;color:#141414;letter-spacing:-0.01em;">${NEW_MODULE}</div>
      </div>
      <p style="margin:0 0 14px;">Ya está disponible en tu plataforma — entrá y vas a verlo al final del curso.</p>
      <div style="text-align:center;margin:30px 0 18px;">
        <a href="${courseUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">Ver el módulo</a>
      </div>
      <p style="margin:0 0 18px;font-size:13.5px;color:#6b7280;">También podés entrar desde <a href="https://jiujitsulatino.com" style="color:#dc2626;text-decoration:none;font-weight:600;">jiujitsulatino.com</a>.</p>
      <div style="margin-top:24px;padding:14px 16px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:10px;font-size:13.5px;color:#374151;">
        Cualquier duda escribinos por Instagram a <a href="${igUrl}" style="color:#dc2626;text-decoration:none;font-weight:600;">@${INSTAGRAM_HANDLE}</a>.
      </div>
    </div>
  </div>
</body></html>`;
}

function emailText(nombre) {
  const hi = firstName(nombre);
  const saludo = hi ? `Hola ${hi}` : 'Hola';
  return `${saludo},

Sumamos un modulo nuevo al instruccional ${COURSE_LABEL}: ${NEW_MODULE}.

Ya esta disponible en tu plataforma — entrá y vas a verlo al final del curso:
https://jiujitsulatino.com/ver/${COURSE_SLUG}

Cualquier duda escribinos por Instagram a @${INSTAGRAM_HANDLE}.

Equipo Jiu Jitsu Latino`;
}

if (!SEND) {
  console.log('\n*** DRY RUN — no se envia nada ***');
  if (recipients[0]) {
    console.log('\n--- Sample (primer destinatario) ---');
    console.log(emailText(recipients[0].nombre));
  }
  console.log('\nCorre con --send para enviar.');
  process.exit(0);
}

const RESEND_KEY = process.env.RESEND_API_KEY_CURSOS;
if (!RESEND_KEY) {
  console.error('Falta RESEND_API_KEY_CURSOS');
  process.exit(1);
}

let ok = 0,
  fail = 0;
for (const r of recipients) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Jiu Jitsu Latino <cursos@jiujitsulatino.com>',
        to: [r.email],
        reply_to: 'cursos@jiujitsulatino.com',
        subject: `Nuevo módulo en ${COURSE_LABEL}: ${NEW_MODULE}`,
        html: emailHtml(r.nombre),
        text: emailText(r.nombre),
      }),
    });
    if (res.ok) {
      console.log(`  ✓ ${r.email}`);
      ok++;
    } else {
      console.log(`  ✗ ${r.email} (${res.status})`);
      fail++;
    }
  } catch (e) {
    console.log(`  ✗ ${r.email} (${e.message})`);
    fail++;
  }
  // pequeño throttle por las dudas
  await new Promise((res) => setTimeout(res, 400));
}
console.log(`\n${ok} enviados, ${fail} fallaron de ${recipients.length}.`);
