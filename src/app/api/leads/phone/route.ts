import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { createNotification } from '@/lib/notifications';
import { notifyCoachWhatsApp } from '@/lib/whatsapp';
import {
  COMPROMISO_LABEL,
  ESTADO_LABEL,
  FORTALEZA_LABEL,
  LIMITACION_LABEL,
  URGENCIA_LABEL,
  VISION_LABEL,
  flagFor,
} from '@/lib/lead-labels';

export const runtime = 'nodejs';

/**
 * POST /api/leads/phone
 *
 * Captura el teléfono + país que el lead ingresa después de agendar en
 * Calendly. Hace UPDATE sobre la fila existente (matched por session_id);
 * si la fila no existe (caso raro), upsert para no perder el dato.
 *
 * Cuando el upsert se completa con éxito, dispara dos notificaciones a los
 * admins del sistema:
 *   - Notificación in-app + push (campanita) para cada admin (rol='admin').
 *   - WhatsApp al coach principal (configurable vía env vars).
 *
 * Las notificaciones son best-effort: si fallan, NO devolvemos error al
 * cliente — el lead ya quedó guardado y eso es lo que importa.
 *
 * Body: { session_id, telefono, pais }
 */
export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const obj = (body as Record<string, unknown>) || {};
  const session_id = obj.session_id;
  const telefono = obj.telefono;
  const pais = obj.pais;

  if (typeof session_id !== 'string' || !session_id.trim()) {
    return NextResponse.json({ error: 'session_id es requerido' }, { status: 400 });
  }
  if (typeof telefono !== 'string' || telefono.replace(/\D/g, '').length < 6) {
    return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 });
  }
  if (typeof pais !== 'string' || !pais.trim()) {
    return NextResponse.json({ error: 'País requerido' }, { status: 400 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const { data: lead, error } = await admin
      .from('lead_quiz_responses')
      .upsert(
        {
          session_id: session_id.trim(),
          telefono: telefono.trim(),
          pais: pais.trim(),
          booked: true,
        },
        { onConflict: 'session_id' },
      )
      .select(
        'id, fortaleza, limitacion, estado, vision, compromiso, urgencia, telefono, pais, disqualified',
      )
      .single();

    if (error) {
      logger.error('leads.phone.upsert.failed', { err: error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Disparar notificaciones. Hacemos await para que Vercel no mate las
    // promesas pendientes al cerrar el handler — el cliente igual ya vio
    // "Reservamos tu sesión" en la pantalla anterior, así que un par de
    // segundos extra acá son tolerables. Cualquier fallo se logea y NO
    // rompe la respuesta.
    try {
      await fanOutLeadNotifications(admin, lead);
    } catch (err) {
      logger.warn('leads.phone.notify.threw', { err });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('leads.phone.unhandled', { err });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------

interface LeadForNotification {
  id: string;
  fortaleza: string | null;
  limitacion: string | null;
  estado: string | null;
  vision: string | null;
  compromiso: string | null;
  urgencia: string | null;
  telefono: string | null;
  pais: string | null;
  disqualified: boolean;
}

async function fanOutLeadNotifications(
  // service-role client, ya creado en el handler
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  lead: LeadForNotification | null,
) {
  if (!lead) return;

  const summary = buildLeadSummary(lead);

  // 1) Notificación in-app + push para cada admin de la app.
  const { data: admins } = await adminClient
    .from('users')
    .select('id')
    .eq('rol', 'admin');

  for (const a of admins || []) {
    try {
      await createNotification(
        a.id,
        'system',
        'Nueva agenda',
        summary.short,
        '/admin/agendas',
      );
    } catch (err) {
      logger.warn('leads.phone.notify.user_failed', { userId: a.id, err });
    }
  }

  // 2) WhatsApp al coach principal (configurable vía env).
  await notifyCoachWhatsApp(summary.long);
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://alumno.jiujitsulatino.com'
  ).replace(/\/$/, '');
}

function buildLeadSummary(lead: LeadForNotification): { short: string; long: string } {
  const flag = flagFor(lead.pais);
  const phoneDisplay = lead.telefono || 'sin teléfono';
  const prettyFortaleza = lead.fortaleza ? FORTALEZA_LABEL[lead.fortaleza] || lead.fortaleza : '—';
  const prettyLimitacion = lead.limitacion
    ? LIMITACION_LABEL[lead.limitacion] || lead.limitacion
    : '—';
  const prettyEstado = lead.estado ? ESTADO_LABEL[lead.estado] || lead.estado : '—';
  const prettyVision = lead.vision ? VISION_LABEL[lead.vision] || lead.vision : '—';
  const prettyCompromiso = lead.compromiso
    ? COMPROMISO_LABEL[lead.compromiso] || lead.compromiso
    : '—';
  const prettyUrgencia = lead.urgencia ? URGENCIA_LABEL[lead.urgencia] || lead.urgencia : '—';

  const short = `${flag} ${phoneDisplay} agendó una sesión.`;

  const long =
    `🥋 *Nueva agenda JJL*\n` +
    `\n` +
    `${flag} ${phoneDisplay}\n` +
    `\n` +
    `*Fortaleza:* ${prettyFortaleza}\n` +
    `*Limitante:* ${prettyLimitacion}\n` +
    `*Estado actual:* ${prettyEstado}\n` +
    `*Visión 6 meses:* ${prettyVision}\n` +
    `*Compromiso:* ${prettyCompromiso}\n` +
    `*Listo para avanzar:* ${prettyUrgencia}\n` +
    (lead.disqualified ? `\n⚠️ Marcado como descalificado en el formulario.\n` : '') +
    `\nVer detalle: ${siteUrl()}/admin/agendas`;

  return { short, long };
}
