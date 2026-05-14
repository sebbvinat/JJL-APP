import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * GET /api/leads/check?session_id=xxx
 *
 * Endpoint público (los session_id son UUIDs aleatorios — no son secretos)
 * que devuelve si la fila del lead ya tiene teléfono cargado. Lo usa el
 * cliente para decidir si mostrar el form de captura de teléfono o no:
 * cuando Calendly tiene el número como pregunta requerida, el webhook lo
 * persiste antes de que el cliente termine de cambiar de paso y entonces
 * el form de teléfono se saltea automáticamente.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id requerido' }, { status: 400 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from('lead_quiz_responses')
      .select('telefono, scheduled_at, booked')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) {
      logger.warn('leads.check.read_failed', { err: error });
      return NextResponse.json({ has_phone: false, booked: false });
    }
    return NextResponse.json({
      has_phone: Boolean(data?.telefono && String(data.telefono).trim()),
      booked: Boolean(data?.booked),
      scheduled_at: data?.scheduled_at || null,
    });
  } catch (err) {
    logger.warn('leads.check.unhandled', { err });
    return NextResponse.json({ has_phone: false, booked: false });
  }
}
