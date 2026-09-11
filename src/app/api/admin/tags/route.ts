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
  // Un setter que es alumna tambien lee esta lista (el dropdown de asignacion
  // de leads la usa). El PATCH igual se lo bloquea mas abajo por la marca.
  if (profile?.rol !== 'admin' && !(profile?.tags || []).includes('setter')) {
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

const ALLOWED_TAGS = new Set(['soporte', 'profesor', 'setter', 'errores']);

// GET /api/admin/tags — lista todos los admins con sus tags actuales.
export async function GET(request: NextRequest) {
  const auth = await ensureAdmin(request);
  if (!auth.admin) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.admin
    .from('users')
    .select('id, nombre, email, avatar_url, tags, rol')
    // Admins y setters. Un setter puede ser alumna: tiene que aparecer aca para
    // poder asignarle leads y para poder sacarle la marca.
    .or('rol.eq.admin,tags.cs.{setter}')
    .order('nombre');
  if (error) {
    if (/column .* does not exist/i.test(error.message)) {
      return NextResponse.json({ admins: [], setupRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // El setter puede leer esta lista (la necesita para el dropdown de
  // asignacion de leads), pero no tiene por que ver los mails del resto del
  // equipo. Solo los ven los admins con acceso completo.
  const verEmails = !auth.tags.includes('setter');

  return NextResponse.json({
    admins: (data || []).map((u: { id: string; nombre: string; email: string | null; avatar_url: string | null; tags: string[] | null; rol: string | null }) => ({
      id: u.id,
      rol: u.rol,
      nombre: u.nombre,
      avatar_url: u.avatar_url,
      tags: u.tags || [],
      ...(verEmails ? { email: u.email } : {}),
    })),
    allowedTags: [...ALLOWED_TAGS],
    // Para marcar tu propia fila: el PATCH no deja editar tus propios
    // permisos, asi que la pagina los muestra bloqueados en vez de tirar error.
    me: auth.userId,
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

  const { data: destino } = await auth.admin
    .from('users')
    .select('rol')
    .eq('id', userId)
    .single<{ rol: string }>();
  if (!destino) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  // Marcas solo para admins o alumnos del programa. Nunca a un cliente de
  // cursos sueltos, que no deberia poder entrar a nada del panel.
  if (destino.rol !== 'admin' && destino.rol !== 'alumno') {
    return NextResponse.json({ error: 'A este usuario no se le pueden dar permisos' }, { status: 400 });
  }

  let tags = rawTags
    .map((t: unknown) => String(t).toLowerCase().trim())
    .filter((t: string) => ALLOWED_TAGS.has(t));
  // A una alumna solo le sirve la marca de setter: soporte y profesor son
  // avisos de trabajo del equipo.
  if (destino.rol !== 'admin') tags = tags.filter((t: string) => t === 'setter');

  const { error } = await auth.admin.from('users').update({ tags }).eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, tags });
}
