import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/onboarding/step
 *
 * Body:
 *   { step: 1|2|3|4|5 }           → advance onboarding_step to that value
 *   { step: 5, complete: true }   → also sets onboarding_completed_at = NOW()
 */
export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: { step?: number; complete?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const step = Number(body.step);
  if (!Number.isInteger(step) || step < 1 || step > 5) {
    return NextResponse.json({ error: 'step debe ser 1..5' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { onboarding_step: step };
  if (body.complete === true) {
    patch.onboarding_completed_at = new Date().toISOString();
  }

  const { error } = await supabase.from('users').update(patch).eq('id', user.id);
  if (error) {
    logger.error('onboarding.step.update.failed', { err: error, userId: user.id, step });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, step, completed: body.complete === true });
}
