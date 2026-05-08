import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * GET /api/admin/leads
 *
 * Lista las respuestas del quiz de calificación. Solo accesible para usuarios
 * con rol = 'admin'. Soporta query params:
 *   ?filter=booked       → solo agendados (booked=true, disqualified=false)
 *   ?filter=disqualified → solo autoexcluidos (disqualified=true)
 *   ?filter=all          → todos (default)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { admin } = ctx;
    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') || 'all';

    let query = admin
      .from('lead_quiz_responses')
      .select(
        'id, session_id, instagram, ocupacion, fortaleza, limitacion, estado, vision, compromiso, urgencia, experiencia, telefono, pais, nombre, email, scheduled_at, calendly_event_uri, disqualified, booked, user_agent, referrer, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(500);

    if (filter === 'booked') {
      query = query.eq('booked', true).eq('disqualified', false);
    } else if (filter === 'disqualified') {
      query = query.eq('disqualified', true);
    } else if (filter === 'pending') {
      // calificaron pero no agendaron (todavía)
      query = query.eq('disqualified', false).eq('booked', false);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('admin.leads.list.failed', { err: error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ leads: data || [] });
  } catch (err) {
    logger.error('admin.leads.unhandled', { err });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
