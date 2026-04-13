import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// POST: Add a comment to a post
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
