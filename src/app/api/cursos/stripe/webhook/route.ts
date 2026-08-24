import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// Webhook de Stripe para fulfillment automático de JJL Cursos.
//
// Flujo: el cliente paga por un Payment Link (buy.stripe.com) → Stripe
// manda checkout.session.completed → acá: creamos (o encontramos) la
// cuenta, otorgamos el acceso al curso/pack y mandamos el mail de
// bienvenida por Resend. Si algo no se puede resolver (producto
// desconocido, mail faltante), avisamos por mail al dueño para dar el
// acceso a mano — ninguna venta queda muda.
//
// El producto se identifica SIN configuración extra: la session trae el
// payment_link (plink_...), le pedimos a Stripe su URL pública
// (buy.stripe.com/...) y la matcheamos contra payment_url en
// cursos_bundles / cursos_courses — la DB es la única fuente de verdad.
//
// Env requeridas (Vercel):
//   STRIPE_SECRET_KEY      — para resolver el payment link
//   STRIPE_WEBHOOK_SECRET  — firma del endpoint (whsec_...)
//   RESEND_API_KEY_CURSOS  — mails de bienvenida/alerta

const CURSOS_HOST = 'https://jiujitsulatino.com';
const FROM = 'Jiu Jitsu Latino <cursos@jiujitsulatino.com>';
const REPLY_TO = 'cursos@jiujitsulatino.com';
const ALERT_EMAIL = process.env.CURSOS_ALERT_EMAIL || 'sebastianvinat@gmail.com';
const INSTAGRAM = 'jjl.oficial';

// ---------- firma ----------

