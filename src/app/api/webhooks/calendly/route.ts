import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * POST /api/webhooks/calendly
 *
 * Endpoint público al que Calendly POSTea cuando un invitee crea o cancela
 * una reserva. Lo usamos para enriquecer la fila de `lead_quiz_responses`
 * con: nombre, email y fecha/hora del agendamiento.
 *
 * SETUP:
 *   1. En Calendly → Integrations → Webhooks → Create Webhook
 *      - URL:    https://alumno.jiujitsulatino.com/api/webhooks/calendly
 *      - Events: invitee.created (mínimo) — opcional invitee.canceled
 *      - Scope:  user
 *   2. Copiar el "Signing Key" que te muestra Calendly y configurarlo en
 *      Vercel como CALENDLY_WEBHOOK_SIGNING_KEY.
 *      Si la env var no está, el webhook acepta cualquier request (modo dev),
 *      logueando un warn.
 *   3. La URL de Calendly que rendereamos en el quiz incluye un parámetro
 *      utm_content=<session_id>; cuando llega el webhook, ese mismo valor
 *      aparece en payload.tracking.utm_content y nos sirve para encontrar
 *      la fila correcta del lead.
 */
export async function POST(request: NextRequest) {
  // Leer el body crudo para poder verificar la firma sin que JSON.parse
  // altere el contenido (espacios / orden de keys).
  const rawBody = await request.text();

  if (!verifyCalendlySignature(request, rawBody)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const event = (parsed as { event?: string })?.event;
  const payload = (parsed as { payload?: Record<string, unknown> })?.payload;

  if (!payload || (event !== 'invitee.created' && event !== 'invitee.canceled')) {
    // Ignoramos otros eventos (ej. routing form submissions) sin error.
    return NextResponse.json({ ignored: true });
  }

  // Buscar el session_id que pusimos en el utm_content del link.
  const tracking = (payload.tracking as Record<string, unknown>) || {};
  const sessionId =
    typeof tracking.utm_content === 'string' && tracking.utm_content.trim()
      ? tracking.utm_content.trim()
      : null;

  if (!sessionId) {
    logger.warn('calendly.webhook.missing_session_id', { event });
    return NextResponse.json({ ignored: true });
  }

  // Si es un evento cancelado, marcamos la reserva como no confirmada y
  // limpiamos la fecha — no borramos las respuestas.
  if (event === 'invitee.canceled') {
    try {
      const admin = createAdminSupabaseClient();
      await admin
        .from('lead_quiz_responses')
        .update({ booked: false, scheduled_at: null, calendly_event_uri: null })
        .eq('session_id', sessionId);
      return NextResponse.json({ success: true, action: 'canceled' });
    } catch (err) {
      logger.error('calendly.webhook.cancel.failed', { err });
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
  }

  // invitee.created → guardamos nombre, email y fecha del agendamiento.
  const name = typeof payload.name === 'string' ? payload.name.trim() : null;
  const email = typeof payload.email === 'string' ? payload.email.trim() : null;
  const scheduledEvent =
    (payload.scheduled_event as Record<string, unknown>) || {};
  const startTime =
    typeof scheduledEvent.start_time === 'string'
      ? scheduledEvent.start_time
      : null;
  const eventUri =
    typeof scheduledEvent.uri === 'string' ? scheduledEvent.uri : null;

  try {
    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from('lead_quiz_responses')
      .upsert(
        {
          session_id: sessionId,
          nombre: name,
          email,
          scheduled_at: startTime,
          calendly_event_uri: eventUri,
          booked: true,
        },
        { onConflict: 'session_id' },
      );
    if (error) {
      logger.error('calendly.webhook.upsert.failed', { err: error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('calendly.webhook.unhandled', { err });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * Verifica la firma `Calendly-Webhook-Signature` siguiendo el formato
 * documentado por Calendly: `t=<timestamp>,v1=<hex_hmac>`.
 * Si no hay signing key configurado, devolvemos true y logueamos un warn —
 * útil para desarrollo, riesgoso para producción.
 */
function verifyCalendlySignature(request: NextRequest, rawBody: string): boolean {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    logger.warn('calendly.webhook.no_signing_key');
    return true;
  }

  const header = request.headers.get('Calendly-Webhook-Signature');
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const idx = kv.indexOf('=');
      return idx === -1
        ? [kv.trim(), '']
        : [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
    }),
  );
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;

  // Toleramos hasta 5 minutos de skew para evitar falsos negativos por
  // diferencia de reloj entre Calendly y Vercel.
  const skewSeconds = Math.abs(Date.now() / 1000 - Number(t));
  if (Number.isNaN(skewSeconds) || skewSeconds > 300) return false;

  const expected = crypto
    .createHmac('sha256', signingKey)
    .update(`${t}.${rawBody}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}
