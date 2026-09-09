import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireCron } from '@/lib/cron';
import { logger } from '@/lib/logger';
import { notifySettersLeadNoBook } from '@/lib/lead-notifications';

export const runtime = 'nodejs';

/**
 * GET /api/cron/setter-no-book-followup
 *
 * Vercel cron — schedule recomendado: cada hora (`0 * * * *`).
 *
 * Avisa al SETTER (admins con tag='setter') cuando un lead:
 *   - Completó las 5 preguntas obligatorias del quiz
 *   - NO se autoexcluyó (disqualified = false)
 *   - NO agendó (booked = false)
 *   - Pasaron >= 2 horas desde que se creó (SLA — le damos margen para
 *     que agende solo antes de "molestar" al setter)
 *   - Aún no le notificamos (setter_notified_no_book_at IS NULL)
 *   - Es de los últimos 7 días (no revivimos leads viejísimos)
 *
 * El canal de notificación es panel admin in-app + push browser, vía
 * `notifySettersLeadNoBook` → `createNotification`. NO usa WhatsApp.
 *
 * Auth: requireCron (Bearer CRON_SECRET timing-safe). Lo dispara
 * cron-job.org con el header Authorization configurado. Rechaza si la
 * env var no está.
 */
export async function GET(request: NextRequest) {
  const denied = requireCron(request);
  if (denied) return denied;

  const admin = createAdminSupabaseClient();
  const now = Date.now();
  const slaCutoff = new Date(now - 2 * 60 * 60 * 1000).toISOString();   // hace >= 2 hs
  const maxAge = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(); // últimos 7 días

  const { data: leads, error } = await admin
    .from('lead_quiz_responses')
    .select(
      'id, session_id, instagram, ocupacion, fortaleza, limitacion, estado, vision, compromiso, telefono, pais, nombre, email, scheduled_at, created_at',
    )
    .eq('booked', false)
    .eq('disqualified', false)
    .is('setter_notified_no_book_at', null)
    .not('fortaleza', 'is', null)
    .not('limitacion', 'is', null)
    .not('estado', 'is', null)
    .not('vision', 'is', null)
    .not('compromiso', 'is', null)
    .lte('created_at', slaCutoff)
    .gte('created_at', maxAge)
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) {
    logger.error('cron.setter_no_book.list_failed', { err: error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ checked: 0, notified: 0 });
  }

  let notified = 0;
  for (const lead of leads) {
    const res = await notifySettersLeadNoBook(admin, lead);
    // Marcamos timestamp incluso si notified=0 (no hay setters configurados)
    // para no reintentar en loop. La función ya loguea warn.
    await admin
      .from('lead_quiz_responses')
      .update({ setter_notified_no_book_at: new Date().toISOString() })
      .eq('id', lead.id);
    notified += res.notified;
  }

  return NextResponse.json({ checked: leads.length, notified });
}