function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSec = 300
): boolean {
  if (!header) return false;
  let t: string | null = null;
  const v1s: string[] = [];
  for (const item of header.split(',')) {
    const idx = item.indexOf('=');
    if (idx < 0) continue;
    const k = item.slice(0, idx).trim();
    const v = item.slice(idx + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1s.push(v);
  }
  if (!t || v1s.length === 0) return false;
  const ts = parseInt(t, 10);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${t}.${payload}`, 'utf8')
    .digest('hex');
  return v1s.some((sig) => {
    try {
      return (
        sig.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      );
    } catch {
      return false;
    }
  });
}

// ---------- helpers ----------

interface StripeSession {
  id: string;
  payment_link: string | null;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  customer_details: { email: string | null; name: string | null } | null;
}

async function getPaymentLinkUrl(plinkId: string): Promise<string | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.stripe.com/v1/payment_links/${plinkId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}

async function sendMail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY_CURSOS;
  if (!key) {
    logger.error('stripe.webhook.no_resend_key');
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html }),
  });
  if (!res.ok) {
    logger.error('stripe.webhook.mail_failed', {
      to,
      status: res.status,
      body: await res.text().catch(() => ''),
    });
  }
  return res.ok;
}

async function alertOwner(motivo: string, session: StripeSession) {
  const monto =
    session.amount_total != null
      ? `${(session.amount_total / 100).toFixed(2)} ${(session.currency || '').toUpperCase()}`
      : 'desconocido';
  await sendMail(
    ALERT_EMAIL,
    '⚠ Venta de Stripe sin acceso automático — dar acceso a mano',
    `<p>Una venta de Stripe no pudo procesarse automáticamente.</p>
     <ul>
       <li><strong>Motivo:</strong> ${motivo}</li>
       <li><strong>Email del comprador:</strong> ${session.customer_details?.email || 'desconocido'}</li>
       <li><strong>Nombre:</strong> ${session.customer_details?.name || '—'}</li>
       <li><strong>Monto:</strong> ${monto}</li>
       <li><strong>Session:</strong> ${session.id}</li>
       <li><strong>Payment link:</strong> ${session.payment_link || '—'}</li>
     </ul>
     <p>Dale el acceso a mano desde el panel o el script de siempre.</p>`
  );
}

function welcomeHtml(opts: {
  nombre: string | null;
  producto: string;
  ctaUrl: string;
  ctaLabel: string;
  esCuentaNueva: boolean;
}) {
  const hi = (opts.nombre || '').trim().split(/\s+/)[0];
  const saludo = hi && hi.length > 1 ? `Hola ${hi}` : 'Hola';
  const cuerpoCuenta = opts.esCuentaNueva
    ? `Te creamos tu cuenta en la plataforma. Apretá el botón, elegí tu contraseña y entrás directo a tu curso.`
    : `Ya lo agregamos a tu cuenta. Entrá con tu email y contraseña de siempre.`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;background:#f5f5f4;margin:0;padding:24px;color:#141414;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
    <div style="background:#000;padding:24px 32px;">
      <div style="color:#fff;font-size:15px;font-weight:800;letter-spacing:-0.01em;line-height:1;">Jiu Jitsu Latino</div>
      <div style="color:#dc2626;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.22em;margin-top:6px;">Compra confirmada</div>
    </div>
    <div style="padding:36px 32px;line-height:1.65;font-size:16px;">
      <h1 style="font-size:22px;font-weight:800;margin:0 0 16px;letter-spacing:-0.02em;line-height:1.3;">${saludo} 🥋</h1>
      <p style="margin:0 0 14px;">Tu compra está confirmada. Ya tenés acceso a:</p>
      <div style="margin:22px 0;padding:18px 20px;background:#fafaf9;border:1px solid #e7e5e4;border-left:4px solid #dc2626;border-radius:10px;">
        <div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.18em;color:#dc2626;">Tu acceso</div>
        <div style="margin-top:6px;font-size:18px;font-weight:800;color:#141414;letter-spacing:-0.01em;">${opts.producto}</div>
      </div>
      <p style="margin:0 0 14px;">${cuerpoCuenta}</p>
      <div style="text-align:center;margin:28px 0 18px;">
        <a href="${opts.ctaUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">${opts.ctaLabel}</a>
      </div>
      <p style="margin:0 0 18px;font-size:13.5px;color:#6b7280;">Después entrás siempre desde <a href="${CURSOS_HOST}" style="color:#dc2626;text-decoration:none;font-weight:600;">jiujitsulatino.com</a> con tu email.</p>
      <div style="margin-top:24px;padding:14px 16px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:10px;font-size:13.5px;color:#374151;">
        Cualquier duda escribinos por Instagram a <a href="https://instagram.com/${INSTAGRAM}" style="color:#dc2626;text-decoration:none;font-weight:600;">@${INSTAGRAM}</a>.
      </div>
    </div>
  </div>
</body></html>`;
}

// ---------- fulfillment ----------

async function fulfill(session: StripeSession): Promise<
  { ok: true } | { ok: false; retry: boolean; motivo: string }
> {
  const email = session.customer_details?.email?.trim().toLowerCase();
  if (!email) return { ok: false, retry: false, motivo: 'La session no trae email del comprador' };
  if (!session.payment_link)
    return { ok: false, retry: false, motivo: 'La session no viene de un Payment Link' };

  const linkUrl = await getPaymentLinkUrl(session.payment_link);
  if (!linkUrl)
    return {
      ok: false,
      retry: false,
      motivo: `No se pudo resolver el payment link ${session.payment_link} (¿falta STRIPE_SECRET_KEY?)`,
    };

  const admin = createAdminSupabaseClient();

  // Producto: bundle primero, curso después
  const { data: bundle } = await admin
    .from('cursos_bundles')
    .select('id, titulo, duracion_acceso_meses')
    .eq('payment_url', linkUrl)
    .maybeSingle<{ id: string; titulo: string; duracion_acceso_meses: number | null }>();

  let productTitle: string;
  let courseIds: string[] = [];
  let sourceBundleId: string | null = null;
  let accesoMeses: number | null;

  if (bundle) {
    productTitle = bundle.titulo;
    sourceBundleId = bundle.id;
    accesoMeses = bundle.duracion_acceso_meses;
    const { data: items } = await admin
      .from('cursos_bundle_items')
      .select('course_id')
      .eq('bundle_id', bundle.id);
    courseIds = ((items ?? []) as { course_id: string }[]).map((i) => i.course_id);
  } else {
    const { data: course } = await admin
      .from('cursos_courses')
      .select('id, titulo, duracion_acceso_meses')
      .eq('payment_url', linkUrl)
      .maybeSingle<{ id: string; titulo: string; duracion_acceso_meses: number | null }>();
    if (!course)
      return {
        ok: false,
        retry: false,
        motivo: `Ningún curso/pack tiene payment_url = ${linkUrl}`,
      };
    productTitle = course.titulo;
    accesoMeses = course.duracion_acceso_meses;
    courseIds = [course.id];
  }
  if (courseIds.length === 0)
    return { ok: false, retry: false, motivo: `El pack ${productTitle} no tiene cursos` };

  // Usuario: buscar por email en auth, crear si no existe
  let userId: string | null = null;
  let esCuentaNueva = false;
  let page = 1;
  while (!userId) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return { ok: false, retry: true, motivo: `listUsers: ${error.message}` };
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) {
      userId = hit.id;
      break;
    }
    if (data.users.length < 1000) break;
    page++;
  }

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomBytes(16).toString('hex'),
    });
    if (error || !created?.user)
      return { ok: false, retry: true, motivo: `createUser: ${error?.message}` };
    userId = created.user.id;
    esCuentaNueva = true;
    // el trigger handle_new_user crea la fila en public.users
    await new Promise((r) => setTimeout(r, 500));
    const updates: Record<string, unknown> = { rol: 'cliente_cursos' };
    const nombre = session.customer_details?.name?.trim();
    if (nombre) updates.nombre = nombre;
    await admin.from('users').update(updates).eq('id', userId);
  }

  // Idempotencia: si esta session ya fue procesada, no repetir (ni re-mandar mail)
  const { data: existing } = await admin
    .from('cursos_access')
    .select('course_id, notas')
    .eq('user_id', userId)
    .in('course_id', courseIds);
  const rows = (existing ?? []) as { course_id: string; notas: string | null }[];
  const yaProcesada =
    rows.length === courseIds.length && rows.some((r) => r.notas?.includes(session.id));
  if (yaProcesada) {
    logger.info('stripe.webhook.duplicate', { session: session.id, email });
    return { ok: true };
  }

  // Grants
  const expires = new Date();
  expires.setMonth(expires.getMonth() + (accesoMeses ?? 24));
  const grantRows = courseIds.map((courseId) => ({
    user_id: userId,
    course_id: courseId,
    source_bundle_id: sourceBundleId,
    expires_at: expires.toISOString(),
    revoked: false,
    notas: `stripe ${session.id}`,
  }));
  const { error: grantErr } = await admin
    .from('cursos_access')
    .upsert(grantRows, { onConflict: 'user_id,course_id' });
  if (grantErr) return { ok: false, retry: true, motivo: `grants: ${grantErr.message}` };

  // Mail de bienvenida
  let ctaUrl = `${CURSOS_HOST}/mis-cursos`;
  let ctaLabel = 'Ver mis cursos';
  if (esCuentaNueva) {
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${CURSOS_HOST}/auth/set-password` },
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (tokenHash) {
      ctaUrl = `${CURSOS_HOST}/auth/confirm?token_hash=${tokenHash}&type=recovery`;
      ctaLabel = 'Crear mi contraseña y entrar';
    }
  }
  await sendMail(
    email,
    `Tu acceso a ${productTitle} ya está listo 🥋`,
    welcomeHtml({
      nombre: session.customer_details?.name ?? null,
      producto: productTitle,
      ctaUrl,
      ctaLabel,
      esCuentaNueva,
    })
  );

  logger.info('stripe.webhook.fulfilled', {
    session: session.id,
    email,
    producto: productTitle,
    cuentaNueva: esCuentaNueva,
    cursos: courseIds.length,
  });
  return { ok: true };
}

// ---------- handler ----------

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('stripe.webhook.no_secret');
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 });
  }

  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!verifyStripeSignature(payload, signature, secret)) {
    logger.warn('stripe.webhook.bad_signature');
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }

  let event: { type: string; data: { object: StripeSession } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const relevante =
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded';
  if (!relevante) return NextResponse.json({ received: true });

  const session = event.data.object;
  // completed puede llegar con pago pendiente (boleto/transferencia):
  // en ese caso esperamos el async_payment_succeeded.
  if (session.payment_status !== 'paid') return NextResponse.json({ received: true });

  const result = await fulfill(session);
  if (!result.ok) {
    logger.error('stripe.webhook.fulfill_failed', {
      session: session.id,
      motivo: result.motivo,
      retry: result.retry,
    });
    await alertOwner(result.motivo, session);
    if (result.retry) {
      return NextResponse.json({ error: result.motivo }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
