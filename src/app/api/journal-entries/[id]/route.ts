import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

interface Ctx { params: Promise<{ id: string }> }

/**
 * PATCH /api/journal-entries/[id]
 *   Body: { text: string }  — update the text of an existing entry.
 *   Empty string is rejected (use DELETE instead).
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await context.params;
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const trimmed = typeof body.text === 'string' ? body.text.trim() : '';
  if (!trimmed) {
    return NextResponse.json({ error: 'text vacio — usa DELETE' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .update({ text: trimmed })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, kind, text, fecha, created_at, updated_at')
    .single();

  if (error) {
    logger.error('journal-entries.update.failed', { err: error, id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data });
}

/**
 * DELETE /api/journal-entries/[id]
 */
export async function DELETE(request: NextRequest, context: Ctx) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await context.params;
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    logger.error('journal-entries.delete.failed', { err: error, id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
