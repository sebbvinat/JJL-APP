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
      .select(LEAD_SELECT)
      .single();

    if (error) {
      logger.error('leads.phone.upsert.failed', { err: error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // El webhook de Calendly suele llegar muy cerca de este POST (a veces
    // antes, a veces después). Si todavía no tenemos la fecha agendada ni
    // el nombre del invitee, esperamos un toque a que aparezcan para mandar
    // un WhatsApp con todo el contexto. Si no aparece, mandamos lo que hay.
    let enriched = lead as LeadForNotification | null;
    if (enriched && (!enriched.scheduled_at || !enriched.nombre)) {
      enriched = await waitForCalendlyEnrichment(admin, session_id.trim(), enriched);
    }

    // Disparar notificaciones. Best-effort: cualquier fallo se logea y NO
    // rompe la respuesta — el lead ya quedó guardado y eso es lo crítico.
    try {
      await fanOutLeadNotifications(admin, enriched);
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
  instagram: string | null;
  ocupacion: string | null;
  fortaleza: string | null;
  limitacion: string | null;
  estado: string | null;
  vision: string | null;
  compromiso: string | null;
  telefono: string | null;
  pais: string | null;
  nombre: string | null;
  email: string | null;
  scheduled_at: string | null;
  disqualified: boolean;
}

const LEAD_SELECT =
  'id, instagram, ocupacion, fortaleza, limitacion, estado, vision, compromiso, telefono, pais, nombre, email, scheduled_at, disqualified';

const ENRICHMENT_TIMEOUT_MS = 3500;
const ENRICHMENT_POLL_MS = 500;

/**
 * Polea la fila del lead durante un breve período hasta que el webhook de
 * Calendly haya escrito `scheduled_at` y `nombre`. Si el webhook nunca
 * llega, devolvemos lo último que vimos.
 */
async function waitForCalendlyEnrichment(
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  sessionId: string,
  initial: LeadForNotification,
): Promise<LeadForNotification> {
  let latest = initial;
  const deadline = Date.now() + ENRICHMENT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (latest.scheduled_at && latest.nombre) return latest;
    await sleep(ENRICHMENT_POLL_MS);
    const { data } = await adminClient
      .from('lead_quiz_responses')
      .select(LEAD_SELECT)
      .eq('session_id', sessionId)
      .single();
    if (data) latest = data as LeadForNotification;
  }
  return latest;
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
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

  const personDisplay = lead.nombre?.trim() || phoneDisplay;
  const scheduledLine = lead.scheduled_at
    ? `📅 *Agenda:* ${new Date(lead.scheduled_at).toLocaleString('es-AR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires',
      })} (hora AR)\n`
    : '';
  const emailLine = lead.email?.trim() ? `📧 ${lead.email.trim()}\n` : '';
  const phoneLine = lead.nombre?.trim() ? `📞 ${phoneDisplay}\n` : '';
  const igLine = lead.instagram?.trim()
    ? `📸 IG: @${lead.instagram.trim()}  (https://instagram.com/${encodeURIComponent(
        lead.instagram.trim(),
      )})\n`
    : '';
  const ocupacionLine = lead.ocupacion?.trim()
    ? `💼 *Ocupación:* ${lead.ocupacion.trim()}\n`
    : '';

  const short = lead.scheduled_at
    ? `${flag} ${personDisplay} agendó una sesión.`
    : `${flag} ${personDisplay} dejó su número.`;

  const long =
    `🥋 *Nueva agenda JJL*\n` +
    `\n` +
    `${flag} *${personDisplay}*\n` +
    phoneLine +
    emailLine +
    igLine +
    scheduledLine +
    ocupacionLine +
    `\n` +
    `*Fortaleza:* ${prettyFortaleza}\n` +
    `*Limitante:* ${prettyLimitacion}\n` +
    `*Estado actual:* ${prettyEstado}\n` +
    `*Visión 6 meses:* ${prettyVision}\n` +
    `*Compromiso:* ${prettyCompromiso}\n` +
    (lead.disqualified ? `\n⚠️ Marcado como descalificado en el formulario.\n` : '') +
    `\nVer detalle: ${siteUrl()}/admin/agendas`;

  return { short, long };
}
