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

// GET: List posts (optionally filter by category)
export async function GET(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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
    .select('id, nombre, cinturon_actual')
    .in('id', userIds);

  const userMap: Record<string, { nombre: string; cinturon_actual: string }> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });

  // Check which posts the current user has liked
  const postIds = posts.map((p: any) => p.id);
  let likedPostIds: string[] = [];

  if (postIds.length > 0) {
    const { data: likes } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', postIds);

    likedPostIds = (likes || []).map((l: any) => l.post_id);
  }

  const formatted = posts.map((p: any) => ({
    id: p.id,
    autor: userMap[p.user_id]?.nombre || 'Usuario',
    cinturon: userMap[p.user_id]?.cinturon_actual || 'white',
    titulo: p.titulo,
    contenido: p.contenido,
    categoria: p.categoria,
    likes: p.likes_count || 0,
    comments: p.comments_count || 0,
    liked: likedPostIds.includes(p.id),
    isOwner: p.user_id === user.id,
    createdAt: p.created_at,
  }));

  return NextResponse.json({ posts: formatted });
}

// POST: Create a new post
export async function POST(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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

  return NextResponse.json({ success: true, post: data });
}
