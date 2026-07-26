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

/**
 * Format a raw `messages.contenido` value for the channel list preview.
 * Audio messages are stored as `[audio]<url>` — we don't want to leak the
 * Supabase URL into the sidebar preview, so swap it for a friendly label.
 */
function formatPreview(contenido: string | null | undefined): string | null {
  if (!contenido) return null;
  if (contenido.startsWith('[audio]')) return '🎤 Audio';
  if (contenido.startsWith('[image]')) return '📷 Foto';
  return contenido;
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

    // Modos:
    //   (sin params)   → últimos PAGE_SIZE mensajes
    //   ?since=<iso>   → solo los posteriores (poll incremental: el cliente
    //                    hace append en vez de reemplazar los 200)
    //   ?before=<iso>  → PAGE_SIZE anteriores (scroll hacia arriba)
    //
    // Internamente SIEMPRE descending+limit y se invierte antes de responder.
    // Antes era ascending+limit(200), o sea los 200 MÁS VIEJOS: el canal con
    // más actividad (161 mensajes) iba a congelarse al pasar de 200 y ni el
    // alumno ni el coach verían los nuevos, sin ningún error visible.
    const PAGE_SIZE = 50;
    const since = request.nextUrl.searchParams.get('since');
    const before = request.nextUrl.searchParams.get('before');

    const admin = getAdmin();
    let q = admin
      .from('messages')
      .select('id, from_user_id, contenido, created_at')
      .eq('to_user_id', channelId)
      .order('created_at', { ascending: false });

    if (since) {
      // Incremental: sin límite de página (siempre son pocos) pero acotado
      // por seguridad.
      q = q.gt('created_at', since).limit(200);
    } else if (before) {
      q = q.lt('created_at', before).limit(PAGE_SIZE);
    } else {
      q = q.limit(PAGE_SIZE);
    }

    const { data: rows } = await q;
    // Devolvemos en orden cronológico, que es como los pinta el cliente.
    const messages = (rows || []).slice().reverse();

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

    // Último mensaje por canal en UNA query. Antes era un bucle con un query
    // adentro: 1 + N (26 consultas con 25 alumnos), y se re-ejecutaba cada vez
    // que el admin volvía a la lista. Mismo patrón que ya usa /api/admin/soporte.
    const alumnoIds = (alumnos || []).map((a: any) => a.id);
    const lastByChannel = new Map<string, { contenido: string | null; created_at: string; from_user_id: string }>();
    if (alumnoIds.length > 0) {
      const { data: recent } = await admin
        .from('messages')
        .select('contenido, created_at, from_user_id, to_user_id')
        .in('to_user_id', alumnoIds)
        .order('created_at', { ascending: false })
        .limit(1000);
      // Vienen ordenados desc → el primero de cada canal es el más reciente.
      for (const m of (recent || []) as any[]) {
        if (!lastByChannel.has(m.to_user_id)) lastByChannel.set(m.to_user_id, m);
      }
    }

    const channels = (alumnos || []).map((alumno: any) => {
      const msg = lastByChannel.get(alumno.id);
      // "hasNew" = last message is FROM the alumno (not from an admin)
      const hasNew = msg?.from_user_id === alumno.id;
      return {
        channelId: alumno.id,
        nombre: alumno.nombre,
        avatar_url: alumno.avatar_url,
        lastMessage: formatPreview(msg?.contenido),
        lastAt: msg?.created_at || null,
        hasNew,
      };
    });

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
      lastMessage: formatPreview(lastMsg?.[0]?.contenido),
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

  // Notificaciones: FUERA del camino crítico. Antes se esperaban antes de
  // responder — insert + select de push_subscriptions + N llamadas HTTP a
  // FCM/APNs, todo en serie: con 3 admins eran ~9 round-trips más HTTP externo
  // entre que el alumno tocaba "enviar" y el mensaje aparecía (1-3 s).
  // El mensaje YA está guardado; la notificación es best-effort.
  const notify = (async () => {
    try {
      const { createNotification } = await import('@/lib/notifications');
      const senderName = (profile as any)?.nombre || 'alguien';
      const preview = contenido.trim().slice(0, 100);

      if (isAdmin) {
        // Admin sends → notify the alumno
        await createNotification(channelId, 'system', `Mensaje de ${senderName}`, preview, '/chat');
      } else {
        // Alumno sends → notify all admins, en paralelo
        const { data: admins } = await admin.from('users').select('id').eq('rol', 'admin');
        await Promise.allSettled(
          (admins || []).map((a: { id: string }) =>
            createNotification(a.id, 'system', `Mensaje de ${senderName}`, preview, '/chat'),
          ),
        );
      }
    } catch { /* best-effort */ }
  })();
  // `after` deja que Vercel complete el trabajo tras responder. Si no está
  // disponible, no esperamos igual: la notificación se pierde en el peor caso,
  // pero el mensaje —que es lo que importa— ya quedó guardado.
  try {
    const { after } = await import('next/server');
    after(notify);
  } catch {
    void notify;
  }

  return NextResponse.json({ success: true });
}
