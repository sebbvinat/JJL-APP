import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

function requireEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY' | 'SUPABASE_SERVICE_ROLE_KEY') {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[supabase] Missing env: ${name}`);
  }
  return value;
}

/**
 * Supabase client for Server Components / Server Actions.
 * Uses the cookies() API from next/headers.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}

/**
 * Supabase client for Route Handlers (app/api).
 * Reads cookies from the incoming NextRequest. Does not write cookies back
 * because route handlers typically return JSON, not redirects.
 */
export function createRouteSupabaseClient(request: NextRequest) {
  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op: route handlers respond with JSON.
        },
      },
    }
  );
}

/**
 * Privileged Supabase client (service role). Bypasses RLS.
 * ONLY call from server-side code that has already validated the caller.
 */
export function createAdminSupabaseClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Helper: return the authenticated user for this request, or null.
 */
export async function getAuthedUser(request: NextRequest) {
  const supabase = createRouteSupabaseClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}

type OpcionesAdmin = { denyTags?: string[]; allowSetter?: boolean };

/**
 * Igual que `requireAdmin`, pero cuando rechaza dice POR QUÉ: 401 si no hay
 * sesión, 403 si hay sesión y no alcanza el permiso.
 *
 * Por qué existe: las rutas que hacían la auth a mano (analytics, soporte,
 * announcements, sync-planillas, drive, student-diary) distinguían esos dos
 * casos. Al pasarlas a este helper central mantienen los mismos códigos y el
 * mismo `{ error }`, y de paso heredan el rechazo de setters, que a mano no
 * tenían (miraban solo `rol === 'admin'`, y el setter ES rol='admin').
 *
 * Uso:
 *   const auth = await verificarAdmin(request);
 *   if (!auth.ctx) return NextResponse.json({ error: auth.error }, { status: auth.status });
 */
export async function verificarAdmin(request: NextRequest, opts?: OpcionesAdmin) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return { ctx: null, error: 'No autenticado', status: 401 } as const;

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from('users')
    .select('rol, tags')
    .eq('id', user.id)
    .single<{ rol: string; tags: string[] | null }>();

  const tags = profile?.tags || [];
  const esSetter = tags.includes('setter');
  const rechazo = { ctx: null, error: 'No autorizado', status: 403 } as const;

  // FALLA CERRADO CON SETTERS. Un setter es rol='admin' + tags:['setter'], así
  // que con mirar solo el rol pasaba TODOS los endpoints de admin; lo único que
  // lo frenaba era la lista blanca del middleware, que además no se aplicaba
  // entrando por el host de cursos. Ahora la marca 'setter' rechaza por
  // defecto y solo pasan las rutas que declaran `allowSetter: true` (las
  // mismas de src/lib/permisos-setter.ts). Si alguien crea una ruta nueva y se
  // olvida de pensar en el setter, nace cerrada para él.
  if (esSetter && !opts?.allowSetter) {
    return rechazo;
  }

  // `allowSetter`: un setter puede NO ser admin. Es una alumna con la marca
  // 'setter', que usa la app de alumnos con su cuenta y ademas opera Agendas.
  // Solo las rutas que el setter necesita pasan esta opcion (las mismas de la
  // lista blanca del middleware). En cualquier otra ruta de admin, una alumna
  // con la marca sigue rebotando aca: si alguien se olvida de algo, falla
  // cerrado.
  if (profile?.rol !== 'admin' && !(opts?.allowSetter && esSetter)) {
    return rechazo;
  }
  // `denyTags`: rechaza al caller si tiene alguno de esos tags. Para 'setter'
  // quedó redundante con el rechazo por defecto de arriba (inofensivo); sigue
  // sirviendo para cerrarle una ruta a cualquier otra marca.
  if (opts?.denyTags?.length && opts.denyTags.some((t) => tags.includes(t))) {
    return rechazo;
  }

  return {
    ctx: { user, supabase, admin, tags, rol: profile?.rol ?? null },
    error: null,
    status: 200,
  };
}

/**
 * Helper: return the authenticated user AND verify admin role.
 * Returns { user, supabase, admin, tags } where admin is the service-role
 * client, or null if not authenticated / not admin.
 *
 * Rechaza setters salvo `opts.allowSetter` (ver `verificarAdmin`). El
 * middleware ya aplica una lista blanca global; esto es la segunda capa
 * (defensa en profundidad — si el middleware no corre o alguien suma una ruta
 * a la lista por error, el guard local sigue cerrando).
 */
export async function requireAdmin(request: NextRequest, opts?: OpcionesAdmin) {
  return (await verificarAdmin(request, opts)).ctx;
}
