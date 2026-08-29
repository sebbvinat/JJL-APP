import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * POST /api/leads/calendly-event
 *
 * Tracking de carga del widget de Calendly embebido. El widget emite
 * postMessage al window padre y el cliente (CalendlyEmbed) nos reenvía:
 *   - event: 'loaded'            → `calendly.event_type_viewed` (el widget
 *                                  cargó y el lead lo vio)
 *   - event: 'datetime_selected' → `calendly.date_and_time_selected`
 *
 * Sirve para medir si el delay de carga del iframe hace que la gente se
 * vaya: completó quiz → cargó Calendly → eligió slot → agendó.
 *
 * Cada columna se setea SOLO la primera vez (si está null) — nos interesa
 * el primer momento, no re-visitas. Best-effort: si el lead todavía no
 * existe (el POST del quiz puede llegar después), respondemos ok igual —
 * nunca 500 por lead inexistente.
 *
 * Body: { session_id, event: 'loaded' | 'datetime_selected' }
 */

const EVENT_COLUMN: Record<string, string> = {
  loaded: 'calendly_loaded_at',
  datetime_selected: 'calendly_datetime_selected_at',
};

export async function POST(request: NextRequest) {
  let body: { session_id?: unknown; event?: unknown } | null = null;
  try {
    const raw = await request.text();
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : '';
  if (sessionId.length < 8 || sessionId.length > 100) {
    return NextResponse.json({ error: 'session_id inválido' }, { status: 400 });
  }

  const event = typeof body?.event === 'string' ? body.event : '';
  const column = EVENT_COLUMN[event];
  if (!column) {
    return NextResponse.json({ error: 'event inválido' }, { status: 400 });
  }

  try {
    const admin = createAdminSupabaseClient();
    // UPDATE condicionado a que la columna esté null: solo la primera vez
    // gana. Si no matchea ninguna fila (lead inexistente o ya marcado),
    // no es un error — respondemos ok igual.
    const { error } = await admin
      .from('lead_quiz_responses')
      .update({ [column]: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is(column, null);

    if (error) {
      logger.warn('leads.calendly-event.update.failed', { err: error, event });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('leads.calendly-event.unhandled', { err });
    return NextResponse.json({ ok: false }, { status: 200 }); // 200 para que el browser no reintente
  }
}
