import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { ARQUETIPOS, calculateMatch, type ArquetipoId, type QuizAnswers } from '@/lib/match-arquetipos';

export const runtime = 'nodejs';

/**
 * POST /api/leads/match-quiz
 *
 * Persiste un resultado del quiz "¿A qué luchador te parecés?" y devuelve
 * el match calculado (el frontend lo usa para renderizar la ficha).
 *
 * Body: {
 *   session_id, peso, fisico, estilo, posicion, finalizacion, dolor, vision?,
 *   nombre?, instagram?
 * }
 *
 * Idempotente: re-postear el mismo session_id update-ea la fila existente.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: 'Body vacío' }, { status: 400 });

  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return NextResponse.json({ error: 'session_id inválido (esperado UUID)' }, { status: 400 });
  }

  const pick = (k: string): string | null => {
    const v = body![k];
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 500) : null;
  };

  const answers: Partial<QuizAnswers> = {
    peso: pick('peso') || '',
    fisico: pick('fisico') || '',
    estilo: pick('estilo') || '',
    posicion: pick('posicion') || '',
    finalizacion: pick('finalizacion') || '',
    dolor: pick('dolor') || '',
    vision: pick('vision') || '',
  };

  // Mínimo necesario: 5 de las 6 preguntas con score (todas menos visión).
  const scoring = ['peso', 'fisico', 'estilo', 'posicion', 'finalizacion', 'dolor'] as const;
  const answered = scoring.filter((k) => answers[k]).length;
  if (answered < 4) {
    return NextResponse.json({ error: 'Faltan respuestas (mínimo 4 de 6)' }, { status: 400 });
  }

  const match = calculateMatch(answers);
  const arquetipo = ARQUETIPOS[match.winner as ArquetipoId];

  try {
    const admin = createAdminSupabaseClient();
    const row = {
      session_id: sessionId,
      ...answers,
      nombre: pick('nombre'),
      instagram: pick('instagram'),
      match_arquetipo: match.winner,
      match_pct: match.matchPct,
    };
    const { error } = await admin
      .from('match_quiz_responses')
      .upsert(row, { onConflict: 'session_id' });
    if (error) {
      logger.error('match-quiz.upsert.failed', { err: error });
      // No bloqueamos la respuesta: el match igual se devuelve para mostrar al lead.
    }
  } catch (err) {
    logger.error('match-quiz.unhandled', { err });
  }

  return NextResponse.json({
    ok: true,
    match: {
      arquetipo,
      matchPct: match.matchPct,
    },
  });
}

/**
 * PATCH /api/leads/match-quiz
 * Track de clicks: shared_to_ig (compartió) o clicked_dm (apretó "Abrir DM").
 * Body: { session_id, action: 'shared' | 'dm' }
 */
export async function PATCH(request: NextRequest) {
  let body: { session_id?: unknown; action?: unknown } | null = null;
  try {
    const raw = await request.text();
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : '';
  const action = body?.action;
  if (!sessionId || (action !== 'shared' && action !== 'dm')) {
    return NextResponse.json({ error: 'session_id + action requeridos' }, { status: 400 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const field = action === 'shared' ? 'shared_to_ig' : 'clicked_dm';
    await admin.from('match_quiz_responses').update({ [field]: true }).eq('session_id', sessionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.warn('match-quiz.track.failed', { err, action });
    return NextResponse.json({ ok: false });
  }
}
