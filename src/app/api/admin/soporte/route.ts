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

// GET /api/admin/soporte — inbox: lista de hilos (1 por alumno con mensajes)
// + ultimo mensaje + count de no-leidos del alumno (sender='user' & leido=false).
export async function GET(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as { rol?: string } | null)?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const admin = getAdmin();

  // Traer todos los mensajes (cohorte chica) y agregar en memoria por user_id.
  const { data: msgs, error } = await admin
    .from('support_messages')
    .select('id, user_id, sender, contenido, leido, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ threads: [], setupRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Msg = { id: string; user_id: string; sender: string; contenido: string; leido: boolean; created_at: string };
  const byUser = new Map<string, { last: Msg; unread: number }>();
  for (const m of (msgs || []) as Msg[]) {
    const cur = byUser.get(m.user_id);
    if (!cur) byUser.set(m.user_id, { last: m, unread: m.sender === 'user' && !m.leido ? 1 : 0 });
    else if (m.sender === 'user' && !m.leido) cur.unread++;
  }
  if (byUser.size === 0) return NextResponse.json({ threads: [] });

  // Adjuntar nombre + avatar del alumno
  const { data: users } = await admin
    .from('users')
    .select('id, nombre, avatar_url, rol')
    .in('id', [...byUser.keys()]);
  const uMap = new Map((users || []).map((u: { id: string }) => [u.id, u]));

  const threads = [...byUser.entries()].map(([uid, info]) => {
    const u = uMap.get(uid) as { nombre?: string; avatar_url?: string | null; rol?: string } | undefined;
    return {
      userId: uid,
      nombre: u?.nombre || 'Alumno',
      avatar_url: u?.avatar_url || null,
      isAdmin: u?.rol === 'admin',
      lastMessage: info.last.contenido.slice(0, 120),
      lastSender: info.last.sender,    // 'user' o 'admin' (para indicar quien escribio ultimo)
      lastAt: info.last.created_at,
      unread: info.unread,             // mensajes del alumno sin leer
    };
  }).sort((a, b) => {
    if (a.unread !== b.unread) return b.unread - a.unread;     // no-leidos arriba
    return b.lastAt.localeCompare(a.lastAt);                    // luego por recencia
  });

  return NextResponse.json({ threads });
}
