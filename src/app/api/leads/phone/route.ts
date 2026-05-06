import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * POST /api/leads/phone
 *
 * Captura el teléfono + país que el lead ingresa después de agendar en
 * Calendly. Hace UPDATE sobre la fila existente (matched por session_id);
 * si la fila no existe (caso raro), upsert para no perder el dato.
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
    const { error } = await admin
      .from('lead_quiz_responses')
      .upsert(
        {
          session_id: session_id.trim(),
          telefono: telefono.trim(),
          pais: pais.trim(),
          booked: true,
        },
        { onConflict: 'session_id' },
      );
    if (error) {
      logger.error('leads.phone.upsert.failed', { err: error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('leads.phone.unhandled', { err });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
