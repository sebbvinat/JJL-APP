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
  if (!user) return { admin: null, userId: null, tags: [], error: 'No autenticado', status: 401 } as const;
  const { data: profile } = await supabase
    .from('users')
    .select('rol, tags')
    .eq('id', user.id)
    .single<{ rol: string; tags: string[] | null }>();
  if (profile?.rol !== 'admin') {
    return { admin: null, userId: null, tags: [], error: 'No autorizado', status: 403 } as const;
  }
  return {
    admin: getAdminClient(),
    userId: user.id,
    tags: profile?.tags || [],
    error: null,
    status: 200,
  } as const;
}

const ALLOWED_TAGS = new Set(['soporte', 'profesor', 'setter']);

// GET /api/admin/tags — lista todos los admins con sus tags actuales.
export async function GET(request: NextRequest) {
  const auth = await ensureAdmin(request);
  if (!auth.admin) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.admin
    .from('users')
    .select('id, nombre, avatar_url, tags')
    .eq('rol', 'admin')
    .order('nombre');
  if (error) {
    if (/column .* does not exist/i.test(error.message)) {
      return NextResponse.json({ admins: [], setupRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    admins: (data || []).map((u: { id: string; nombre: string; avatar_url: string | null; tags: string[] | null }) => ({
      id: u.id,
      nombre: u.nombre,
      avatar_url: u.avatar_url,
      tags: u.tags || [],
    })),
    allowedTags: [...ALLOWED_TAGS],
  });
}

// PATCH /api/admin/tags — body: { userId, tags: string[] }. Reemplaza tags.
export async function PATCH(request: NextRequest) {
  const auth = await ensureAdmin(request);
  if (!auth.admin) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const userId = String(body?.userId || '');
  const rawTags = Array.isArray(body?.tags) ? body.tags : null;
  if (!userId || !rawTags) return NextResponse.json({ error: 'userId y tags requeridos' }, { status: 400 });

  // Nadie edita sus PROPIOS tags. Sin esto, un setter se borra el tag
  // 'setter' a sí mismo y queda con panel de admin completo — era el camino
  // de escalada más directo que había.
  if (userId === auth.userId) {
    return NextResponse.json(
      { error: 'No podés modificar tus propios permisos' },
      { status: 403 },
    );
  }
  // Segunda capa: un setter tampoco edita los tags de otros (el middleware ya
  // le bloquea el PATCH, esto cubre si esa whitelist cambiara).
  if (auth.tags.includes('setter')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const tags = rawTags
    .map((t: unknown) => String(t).toLowerCase().trim())
    .filter((t: string) => ALLOWED_TAGS.has(t));

  const { error } = await auth.admin.from('users').update({ tags }).eq('id', userId).eq('rol', 'admin');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, tags });
}
