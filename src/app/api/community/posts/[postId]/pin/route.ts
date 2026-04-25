import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser, createAdminSupabaseClient } from '@/lib/supabase/server';

// POST: toggle pinned state on a post. Admin-only.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single();
  if ((profile as any)?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  }

  const admin = createAdminSupabaseClient();
  const { data: current, error: fetchErr } = await admin
    .from('posts')
    .select('id, pinned')
    .eq('id', postId)
    .single();

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }

  const next = !(current as any).pinned;
  const { error } = await admin
    .from('posts')
    .update({ pinned: next })
    .eq('id', postId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, pinned: next });
}
