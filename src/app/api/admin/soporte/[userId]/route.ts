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

async function ensureAdmin(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null as null, admin: null as null, error: 'No autenticado' as string, status: 401 as number };
  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as { rol?: string } | null)?.rol !== 'admin') {
    return { user, admin: null, error: 'No autorizado', status: 403 } as const;
  }
  return { user, admin: getAdmin(), error: null as null, status: 200 as number };
}

// GET /api/admin/soporte/[userId] — hilo completo con un alumno + nombre del admin
// que escribio cada respuesta (para auditoria visual interna). Marca como leidos
// los mensajes del alumno (sender='user').
export async function GET(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;
  const auth = await ensureAdmin(request);
  if (!auth.admin) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = auth.admin;

  const { data, error } = await admin
    .from('support_messages')
    .select('id, sender, sender_user_id, contenido, leido, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolver nombres de los admins que respondieron (para visibilidad interna)
  type Row = { id: string; sender: string; sender_user_id: string | null; contenido: string; leido: boolean; created_at: string };
  const rows = (data || []) as Row[];
  const adminIds = [...new Set(rows.filter((r) => r.sender === 'admin' && r.sender_user_id).map((r) => r.sender_user_id as string))];
  let names: Record<string, string> = {};
  if (adminIds.length > 0) {
    const { data: us } = await admin.from('users').select('id, nombre').in('id', adminIds);
    (us || []).forEach((u: { id: string; nombre: string }) => { names[u.id] = u.nombre; });
  }

  // Info del alumno
  const { data: studentRow } = await admin.from('users').select('nombre, avatar_url').eq('id', userId).single();
  const student = (studentRow as { nombre?: string; avatar_url?: string | null } | null) || {};

  // Marcar leidos los mensajes del alumno
  const unreadIds = rows.filter((r) => r.sender === 'user' && !r.leido).map((r) => r.id);
  if (unreadIds.length > 0) {
    await admin.from('support_messages').update({ leido: true }).in('id', unreadIds);
  }

  return NextResponse.json({
    student: { id: userId, nombre: student.nombre || 'Alumno', avatar_url: student.avatar_url || null },
    messages: rows.map((r) => ({
      id: r.id,
      sender: r.sender,
      // visible al admin: qué admin respondio (no se muestra al alumno)
      adminName: r.sender === 'admin' && r.sender_user_id ? (names[r.sender_user_id] || 'Admin') : null,
      contenido: r.contenido,
      created_at: r.created_at,
    })),
  });
}

// POST /api/admin/soporte/[userId] — el admin responde al alumno como "Soporte".
export async function POST(request: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;
  const auth = await ensureAdmin(request);
  if (!auth.admin || !auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = auth.admin;

  const body = await request.json();
  const contenido = String(body?.contenido || '').trim();
  if (!contenido) return NextResponse.json({ error: 'Mensaje vacio' }, { status: 400 });
  if (contenido.length > 4000) return NextResponse.json({ error: 'Demasiado largo' }, { status: 400 });

  const { error } = await admin.from('support_messages').insert({
    user_id: userId,
    sender: 'admin',
    sender_user_id: auth.user.id,
    contenido,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notificar al alumno
  try {
    const { createNotification } = await import('@/lib/notifications');
    await createNotification(userId, 'system', 'Soporte', contenido.slice(0, 100), '/soporte');
  } catch { /* silencioso */ }

  return NextResponse.json({ success: true });
}
