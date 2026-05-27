import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';
import { getOAuthClient, saveOAuthToken } from '@/lib/google-oauth';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

/**
 * GET /api/admin/google-oauth/callback — Google redirige acá tras consent.
 * Intercambia el code por refresh_token, guarda en app_config, redirige
 * a /admin/google-drive con success/error.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const stateCookie = request.cookies.get('gdrive_oauth_state')?.value;
  const base = process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`;

  function redirectBack(params: Record<string, string>) {
    const target = new URL('/admin/google-drive', base);
    Object.entries(params).forEach(([k, v]) => target.searchParams.set(k, v));
    const res = NextResponse.redirect(target);
    // limpiar cookie state
    res.cookies.set('gdrive_oauth_state', '', { maxAge: 0, path: '/' });
    return res;
  }

  if (error) return redirectBack({ error });
  if (!code) return redirectBack({ error: 'missing_code' });
  if (!state || !stateCookie || state !== stateCookie) return redirectBack({ error: 'state_mismatch' });

  // Verificar sesión admin antes de aceptar el code (defensa en profundidad —
  // requireAdmin no se puede usar acá porque no es POST, pero igual)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectBack({ error: 'not_authenticated' });
  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as { rol?: string } | null)?.rol !== 'admin') {
    return redirectBack({ error: 'not_admin' });
  }

  let client;
  try {
    client = getOAuthClient();
  } catch (err) {
    return redirectBack({ error: err instanceof Error ? err.message : 'oauth_not_configured' });
  }

  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      // Si Google no devuelve refresh_token (porque ya estaba consentido y
      // pedimos prompt='consent' no funcionó), avisamos.
      return redirectBack({ error: 'no_refresh_token', hint: 'revoca la app en https://myaccount.google.com/permissions y reintenta' });
    }

    client.setCredentials(tokens);
    // Obtener el email del usuario que autorizó (para mostrarlo en la UI)
    let email: string | null = null;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const info = await oauth2.userinfo.get();
      email = info.data.email || null;
    } catch { /* ignore */ }

    await saveOAuthToken(
      { refresh_token: tokens.refresh_token, email, connected_at: new Date().toISOString() },
      user.id
    );

    return redirectBack({ connected: '1' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'exchange_failed';
    return redirectBack({ error: msg.slice(0, 200) });
  }
}
