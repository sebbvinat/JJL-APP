import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';

// POST: Toggle like on a post
export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { postId } = await request.json();
  if (!postId) {
    return NextResponse.json({ error: 'postId required' }, { status: 400 });
  }

  // Check if already liked
  const { data: existing } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .maybeSingle();

  if (existing) {
    // Unlike
    await supabase
      .from('post_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId);

    // Decrement count
    await supabase.rpc('decrement_likes', { p_post_id: postId }).maybeSingle();

    return NextResponse.json({ liked: false });
  } else {
    // Like
    await supabase
      .from('post_likes')
      .insert({ user_id: user.id, post_id: postId });

    // Increment count
    await supabase.rpc('increment_likes', { p_post_id: postId }).maybeSingle();

    return NextResponse.json({ liked: true });
  }
}
