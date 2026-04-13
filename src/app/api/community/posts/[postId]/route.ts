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

  const { data: users } = await supabase
    .from('users')
    .select('id, nombre, cinturon_actual')
    .in('id', uniqueUserIds);

  const userMap: Record<string, { nombre: string; cinturon_actual: string }> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });

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
      cinturon: userMap[post.user_id]?.cinturon_actual || 'white',
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
      cinturon: userMap[c.user_id]?.cinturon_actual || 'white',
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
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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
    const { createClient } = await import('@supabase/supabase-js');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { error } = await adminClient.from('posts').delete().eq('id', postId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
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
