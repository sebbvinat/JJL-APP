import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// Recovery propio de cursos. NO usa el resetPasswordForEmail del SDK
// (eso dispara el template default de Supabase, que es compartido con
// alumno). En su lugar generamos el token_hash con admin.generateLink y
// mandamos nuestro propio mail brandeado de cursos via Resend.
//
// El link del mail apunta a /auth/confirm — pagina nuestra que llama
// verifyOtp solo cuando el cliente clickea, no cuando un prefetcher de
// Outlook/Gmail/iOS Mail pasa por el link.
//
// Para evitar leak de cuales emails estan registrados, siempre devolvemos
// ok=true salvo errores tecnicos. Si el email no existe, lo logueamos
// pero el cliente ve el mismo mensaje "te mandamos un mail".

const CURSOS_HOST = 'https://jiujitsulatino.com';
const FROM = 'Jiu Jitsu Latino <cursos@jiujitsulatino.com>';
const REPLY_TO = 'cursos@jiujitsulatino.com';

export async function POST(request: NextRequest) {
  let email: string;
  try {
    const body = await request.json();
    email = String(body?.email || '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Email inválido.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${CURSOS_HOST}/auth/set-password` },
  });

  if (error || !data?.properties?.hashed_token) {
    // Email no existe o falla de generacion — no leakear al cliente.
    logger.warn('cursos.reset.generate_failed', {
      email,
      err: error?.message || 'no_hashed_token',
    });
    return NextResponse.json({ ok: true });
  }

  const tokenHash = data.properties.hashed_token;
  const confirmUrl = `${CURSOS_HOST}/auth/confirm?token_hash=${tokenHash}&type=recovery`;

  const resendKey = process.env.RESEND_API_KEY_CURSOS;
  if (!resendKey) {
    logger.error('cursos.reset.no_resend_key');
    return NextResponse.json(
      { ok: false, error: 'Servicio de mail no configurado.' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        reply_to: REPLY_TO,
        subject: 'Reseteá tu contraseña — Jiu Jitsu Latino',
        html: buildHtml(confirmUrl),
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      logger.error('cursos.reset.resend_failed', { status: res.status, body: txt });
      return NextResponse.json(
        { ok: false, error: 'No pudimos enviar el mail.' },
        { status: 502 }
      );
    }
  } catch (err) {
    logger.error('cursos.reset.resend_threw', { err });
    return NextResponse.json(
      { ok: false, error: 'No pudimos enviar el mail.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}

function buildHtml(url: string) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;color:#141414;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
    <div style="background:#000;padding:24px 32px;">
      <div style="color:#fff;font-size:15px;font-weight:800;letter-spacing:-0.01em;line-height:1;">Jiu Jitsu Latino</div>
      <div style="color:#dc2626;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.22em;margin-top:6px;">Recuperar contraseña</div>
    </div>
    <div style="padding:36px 32px;line-height:1.65;font-size:16px;">
      <h1 style="font-size:22px;font-weight:800;margin:0 0 16px;letter-spacing:-0.02em;line-height:1.3;">Reseteá tu contraseña 🥋</h1>
      <p style="margin:0 0 14px;">Pediste un link para volver a entrar a tus cursos. Apretá el botón y elegí una contraseña nueva.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${url}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">Elegir contraseña nueva</a>
      </div>
      <p style="margin:0 0 14px;font-size:13.5px;color:#6b7280;">Si el botón no abre, copiá y pegá este link:<br><span style="word-break:break-all;color:#374151;">${url}</span></p>
      <div style="margin-top:24px;padding:14px 16px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:10px;font-size:13.5px;color:#374151;">
        Este link sirve por una hora y se puede usar una sola vez. Si no fuiste vos, ignoralo — no pasa nada.
      </div>
    </div>
  </div>
</body></html>`;
}
