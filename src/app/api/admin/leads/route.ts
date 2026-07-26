import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * GET /api/admin/leads
 *
 * Lista las respuestas del quiz. Soporta query params:
 *   ?filter=booked|pending|disqualified|all  (legacy)
 *   ?stage=nuevo,contactado,agendado,...     (CRM kanban — comma-separated)
 *   ?assigned=<userId> | unassigned
 *   ?q=<busqueda en nombre/email/instagram/telefono>
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { admin } = ctx;
    // Un setter solo ve su propia cartera: los leads asignados a él más los
    // que están sin asignar (hoy están TODOS sin asignar, así que en la
    // práctica sigue viendo lo mismo — pero el día que haya dos setters no se
    // pisan ni se leen los contactos del otro).
    const isSetter = ctx.tags.includes('setter');
    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') || 'all';
    const stageParam = url.searchParams.get('stage');
    const assignedParam = url.searchParams.get('assigned');
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    let query = admin
      .from('lead_quiz_responses')
      .select(
        'id, session_id, instagram, ocupacion, fortaleza, limitacion, estado, vision, compromiso, urgencia, experiencia, telefono, pais, nombre, email, scheduled_at, calendly_event_uri, disqualified, booked, user_agent, referrer, created_at, stage, assigned_to, converted_user_id, last_contact_at',
      )
      .order('created_at', { ascending: false })
      .limit(500);

    // Filtros legacy
    if (filter === 'booked') {
      query = query.eq('booked', true).eq('disqualified', false);
    } else if (filter === 'disqualified') {
      query = query.eq('disqualified', true);
    } else if (filter === 'pending') {
      query = query.eq('disqualified', false).eq('booked', false);
    }

    // Filtros CRM
    if (stageParam) {
      const stages = stageParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (stages.length > 0) query = query.in('stage', stages);
    }
    if (assignedParam) {
      if (assignedParam === 'unassigned') query = query.is('assigned_to', null);
      else query = query.eq('assigned_to', assignedParam);
    }
    if (isSetter) {
      query = query.or(`assigned_to.eq.${ctx.user.id},assigned_to.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      // Pre-migración: las columnas nuevas pueden no existir
      if (/column .* does not exist/i.test(error.message)) {
        const fallback = await admin
          .from('lead_quiz_responses')
          .select('id, session_id, instagram, ocupacion, fortaleza, limitacion, estado, vision, compromiso, urgencia, experiencia, telefono, pais, nombre, email, scheduled_at, calendly_event_uri, disqualified, booked, user_agent, referrer, created_at')
          .order('created_at', { ascending: false })
          .limit(500);
        return NextResponse.json({ leads: fallback.data || [], setupRequired: true });
      }
      logger.error('admin.leads.list.failed', { err: error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let leads = data || [];

    // Búsqueda cliente-side (sobre 500 max)
    if (q) {
      leads = leads.filter((l: { nombre?: string | null; email?: string | null; instagram?: string | null; telefono?: string | null }) =>
        `${l.nombre || ''} ${l.email || ''} ${l.instagram || ''} ${l.telefono || ''}`.toLowerCase().includes(q)
      );
    }

    // Cache HTTP removido (defensivo) — sin Vary:Cookie no podemos garantizar
    // que el browser no cachee respuesta de un user para otro.
    return NextResponse.json({ leads });
  } catch (err) {
    logger.error('admin.leads.unhandled', { err });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
