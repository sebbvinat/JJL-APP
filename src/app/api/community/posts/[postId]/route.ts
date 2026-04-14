import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser, createAdminSupabaseClient } from '@/lib/supabase/server';

// GET: Single post with comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Fetch post
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (error || !post) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }

  // Fetch comments
  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  // Fetch user info for post author + comment authors
  const allUserIds = [
    post.user_id,
    ...((comments || []).map((c: any) => c.user_id)),
  ];
  const uniqueUserIds = [...new Set(allUserIds)];

  // Admin client bypasses the per-row RLS on users so we can load every
  // author's public fields (name, belt, avatar), not just the caller's row.
  const authorLookup = createAdminSupabaseClient();
  const { data: users } = await authorLookup
    .from('users')
    .select('id, nombre, cinturon_actual, avatar_url, rol')
    .in('id', uniqueUserIds);

  const userMap: Record<string, { nombre: string; cinturon_actual: string; avatar_url: string | null; rol: string }> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });
  const beltFor = (uid: string) => userMap[uid]?.rol === 'admin' ? 'black' : (userMap[uid]?.cinturon_actual || 'white');

  // Check if user liked this post + check if admin
  const [{ data: like }, { data: callerProfile }] = await Promise.all([
    supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .maybeSingle(),
    supabase
      .from('users')
      .select('rol')
      .eq('id', user.id)
      .single(),
  ]);

  const isAdmin = callerProfile?.rol === 'admin';

  return NextResponse.json({
    isAdmin,
    post: {
      id: post.id,
      autor: userMap[post.user_id]?.nombre || 'Usuario',
      avatar_url: userMap[post.user_id]?.avatar_url || null,
      cinturon: beltFor(post.user_id),
      titulo: post.titulo,
      contenido: post.contenido,
      categoria: post.categoria,
      likes: post.likes_count || 0,
      comments: post.comments_count || 0,
      liked: !!like,
      isOwner: post.user_id === user.id || isAdmin,
      createdAt: post.created_at,
    },
    comments: (comments || []).map((c: any) => ({
      id: c.id,
      autor: userMap[c.user_id]?.nombre || 'Usuario',
      avatar_url: userMap[c.user_id]?.avatar_url || null,
      cinturon: beltFor(c.user_id),
      contenido: c.contenido,
      isOwner: c.user_id === user.id,
      canDelete: c.user_id === user.id || isAdmin,
      createdAt: c.created_at,
    })),
  });
}

// DELETE: Delete post (owner or admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Check if admin
  const { data: profile } = await supabase
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.rol === 'admin';

  if (isAdmin) {
    // Admin can delete any post — use service role to bypass RLS
    try {
      const adminClient = createAdminSupabaseClient();
      const { error } = await adminClient.from('posts').delete().eq('id', postId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    } catch {
      // Fall through to non-admin path if service role not configured
    }
  }

  // Non-admin: only delete own post
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
