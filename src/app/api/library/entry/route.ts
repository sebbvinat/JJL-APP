import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/library/entry
 *
 * Body: { fecha: 'YYYY-MM-DD', kind: 'aprendizaje' | 'observacion' | 'nota', text: string }
 *
 * Replaces the corresponding column on daily_tasks for (user, fecha).
 * Empty / whitespace text clears the field (effectively deletes the entry
 * from the library view).
 */

const KIND_TO_COLUMN: Record<string, 'aprendizajes' | 'observaciones' | 'notas'> = {
  aprendizaje: 'aprendizajes',
  observacion: 'observaciones',
  nota: 'notas',
};

export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: { fecha?: string; kind?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const { fecha, kind, text } = body;
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'fecha invalida' }, { status: 400 });
  }
  const column = kind ? KIND_TO_COLUMN[kind] : undefined;
  if (!column) {
    return NextResponse.json({ error: 'kind invalido' }, { status: 400 });
  }

  const trimmed = typeof text === 'string' ? text.trim() : '';
  const patch: Record<string, string | null> = { [column]: trimmed || null };

  const { error } = await supabase
    .from('daily_tasks')
    .update(patch)
    .eq('user_id', user.id)
    .eq('fecha', fecha);

  if (error) {
    logger.error('library.entry.update.failed', { err: error, userId: user.id, fecha, kind });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: !trimmed });
}
