import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser, createAdminSupabaseClient } from '@/lib/supabase/server';

// GET: List posts (optionally filter by category)
export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const category = request.nextUrl.searchParams.get('category');
  const mine = request.nextUrl.searchParams.get('mine') === '1';

  let query = supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (category && category !== 'all') {
    query = query.eq('categoria', category);
  }

  if (mine) {
    query = query.eq('user_id', user.id);
  }

  const { data: posts, error } = await query;

  if (error) {
    console.error('Fetch posts error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ posts: [] });
  }

  // Fetch user info for all post authors. Uses admin client because RLS on
  // public.users restricts SELECT to the caller's own row; without bypass,
  // avatar_url / nombre of other authors comes back null.
  const userIds = [...new Set(posts.map((p: any) => p.user_id))];
  const authorLookup = createAdminSupabaseClient();
  const { data: users } = await authorLookup
    .from('users')
    .select('id, nombre, cinturon_actual, avatar_url, rol')
    .in('id', userIds);

  const userMap: Record<string, { nombre: string; cinturon_actual: string; avatar_url: string | null; rol: string }> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });

  // Check which posts the current user has liked + check if admin
  const postIds = posts.map((p: any) => p.id);
  let likedPostIds: string[] = [];

  const [likesResult, profileResult, pollsResult, votesResult] = await Promise.all([
    postIds.length > 0
      ? supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds)
      : Promise.resolve({ data: [] }),
    supabase.from('users').select('rol').eq('id', user.id).single(),
    postIds.length > 0
      ? supabase.from('post_polls').select('*').in('post_id', postIds)
      : Promise.resolve({ data: [] }),
    supabase.from('post_poll_votes').select('poll_id, user_id, opcion_id'),
  ]);

  likedPostIds = (likesResult.data || []).map((l: any) => l.post_id);
  const isAdmin = (profileResult.data as any)?.rol === 'admin';

  // Build polls map
  const pollsByPost: Record<string, any> = {};
  const votesByPoll: Record<string, any[]> = {};
  (votesResult.data || []).forEach((v: any) => {
    if (!votesByPoll[v.poll_id]) votesByPoll[v.poll_id] = [];
    votesByPoll[v.poll_id].push(v);
  });
  (pollsResult.data || []).forEach((poll: any) => {
    const votes = votesByPoll[poll.id] || [];
    const counts: Record<string, number> = {};
    votes.forEach((v: any) => { counts[v.opcion_id] = (counts[v.opcion_id] || 0) + 1; });
    const myVotes = votes.filter((v: any) => v.user_id === user.id).map((v: any) => v.opcion_id);
    pollsByPost[poll.post_id] = {
      id: poll.id,
      pregunta: poll.pregunta,
      opciones: poll.opciones,
      multiple: poll.multiple,
      totalVotes: votes.length,
      counts,
      myVotes,
    };
  });

  const formatted = posts.map((p: any) => ({
    id: p.id,
    authorId: p.user_id,
    autor: userMap[p.user_id]?.nombre || 'Usuario',
    avatar_url: userMap[p.user_id]?.avatar_url || null,
    cinturon: userMap[p.user_id]?.rol === 'admin' ? 'black' : (userMap[p.user_id]?.cinturon_actual || 'white'),
    titulo: p.titulo,
    contenido: p.contenido,
    categoria: p.categoria,
    likes: p.likes_count || 0,
    comments: p.comments_count || 0,
    liked: likedPostIds.includes(p.id),
    isOwner: p.user_id === user.id,
    canDelete: p.user_id === user.id || isAdmin,
    createdAt: p.created_at,
    poll: pollsByPost[p.id] || null,
  }));

  return NextResponse.json({ posts: formatted, isAdmin });
}

// POST: Create a new post
export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { titulo, contenido, categoria, poll } = await request.json();

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

  // Create poll if provided
  if (poll && typeof poll === 'object' && poll.pregunta?.trim() && Array.isArray(poll.opciones)) {
    const validOpciones = poll.opciones
      .filter((o: any) => typeof o === 'string' && o.trim().length > 0)
      .map((texto: string, i: number) => ({ id: `opt-${i}`, texto: texto.trim() }));

    if (validOpciones.length >= 2) {
      await supabase.from('post_polls').insert({
        post_id: (data as any).id,
        pregunta: poll.pregunta.trim(),
        opciones: validOpciones,
        multiple: !!poll.multiple,
      });
    }
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
      const postUrl = data?.id ? `/community/${data.id}` : '/community';
      for (const u of allUsers) {
        await createNotification(
          u.id,
          'system',
          `Nuevo post de ${authorName}`,
          titulo.trim(),
          postUrl
        );
      }
    }
  } catch {}

  return NextResponse.json({ success: true, post: data });
}
