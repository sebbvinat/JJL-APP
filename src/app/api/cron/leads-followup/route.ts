import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
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
 * GET /api/cron/leads-followup
 *
 * Vercel cron (configurado en vercel.json). Busca leads que cumplen:
 *   - Completaron el quiz (las 5 choice questions están)
 *   - NO agendaron (booked = false)
 *   - NO se autoexcluyeron (disqualified = false)
 *   - Todavía no fueron notificados para follow-up (followed_up_at IS NULL)
 *   - Tienen Instagram (sino no podemos hacer follow-up)
 *   - Se crearon en los últimos 7 días (no rebotamos leads viejos)
 *
 * Para cada uno manda un WhatsApp al coach con sus respuestas y el link
 * directo a IG DM, y marca followed_up_at para no notificar dos veces.
 *
 * Auth: header `Authorization: Bearer <CRON_SECRET>` (Vercel lo manda solo
 * cuando configurás la env var). Si no hay CRON_SECRET, acepta cualquier
 * request — útil para invocar a mano desde el navegador en dev.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const admin = createAdminSupabaseClient();

  // Filtramos un rango:
  //   - Mínimo 30 min desde que llegó el lead (le damos tiempo a agendar
  //     antes de molestar).
  //   - Máximo 7 días (no revivimos leads viejísimos).
  const now = Date.now();
  const minAge = new Date(now - 30 * 60 * 1000).toISOString();
  const maxAge = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: leads, error } = await admin
    .from('lead_quiz_responses')
    .select(
      'id, session_id, instagram, ocupacion, fortaleza, limitacion, estado, vision, compromiso, telefono, pais, nombre, email, created_at',
    )
    .eq('booked', false)
    .eq('disqualified', false)
    .is('followed_up_at', null)
    .not('instagram', 'is', null)
    .not('fortaleza', 'is', null)
    .not('limitacion', 'is', null)
    .not('estado', 'is', null)
    .not('vision', 'is', null)
    .not('compromiso', 'is', null)
    .lte('created_at', minAge)
    .gte('created_at', maxAge)
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) {
    logger.error('cron.leads_followup.list_failed', { err: error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ checked: 0, sent: 0 });
  }

  let sent = 0;
  for (const lead of leads) {
    const message = buildFollowupMessage(lead);
    const result = await notifyCoachWhatsApp(message);
    // Aunque falle el WhatsApp marcamos el follow-up — sino seguimos
    // reintentando para siempre. El admin igual ve el lead en /admin/agendas.
    await admin
      .from('lead_quiz_responses')
      .update({ followed_up_at: new Date().toISOString() })
      .eq('id', lead.id);
    if (result.sent) sent += 1;
  }

  return NextResponse.json({ checked: leads.length, sent });
}

interface FollowupLead {
  instagram: string | null;
  ocupacion: string | null;
  fortaleza: string | null;
  limitacion: string | null;
  estado: string | null;
  vision: string | null;
  compromiso: string | null;
  pais: string | null;
  created_at: string | null;
}

function buildFollowupMessage(lead: FollowupLead): string {
  const flag = flagFor(lead.pais);
  const handle = lead.instagram?.trim() || 'sin IG';
  const dmLink = lead.instagram?.trim()
    ? `https://ig.me/m/${encodeURIComponent(lead.instagram.trim())}`
    : '';

  const prettyOcupacion =
    {
      estable: 'Trabajo estable / negocio estable',
      inestable: 'Trabajo inestable',
      jubilado: 'Jubilado',
    }[lead.ocupacion || ''] || lead.ocupacion || '—';

  const fortaleza = lead.fortaleza ? FORTALEZA_LABEL[lead.fortaleza] || lead.fortaleza : '—';
  const limitacion = lead.limitacion ? LIMITACION_LABEL[lead.limitacion] || lead.limitacion : '—';
  const estado = lead.estado ? ESTADO_LABEL[lead.estado] || lead.estado : '—';
  const vision = lead.vision ? VISION_LABEL[lead.vision] || lead.vision : '—';
  const compromiso = lead.compromiso ? COMPROMISO_LABEL[lead.compromiso] || lead.compromiso : '—';

  return (
    `📣 *Lead pendiente de contacto*\n` +
    `\n` +
    `${flag} *@${handle}*\n` +
    (dmLink ? `👉 Abrir DM: ${dmLink}\n` : '') +
    `\n` +
    `*Situación:* ${prettyOcupacion}\n` +
    `*Fortaleza:* ${fortaleza}\n` +
    `*Limitante:* ${limitacion}\n` +
    `*Estado actual:* ${estado}\n` +
    `*Visión 6 meses:* ${vision}\n` +
    `*Compromiso:* ${compromiso}\n` +
    `\n` +
    `Completó el form pero todavía no agendó. Escribile por IG.`
  );
}
