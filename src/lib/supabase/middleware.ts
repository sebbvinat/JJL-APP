import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip auth check if Supabase is not configured yet
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('TU-PROYECTO')) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require auth
  const publicRoutes = ['/', '/login', '/register', '/consultoria-gratuita'];
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/auth/');

  // Allow /profile with reset param (password recovery flow)
  const isPasswordReset = pathname === '/profile' && request.nextUrl.searchParams.get('reset') === '1';

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

  // SINGLE DB READ: admin-gate + onboarding-gate reuse the same row.
  let profile: { rol: string; onboarding_completed_at: string | null } | null = null;
  if (user && !isPublicRoute) {
    const { data } = await supabase
      .from('users')
      .select('rol, onboarding_completed_at')
      .eq('id', user.id)
      .single<{ rol: string; onboarding_completed_at: string | null }>();
    profile = data;
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
  if (user && profile && profile.onboarding_completed_at !== null && pathname === '/bienvenida') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
