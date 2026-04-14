import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser, createAdminSupabaseClient } from '@/lib/supabase/server';

// GET: List posts (optionally filter by category)
export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const category = request.nextUrl.searchParams.get('category');

  let query = supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (category && category !== 'all') {
    query = query.eq('categoria', category);
  }

  const { data: posts, error } = await query;

  if (error) {
    console.error('Fetch posts error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ posts: [] });
  }

  // Fetch user info for all post authors
  const userIds = [...new Set(posts.map((p: any) => p.user_id))];
  const { data: users } = await supabase
    .from('users')
    .select('id, nombre, cinturon_actual, avatar_url')
    .in('id', userIds);

  const userMap: Record<string, { nombre: string; cinturon_actual: string; avatar_url: string | null }> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });

  // Check which posts the current user has liked + check if admin
  const postIds = posts.map((p: any) => p.id);
  let likedPostIds: string[] = [];

  const [likesResult, profileResult] = await Promise.all([
    postIds.length > 0
      ? supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds)
      : Promise.resolve({ data: [] }),
    supabase.from('users').select('rol').eq('id', user.id).single(),
  ]);

  likedPostIds = (likesResult.data || []).map((l: any) => l.post_id);
  const isAdmin = profileResult.data?.rol === 'admin';

  const formatted = posts.map((p: any) => ({
    id: p.id,
    autor: userMap[p.user_id]?.nombre || 'Usuario',
    avatar_url: userMap[p.user_id]?.avatar_url || null,
    cinturon: userMap[p.user_id]?.cinturon_actual || 'white',
    titulo: p.titulo,
    contenido: p.contenido,
    categoria: p.categoria,
    likes: p.likes_count || 0,
    comments: p.comments_count || 0,
    liked: likedPostIds.includes(p.id),
    isOwner: p.user_id === user.id,
    canDelete: p.user_id === user.id || isAdmin,
    createdAt: p.created_at,
  }));

  return NextResponse.json({ posts: formatted, isAdmin });
}

// POST: Create a new post
export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { titulo, contenido, categoria } = await request.json();

  if (!titulo?.trim() || !contenido?.trim()) {
    return NextResponse.json({ error: 'Titulo y contenido son requeridos' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      categoria: categoria || 'discussion',
    })
    .select()
    .single();

  if (error) {
    console.error('Create post error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Push notify all other users about the new post
  try {
    const { data: authorProfile } = await supabase
      .from('users')
      .select('nombre')
      .eq('id', user.id)
      .single();

    const admin = createAdminSupabaseClient();

    // Get all users except the author
    const { data: allUsers } = await admin
      .from('users')
      .select('id')
      .neq('id', user.id);

    if (allUsers && allUsers.length > 0) {
      const { createNotification } = await import('@/lib/notifications');
      const authorName = authorProfile?.nombre || 'Alguien';
      for (const u of allUsers) {
        await createNotification(
          u.id,
          'system',
          `Nuevo post de ${authorName}`,
          titulo.trim(),
          '/community'
        );
      }
    }
  } catch {}

  return NextResponse.json({ success: true, post: data });
}
