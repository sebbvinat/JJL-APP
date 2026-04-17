import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

function getSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET: list channels (admin) or messages in a channel
export async function GET(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('rol, nombre').eq('id', user.id).single();
  const isAdmin = (profile as any)?.rol === 'admin';

  const channelId = request.nextUrl.searchParams.get('channel');

  if (channelId) {
    // Get messages in this channel
    // Channel = alumno's user_id. Only the alumno or admins can read.
    if (!isAdmin && channelId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const admin = getAdmin();
    const { data: messages } = await admin
      .from('messages')
      .select('id, from_user_id, contenido, created_at')
      .eq('to_user_id', channelId)
      .order('created_at', { ascending: true })
      .limit(200);

    // Get sender names
    const senderIds = [...new Set((messages || []).map((m: any) => m.from_user_id))];
    let senders: Record<string, { nombre: string; avatar_url: string | null; rol: string }> = {};
    if (senderIds.length > 0) {
      const { data } = await admin.from('users').select('id, nombre, avatar_url, rol').in('id', senderIds);
      (data || []).forEach((u: any) => { senders[u.id] = { nombre: u.nombre, avatar_url: u.avatar_url, rol: u.rol }; });
    }

    // Mark as read (for this user)
    // We don't track per-message read status in group chat — just return messages

    return NextResponse.json({
      messages: (messages || []).map((m: any) => ({
        ...m,
        senderName: senders[m.from_user_id]?.nombre || 'Usuario',
        senderAvatar: senders[m.from_user_id]?.avatar_url || null,
        isAdmin: senders[m.from_user_id]?.rol === 'admin',
        isMine: m.from_user_id === user.id,
      })),
    });
  }

  // List channels
  if (isAdmin) {
    // Admin sees all alumnos as channels
    const admin = getAdmin();
    const { data: alumnos } = await admin
      .from('users')
      .select('id, nombre, avatar_url')
      .eq('rol', 'alumno')
      .order('nombre');

    // Get last message per channel + unread count
    const channels = [];
    for (const alumno of (alumnos || [])) {
      const { data: lastMsg } = await admin
        .from('messages')
        .select('contenido, created_at, from_user_id')
        .eq('to_user_id', alumno.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const msg = lastMsg?.[0];
      // "hasNew" = last message is FROM the alumno (not from an admin)
      const hasNew = msg?.from_user_id === alumno.id;
      channels.push({
        channelId: alumno.id,
        nombre: alumno.nombre,
        avatar_url: alumno.avatar_url,
        lastMessage: msg?.contenido || null,
        lastAt: msg?.created_at || null,
        hasNew,
      });
    }

    // Sort: channels with messages first, then by last message time
    channels.sort((a, b) => {
      if (a.lastAt && !b.lastAt) return -1;
      if (!a.lastAt && b.lastAt) return 1;
      if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt);
      return a.nombre.localeCompare(b.nombre);
    });

    return NextResponse.json({ channels });
  }

  // Alumno: their own channel only
  const admin = getAdmin();
  const { data: lastMsg } = await admin
    .from('messages')
    .select('contenido, created_at')
    .eq('to_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  return NextResponse.json({
    channels: [{
      channelId: user.id,
      nombre: 'Mi chat con el instructor',
      avatar_url: null,
      lastMessage: lastMsg?.[0]?.contenido || null,
      lastAt: lastMsg?.[0]?.created_at || null,
    }],
  });
}

// POST: send a message to a channel
export async function POST(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('rol, nombre').eq('id', user.id).single();
  const isAdmin = (profile as any)?.rol === 'admin';

  const { channelId, contenido } = await request.json();
  if (!channelId || !contenido?.trim()) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  // Alumno can only send to their own channel
  if (!isAdmin && channelId !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const admin = getAdmin();

  // Insert message: to_user_id = channelId (the alumno's ID)
  const { error } = await admin.from('messages').insert({
    from_user_id: user.id,
    to_user_id: channelId,
    contenido: contenido.trim(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Push notification
  try {
    const { createNotification } = await import('@/lib/notifications');
    const senderName = (profile as any)?.nombre || 'alguien';

    if (isAdmin) {
      // Admin sends → notify the alumno
      await createNotification(channelId, 'system', `Mensaje de ${senderName}`, contenido.trim().slice(0, 100), '/chat');
    } else {
      // Alumno sends → notify all admins
      const { data: admins } = await admin.from('users').select('id').eq('rol', 'admin');
      for (const a of (admins || [])) {
        await createNotification(a.id, 'system', `Mensaje de ${senderName}`, contenido.trim().slice(0, 100), '/chat');
      }
    }
  } catch {}

  return NextResponse.json({ success: true });
}
