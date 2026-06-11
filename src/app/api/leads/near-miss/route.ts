import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { notifyCoachWhatsApp } from '@/lib/whatsapp';
import { FORTALEZA_LABEL, flagFor } from '@/lib/lead-labels';

export const runtime = 'nodejs';

/**
 * POST /api/leads/near-miss
 *
 * El lead seleccionó día/hora en Calendly pero cerró antes de confirmar
 * (postMessage `calendly.date_and_time_selected` sí, `event_scheduled` no).
 * Se llama desde el browser con `navigator.sendBeacon` justo antes de que
 * la pestaña muera — por eso aceptamos también text/plain (sendBeacon no
 * deja setear Content-Type=application/json).
 *
 * Persistimos `near_miss_at` (una vez) y disparamos WhatsApp al setter
 * con todo el contexto + un link `wa.me/<telefono>?text=<mensaje-soft>`
 * pre-armado para reenviar al lead en un toque.
 *
 * Si todavía no tenemos teléfono ni IG, igual avisamos al setter con
 * lo que tengamos para que decida qué hacer.
 *
 * Body: { session_id }
 */
export async function POST(request: NextRequest) {
  let body: { session_id?: unknown } | null = null;
  try {
    // sendBeacon manda como text/plain por default; parseamos a mano.
    const raw = await request.text();
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : '';
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id requerido' }, { status: 400 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const { data: lead, error } = await admin
      .from('lead_quiz_responses')
      .select(
        'id, session_id, instagram, fortaleza, telefono, pais, nombre, email, scheduled_at, booked, near_miss_at',
      )
      .eq('session_id', sessionId)
      .maybeSingle<LeadRow>();

    if (error) {
      logger.error('leads.near-miss.lookup.failed', { err: error });
      return NextResponse.json({ ok: false });
    }
    if (!lead) {
      // El quiz quizás no llegó a postear todavía. No es un error grave.
      return NextResponse.json({ ok: true, lead: false });
    }
    // Idempotencia: si ya agendó O ya marcamos el near-miss, no hacemos nada.
    if (lead.booked || lead.scheduled_at || lead.near_miss_at) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { error: updErr } = await admin
      .from('lead_quiz_responses')
      .update({ near_miss_at: new Date().toISOString() })
      .eq('id', lead.id);
    if (updErr) logger.warn('leads.near-miss.mark.failed', { err: updErr });

    // Best-effort: el WhatsApp falla → loguear pero responder OK.
    try {
      const msg = buildSetterAlert(lead);
      await notifyCoachWhatsApp(msg);
    } catch (err) {
      logger.warn('leads.near-miss.notify.threw', { err });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('leads.near-miss.unhandled', { err });
    return NextResponse.json({ ok: false }, { status: 200 }); // 200 para que el browser no reintente
  }
}

interface LeadRow {
  id: string;
  session_id: string;
  instagram: string | null;
  fortaleza: string | null;
  telefono: string | null;
  pais: string | null;
  nombre: string | null;
  email: string | null;
  scheduled_at: string | null;
  booked: boolean | null;
  near_miss_at: string | null;
}

/**
 * Mensaje al setter (vos / Ignacio). Lleva el contexto + el link directo
 * de WhatsApp del lead con un texto soft ya armado — abrir y enviar.
 *
 * Si no hay teléfono, ofrecemos el link de Instagram (DM) como fallback.
 */
function buildSetterAlert(lead: LeadRow): string {
  const flag = flagFor(lead.pais);
  const persona = lead.nombre?.trim() || (lead.instagram ? `@${lead.instagram.trim()}` : 'lead sin nombre');
  const fortaleza = lead.fortaleza ? FORTALEZA_LABEL[lead.fortaleza] || lead.fortaleza : '—';

  const softMessage = buildSoftMessage(lead);
  const waLink = buildWaLink(lead.telefono, softMessage);
  const igLink = lead.instagram?.trim()
    ? `https://instagram.com/${encodeURIComponent(lead.instagram.trim())}`
    : null;

  const contactLine = waLink
    ? `📱 *Mensaje listo para enviar:*\n${waLink}\n`
    : igLink
      ? `📸 No dejó teléfono. DM por IG: ${igLink}\n`
      : `⚠️ Sin teléfono ni IG — abrí el admin para ver datos del quiz.\n`;

  return (
    `🔥 *Lead casi-agendó*\n` +
    `\n` +
    `${flag} *${persona}*\n` +
    (lead.email?.trim() ? `📧 ${lead.email.trim()}\n` : '') +
    `*Fortaleza:* ${fortaleza}\n` +
    `\n` +
    contactLine +
    `\n` +
    `Detalle: https://alumno.jiujitsulatino.com/admin/agendas`
  );
}

/**
 * Mensaje soft firmando Ignacio. Abre conversación, no presiona. Si
 * conocemos el nombre lo personalizamos; si no, queda genérico pero humano.
 */
function buildSoftMessage(lead: LeadRow): string {
  const hello = lead.nombre?.trim() ? `Hola ${lead.nombre.trim().split(' ')[0]} 👋` : 'Hola 👋';
  const link = 'https://alumno.jiujitsulatino.com/consultoria-gratuita';
  return (
    `${hello} Soy Ignacio de JJL. Vi que estabas a punto de agendar la consultoría gratuita y te quedaste cerca. ` +
    `Si tenés alguna duda antes de elegir el horario me decís y la respondo. Si no, te dejo el link de nuevo: ${link}`
  );
}

function buildWaLink(telefono: string | null, text: string): string | null {
  if (!telefono) return null;
  const cleaned = telefono.replace(/\D/g, '');
  if (cleaned.length < 6) return null;
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}
