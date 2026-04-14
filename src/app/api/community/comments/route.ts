import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';

// POST: Add a comment to a post
export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { postId, contenido } = await request.json();

  if (!postId || !contenido?.trim()) {
    return NextResponse.json({ error: 'postId y contenido requeridos' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: user.id,
      contenido: contenido.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Increment comments count on the post
  await supabase.rpc('increment_comments', { p_post_id: postId }).maybeSingle();

  return NextResponse.json({ success: true, comment: data });
}
