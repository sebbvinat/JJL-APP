import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * POST /api/leads/quiz
 *
 * Public endpoint. Captura las respuestas del quiz de calificación ANTES de
 * que el lead agende en Calendly. La misma ruta también acepta updates
 * parciales por session_id (p. ej. booked=true cuando se confirma la reserva).
 *
 * Body completo (al terminar el quiz):
 *   { session_id, fortaleza, vision, estado, compromiso, urgencia,
 *     disqualified?, nombre?, email? }
 *
 * Body parcial (después de agendar):
 *   { session_id, booked: true }
 *
 * Service-role insert/upsert bypassea RLS — desde el cliente sólo se llega
 * por esta ruta.
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
  if (typeof session_id !== 'string' || !session_id.trim()) {
    return NextResponse.json({ error: 'session_id es requerido' }, { status: 400 });
  }

  const userAgent = request.headers.get('user-agent') || null;
  const referrer = request.headers.get('referer') || null;

  // Recolectar campos opcionales — si no vienen, no se mandan al insert.
  const update: Record<string, unknown> = { session_id };
  const stringFields = [
    'fortaleza',
    'vision',
    'estado',
    'compromiso',
    'urgencia',
    'limitacion',
    'experiencia',
    'instagram',
    'ocupacion',
    'nombre',
    'email',
  ];
  for (const f of stringFields) {
    const v = obj[f];
    if (typeof v === 'string' && v.trim()) update[f] = v.trim();
  }
  if (typeof obj.disqualified === 'boolean') update.disqualified = obj.disqualified;
  if (typeof obj.booked === 'boolean') update.booked = obj.booked;

  // Si trae las 5 respuestas obligatorias del quiz → es el insert inicial:
  // enriquecer con metadata. instagram + ocupacion son opcionales.
  const isInitial =
    typeof update.fortaleza === 'string' &&
    typeof update.limitacion === 'string' &&
    typeof update.estado === 'string' &&
    typeof update.vision === 'string' &&
    typeof update.compromiso === 'string';

  if (isInitial) {
    update.user_agent = userAgent;
    update.referrer = referrer;
  }

  try {
    const admin = createAdminSupabaseClient();
    // Upsert sobre session_id (UNIQUE en la tabla). Permite que el insert
    // inicial llegue y que después varias llamadas (booked / phone) hagan
    // merge sin duplicar filas.
    const { error } = await admin
      .from('lead_quiz_responses')
      .upsert(update, { onConflict: 'session_id' });
    if (error) {
      logger.error('leads.quiz.upsert.failed', { err: error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('leads.quiz.unhandled', { err });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
