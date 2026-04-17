import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function getSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
}

// GET: list conversations or messages in a conversation
export async function GET(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const withUserId = request.nextUrl.searchParams.get('with');

  if (withUserId) {
    // Get messages between current user and withUserId
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${withUserId}),and(from_user_id.eq.${withUserId},to_user_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(100);

    // Mark as read
    await supabase
      .from('messages')
      .update({ leido: true })
      .eq('from_user_id', withUserId)
      .eq('to_user_id', user.id)
      .eq('leido', false);

    return NextResponse.json({ messages: messages || [] });
  }

  // List conversations (latest message per user)
  const { data: sent } = await supabase
    .from('messages')
    .select('to_user_id, contenido, created_at, leido')
    .eq('from_user_id', user.id)
    .order('created_at', { ascending: false });

  const { data: received } = await supabase
    .from('messages')
    .select('from_user_id, contenido, created_at, leido')
    .eq('to_user_id', user.id)
    .order('created_at', { ascending: false });

  // Build conversation list
  const convMap = new Map<string, { userId: string; lastMessage: string; lastAt: string; unread: number }>();

  (sent || []).forEach((m: any) => {
    if (!convMap.has(m.to_user_id)) {
      convMap.set(m.to_user_id, { userId: m.to_user_id, lastMessage: m.contenido, lastAt: m.created_at, unread: 0 });
    }
  });

  (received || []).forEach((m: any) => {
    const existing = convMap.get(m.from_user_id);
    if (!existing || m.created_at > existing.lastAt) {
      convMap.set(m.from_user_id, {
        userId: m.from_user_id,
        lastMessage: m.contenido,
        lastAt: m.created_at,
        unread: (existing?.unread || 0) + (!m.leido ? 1 : 0),
      });
    } else if (!m.leido) {
      existing.unread++;
    }
  });

  const conversations = [...convMap.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  // Get user names
  const userIds = conversations.map((c) => c.userId);
  let userNames: Record<string, { nombre: string; avatar_url: string | null }> = {};
  if (userIds.length > 0) {
    const { data } = await supabase.from('users').select('id, nombre, avatar_url').in('id', userIds);
    (data || []).forEach((u: any) => { userNames[u.id] = { nombre: u.nombre, avatar_url: u.avatar_url }; });
  }

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      ...c,
      nombre: userNames[c.userId]?.nombre || 'Usuario',
      avatar_url: userNames[c.userId]?.avatar_url || null,
    })),
  });
}

// POST: send a message
export async function POST(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { toUserId, contenido } = await request.json();
  if (!toUserId || !contenido?.trim()) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  const { error } = await supabase.from('messages').insert({
    from_user_id: user.id,
    to_user_id: toUserId,
    contenido: contenido.trim(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send push notification
  try {
    const { createNotification } = await import('@/lib/notifications');
    const { data: sender } = await supabase.from('users').select('nombre').eq('id', user.id).single();
    await createNotification(toUserId, 'system', `Mensaje de ${(sender as any)?.nombre || 'alguien'}`, contenido.trim().slice(0, 100), '/chat');
  } catch {}

  return NextResponse.json({ success: true });
}
