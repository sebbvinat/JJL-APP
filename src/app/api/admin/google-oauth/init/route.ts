import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireAdmin } from '@/lib/supabase/server';
import { getOAuthClient, OAUTH_SCOPES } from '@/lib/google-oauth';

export const runtime = 'nodejs';

/**
 * GET /api/admin/google-oauth/init — admin only.
 * Redirige al consent screen de Google. Setea cookie con `state` para
 * verificar en el callback (CSRF protection).
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  let client;
  try {
    client = getOAuthClient();
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'OAuth no configurado',
      hint: 'Setea GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET en Vercel env.',
    }, { status: 500 });
  }

  const state = randomBytes(16).toString('hex');
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',   // pide refresh_token
    prompt: 'consent',         // fuerza re-consent así devuelve refresh_token sí o sí
    scope: OAUTH_SCOPES,
    state,
    include_granted_scopes: true,
  });

  const res = NextResponse.redirect(authUrl);
  res.cookies.set('gdrive_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 10 * 60,   // 10 min para completar el flow
    path: '/',
  });
  return res;
}
