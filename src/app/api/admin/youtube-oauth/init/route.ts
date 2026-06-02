import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/admin/youtube-oauth/init — admin only.
 * Redirige al consent screen de Google con scope youtube.readonly,
 * para generar un refresh token de la cuenta dueña del canal JJL.
 * Usa el mismo CLIENT_ID/SECRET que ya tenemos en YOUTUBE_CLIENT_ID/SECRET.
 *
 * Setea cookie con `state` para verificar en el callback (CSRF protection).
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'YOUTUBE_CLIENT_ID no configurado', hint: 'Setea YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET en Vercel env.' },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alumno.jiujitsulatino.com';
  const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/admin/youtube-oauth/callback`;
  const state = randomBytes(16).toString('hex');

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.readonly');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');   // fuerza refresh_token nuevo
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);

  const res = NextResponse.redirect(url);
  res.cookies.set('yt_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/',
  });
  return res;
}
