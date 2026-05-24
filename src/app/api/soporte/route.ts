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

// GET /api/soporte — devuelve el hilo del alumno con "Soporte".
// Admins NO ven nombres reales: respuestas de admins aparecen como "Soporte".
// Marca como leidas las respuestas (sender='admin') al consultarlas.
export async function GET(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const admin = getAdmin();
  const { data, error } = await admin
    .from('support_messages')
    .select('id, sender, contenido, leido, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ messages: [], setupRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Marcar leidas las respuestas de Soporte (sender='admin') que el alumno acaba de ver
  const unreadAdminIds = (data || [])
    .filter((m) => m.sender === 'admin' && !m.leido)
    .map((m) => m.id);
  if (unreadAdminIds.length > 0) {
    await admin.from('support_messages').update({ leido: true }).in('id', unreadAdminIds);
  }

  return NextResponse.json({
    messages: (data || []).map((m) => ({
      id: m.id,
      sender: m.sender,                       // 'user' (yo) | 'admin' (Soporte)
      senderLabel: m.sender === 'admin' ? 'Soporte' : 'Vos',
      contenido: m.contenido,
      created_at: m.created_at,
      isMine: m.sender === 'user',
    })),
  });
}

// POST /api/soporte — el alumno envia un mensaje a Soporte.
export async function POST(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const contenido = String(body?.contenido || '').trim();
  if (!contenido) return NextResponse.json({ error: 'Mensaje vacio' }, { status: 400 });
  if (contenido.length > 4000) return NextResponse.json({ error: 'Demasiado largo' }, { status: 400 });

  const admin = getAdmin();
  const { error } = await admin.from('support_messages').insert({
    user_id: user.id,
    sender: 'user',
    sender_user_id: user.id,
    contenido,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notificar a admins con tag 'soporte' (o todos si nadie esta taggeado)
  try {
    const { createNotification } = await import('@/lib/notifications');
    const { getAdminsByTag } = await import('@/lib/admin-tags');
    const { data: prof } = await admin.from('users').select('nombre').eq('id', user.id).single();
    const senderName = (prof as { nombre?: string } | null)?.nombre || 'Alumno';
    const adminIds = await getAdminsByTag(admin, 'soporte');
    for (const aid of adminIds) {
      await createNotification(
        aid,
        'system',
        `Soporte: ${senderName}`,
        contenido.slice(0, 100),
        '/admin/soporte'
      );
    }
  } catch { /* silencioso */ }

  return NextResponse.json({ success: true });
}
