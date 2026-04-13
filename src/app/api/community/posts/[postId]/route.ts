import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function getSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
}

// GET: Single post with comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch post
  const { data: post, error } = await supabase
    .from('posts')
    .select('*, users!posts_user_id_fkey(nombre, cinturon_actual)')
    .eq('id', postId)
    .single();

  if (error || !post) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }

  // Fetch comments
  const { data: comments } = await supabase
    .from('comments')
    .select('*, users!comments_user_id_fkey(nombre, cinturon_actual)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  // Check if user liked this post
  const { data: like } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .maybeSingle();

  return NextResponse.json({
    post: {
      id: post.id,
      autor: (post.users as any)?.nombre || 'Usuario',
      cinturon: (post.users as any)?.cinturon_actual || 'white',
      titulo: post.titulo,
      contenido: post.contenido,
      categoria: post.categoria,
      likes: post.likes_count || 0,
      comments: post.comments_count || 0,
      liked: !!like,
      isOwner: post.user_id === user.id,
      createdAt: post.created_at,
    },
    comments: (comments || []).map((c: any) => ({
      id: c.id,
      autor: (c.users as any)?.nombre || 'Usuario',
      cinturon: (c.users as any)?.cinturon_actual || 'white',
      contenido: c.contenido,
      isOwner: c.user_id === user.id,
      createdAt: c.created_at,
    })),
  });
}

// DELETE: Delete own post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
