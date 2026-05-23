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
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function ensureAdmin(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: null, error: 'No autenticado', status: 401 } as const;
  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as { rol?: string } | null)?.rol !== 'admin') {
    return { user, admin: null, error: 'No autorizado', status: 403 } as const;
  }
  return { user, admin: getAdminClient(), error: null, status: 200 } as const;
}

// GET /api/admin/announcements — lista todos los anuncios (admin).
export async function GET(request: NextRequest) {
  const auth = await ensureAdmin(request);
  if (!auth.admin) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.admin
    .from('announcements')
    .select('id, titulo, mensaje, importancia, url, activa, created_at, expires_at')
    .order('created_at', { ascending: false });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ announcements: [], setupRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ announcements: data || [] });
}

// POST /api/admin/announcements — admin crea uno nuevo + (opcional) notifica.
export async function POST(request: NextRequest) {
  const auth = await ensureAdmin(request);
  if (!auth.admin || !auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const titulo = String(body?.titulo || '').trim();
  const mensaje = String(body?.mensaje || '').trim();
  const importancia = ['info', 'warning', 'critical'].includes(body?.importancia) ? body.importancia : 'info';
  const url = body?.url ? String(body.url).trim() : null;
  const expires_at = body?.expires_at || null;
  const notifyAll = !!body?.notify;

  if (!titulo || !mensaje) return NextResponse.json({ error: 'titulo y mensaje son obligatorios' }, { status: 400 });
  if (titulo.length > 200) return NextResponse.json({ error: 'titulo muy largo' }, { status: 400 });
  if (mensaje.length > 2000) return NextResponse.json({ error: 'mensaje muy largo' }, { status: 400 });

  const { data, error } = await auth.admin
    .from('announcements')
    .insert({ titulo, mensaje, importancia, url, expires_at, created_by: auth.user.id })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Opcional: push a todos los usuarios.
  if (notifyAll && data?.id) {
    try {
      const { createNotification } = await import('@/lib/notifications');
      const { data: users } = await auth.admin.from('users').select('id');
      for (const u of (users || []) as { id: string }[]) {
        await createNotification(u.id, 'system', titulo, mensaje.slice(0, 140), url || '/dashboard');
      }
    } catch { /* silencioso */ }
  }

  return NextResponse.json({ success: true, id: data?.id });
}
