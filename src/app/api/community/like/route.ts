import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// POST: Toggle like on a post
export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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
