import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * POST /api/leads/quiz
 *
 * Public endpoint: a prospect (not logged in) finished the 3-question
 * evaluation quiz and we want to capture their answers BEFORE they
 * (maybe) book on Calendly. Service-role insert bypasses RLS.
 *
 * Body: { session_id, fortaleza, limitacion, experiencia, nombre?, email? }
 */
export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const { session_id, fortaleza, limitacion, experiencia, nombre, email } =
    (body as Record<string, unknown>) || {};

  if (
    typeof session_id !== 'string' ||
    typeof fortaleza !== 'string' ||
    typeof limitacion !== 'string' ||
    typeof experiencia !== 'string'
  ) {
    return NextResponse.json(
      { error: 'session_id, fortaleza, limitacion y experiencia son requeridos' },
      { status: 400 },
    );
  }

  const userAgent = request.headers.get('user-agent') || null;
  const referrer = request.headers.get('referer') || null;

  try {
    const admin = createAdminSupabaseClient();
    const { error } = await admin.from('lead_quiz_responses').insert({
      session_id,
      fortaleza,
      limitacion,
      experiencia,
      nombre: typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null,
      email: typeof email === 'string' && email.trim() ? email.trim() : null,
      user_agent: userAgent,
      referrer,
    });
    if (error) {
      logger.error('leads.quiz.insert.failed', { err: error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('leads.quiz.unhandled', { err });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
