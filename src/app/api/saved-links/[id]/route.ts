import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface Ctx { params: Promise<{ id: string }> }

// PATCH /api/saved-links/:id  → edit titulo/notas/topic/status
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.titulo === 'string' || body.titulo === null) update.titulo = body.titulo;
  if (typeof body.notas === 'string' || body.notas === null) update.notas = body.notas;
  if (typeof body.topic === 'string') update.topic = body.topic;
  if (body.status === 'pending' || body.status === 'tried') update.status = body.status;

  const { data, error } = await supabase
    .from('saved_links')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
}

// DELETE /api/saved-links/:id
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  const { error } = await supabase
    .from('saved_links')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
