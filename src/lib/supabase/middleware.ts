import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSiteFromRequest } from '@/lib/hosts';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip auth check if Supabase is not configured yet
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('TU-PROYECTO')) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ruteo por dominio: el mismo deploy sirve dos productos.
  const site = getSiteFromRequest(request);
  if (site === 'cursos') {
    return handleCursos(request, supabase, user, supabaseResponse);
  }
  return handleAlumno(request, supabase, user, supabaseResponse);
}

// ============================================================
// ALUMNO — programa de 6 meses (alumno.jiujitsulatino.com).
// Lógica original sin cambios de comportamiento.
// ============================================================
async function handleAlumno(
  request: NextRequest,
  supabase: SupabaseClient,
  user: User | null,
  supabaseResponse: NextResponse
) {
  const { pathname } = request.nextUrl;

  // ============================================================
  // API GATE para cliente_cursos. Las /api/* del programa no deben
  // responderle. Devolvemos 403 (sin redirect — los clientes son
  // navegadores haciendo fetch, no esperan HTML). Si no hay sesion
  // dejamos pasar para no romper APIs publicas: cada route se
  // autentica por su cuenta como hasta ahora.
  // ============================================================
  if (pathname.startsWith('/api/')) {
    if (user) {
      const { data: prof } = await supabase
        .from('users')
        .select('rol, program_member')
        .eq('id', user.id)
        .single<{ rol: string; program_member: boolean | null }>();
      const isAdmin = prof?.rol === 'admin';
      const isCursosClient = prof?.rol === 'cliente_cursos';
      const isGhostAlumno =
        prof?.rol === 'alumno' && prof?.program_member === false;
      if (!isAdmin && (isCursosClient || isGhostAlumno)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
    }
    return supabaseResponse;
  }

  // Public routes that don't require auth
  const publicRoutes = ['/', '/login', '/register', '/consultoria-gratuita'];
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/r/');

  // Allow /profile with reset param (password recovery flow)
  const isPasswordReset =
    pathname === '/profile' && request.nextUrl.searchParams.get('reset') === '1';

  // If not authenticated and trying to access protected route
  if (!user && !isPublicRoute && !isPasswordReset) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If authenticated and trying to access login/register
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // SINGLE DB READ: admin-gate + onboarding-gate + cross-site gate.
  let profile: {
    rol: string;
    onboarding_completed_at: string | null;
    program_member: boolean | null;
  } | null = null;
  if (user && !isPublicRoute) {
    const { data } = await supabase
      .from('users')
      .select('rol, onboarding_completed_at, program_member')
      .eq('id', user.id)
      .single<{
        rol: string;
        onboarding_completed_at: string | null;
        program_member: boolean | null;
      }>();
    profile = data;
  }

  // ============================================================
  // CROSS-SITE GATE: NO acceso al programa de 6 meses para:
  //   (a) rol = 'cliente_cursos'  (clientes migrados de cursos sueltos)
  //   (b) rol = 'alumno' AND program_member = false  (cuentas residuales
  //       que tienen rol=alumno historico pero no son miembros del programa
  //       — p.ej. registraron antes para consultoria y solo compraron
  //       cursos sueltos despues)
  // /auth/* queda excluido para que el callback de password reset funcione.
  // Admin nunca bloquea — pasa siempre.
  // ============================================================
  if (user && profile && !pathname.startsWith('/auth/')) {
    const isAdmin = profile.rol === 'admin';
    const isCursosClient = profile.rol === 'cliente_cursos';
    const isGhostAlumno =
      profile.rol === 'alumno' && profile.program_member === false;
    if (!isAdmin && (isCursosClient || isGhostAlumno)) {
      return NextResponse.redirect('https://jiujitsulatino.com/mis-cursos');
    }
  }

  // ADMIN ROUTE PROTECTION — server-side role check
  if (user && pathname.startsWith('/admin')) {
    if (profile?.rol !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // ONBOARDING GATE — force the /bienvenida flow until completed.
  // /auth/* is excluded so OAuth callbacks and password-reset flows work.
  if (
    user &&
    profile &&
    profile.onboarding_completed_at === null &&
    pathname !== '/bienvenida' &&
    !pathname.startsWith('/auth/')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/bienvenida';
    return NextResponse.redirect(url);
  }

  // Already-completed users visiting /bienvenida directly go to dashboard.
  if (
    user &&
    profile &&
    profile.onboarding_completed_at !== null &&
    pathname === '/bienvenida'
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

// ============================================================
// CURSOS — cursos sueltos (jiujitsulatino.com).
// Las páginas viven en el route group (cursos) bajo el prefijo
// literal /cursos. En el host de Cursos la URL es limpia y el
// middleware reescribe internamente a /cursos/*. En dev/localhost
// se accede directamente con el prefijo /cursos (sin rewrite).
// ============================================================
async function handleCursos(
  request: NextRequest,
  supabase: SupabaseClient,
  user: User | null,
  supabaseResponse: NextResponse
) {
  const { pathname } = request.nextUrl;

  // /api/* en host cursos: el middleware no toca; cada route handler hace
  // su propia auth (devuelve 401 JSON si no hay sesion). Asi no rompemos
  // clientes que llaman a /api/cursos/* esperando respuestas JSON.
  if (pathname.startsWith('/api/')) {
    return supabaseResponse;
  }

  const isPrefixed = pathname === '/cursos' || pathname.startsWith('/cursos/');
  // base = prefijo a usar en redirects (vacío en el host real, /cursos en dev)
  const base = isPrefixed ? '/cursos' : '';
  // logical = ruta tal como la ve el usuario, sin el prefijo interno
  const logical = isPrefixed ? pathname.slice('/cursos'.length) || '/' : pathname;

  const isPublic =
    logical === '/' ||
    logical === '/login' ||
    logical.startsWith('/curso/') ||
    logical.startsWith('/pack/') ||
    logical.startsWith('/auth/');

  // No autenticado en ruta protegida -> login
  if (!user && !isPublic) {
    return redirectWithCookies(request, supabaseResponse, `${base}/login`);
  }

  // Autenticado visitando login -> mis-cursos
  if (user && logical === '/login') {
    return redirectWithCookies(request, supabaseResponse, `${base}/mis-cursos`);
  }

  // Protección del admin de cursos — chequeo de rol server-side
  if (user && logical.startsWith('/admin-cursos')) {
    const { data: profile } = await supabase
      .from('users')
      .select('rol')
      .eq('id', user.id)
      .single<{ rol: string }>();
    if (profile?.rol !== 'admin') {
      return redirectWithCookies(request, supabaseResponse, `${base}/mis-cursos`);
    }
  }

  // En el host real la URL es limpia: reescribir al prefijo interno /cursos.
  if (!isPrefixed) {
    const url = request.nextUrl.clone();
    url.pathname = '/cursos' + (pathname === '/' ? '' : pathname);
    const res = NextResponse.rewrite(url, { request });
    copyCookies(supabaseResponse, res);
    return res;
  }

  return supabaseResponse;
}

function redirectWithCookies(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const res = NextResponse.redirect(url);
  copyCookies(supabaseResponse, res);
  return res;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
}
