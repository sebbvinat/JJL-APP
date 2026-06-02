import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

/**
 * GET /api/admin/youtube-oauth/callback — Google redirige acá.
 * Intercambia el code por refresh_token + access_token y los muestra en
 * pantalla para que el admin los copie y actualice en Vercel env.
 *
 * NO los guarda automaticamente en DB porque queremos que el admin elija
 * a propósito qué cuenta usar (en vez de pisar la actual silenciosamente).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const stateCookie = request.cookies.get('yt_oauth_state')?.value;

  function renderError(msg: string) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>YouTube OAuth — error</title>
    <style>body{font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 24px;background:#000;color:#fff}
    .err{background:#7f1d1d22;border:1px solid #ef4444;padding:16px;border-radius:8px;color:#fca5a5}</style></head>
    <body><h1>YouTube OAuth — error</h1><div class="err">${escapeHtml(msg)}</div>
    <p><a href="/admin" style="color:#ef4444">Volver al admin</a></p></body></html>`;
    return new NextResponse(html, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (error) return renderError(`Google devolvió error: ${error}`);
  if (!code) return renderError('Falta el code en la URL');
  if (!state || !stateCookie || state !== stateCookie) {
    return renderError('State no coincide (CSRF check). Cerrá esta pestaña y reintentá desde /api/admin/youtube-oauth/init');
  }

  // Verificar sesión admin
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return renderError('No estás logueado como admin en jjl-app. Andá a /login y volvé a intentar.');
  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as { rol?: string } | null)?.rol !== 'admin') {
    return renderError('Tu cuenta no es admin de jjl-app.');
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return renderError('Faltan YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET en env.');

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`;
  const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/admin/youtube-oauth/callback`;

  // Intercambio code -> tokens
  let tokens: { refresh_token?: string; access_token?: string; scope?: string } = {};
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return renderError(`Token exchange falló (${r.status}): ${text.slice(0, 300)}`);
    }
    tokens = await r.json();
  } catch (err) {
    return renderError(`Excepción en token exchange: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  if (!tokens.refresh_token) {
    return renderError(
      'Google no devolvió refresh_token. Esto suele pasar si ya consentiste antes. ' +
      'Andá a https://myaccount.google.com/permissions, buscá la app y quitale el acceso, después reintentá desde /api/admin/youtube-oauth/init.'
    );
  }

  // Obtener email + channelId de la cuenta autenticada
  let email = '';
  let channelId = '';
  let channelTitle = '';
  try {
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (profileRes.ok) {
      const j = await profileRes.json();
      email = j.email || '';
    }
  } catch { /* ignore */ }
  try {
    const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (chRes.ok) {
      const j = await chRes.json();
      channelId = j.items?.[0]?.id || '';
      channelTitle = j.items?.[0]?.snippet?.title || '';
    }
  } catch { /* ignore */ }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>YouTube OAuth — éxito</title>
  <style>body{font-family:system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 24px;background:#000;color:#fff}
  h1{color:#22c55e}
  .ok{background:#14532d22;border:1px solid #22c55e;padding:16px;border-radius:8px;margin:16px 0}
  .token{background:#111;border:1px solid #333;border-radius:6px;padding:12px;font-family:ui-monospace,monospace;font-size:12px;word-break:break-all;color:#fbbf24;margin:8px 0}
  .warn{background:#7c2d1222;border:1px solid #f97316;padding:12px;border-radius:6px;font-size:13px;color:#fdba74}
  button{background:#22c55e;color:#000;border:none;padding:8px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px}
  ol{line-height:1.7}
  code{background:#222;padding:2px 6px;border-radius:3px;color:#fbbf24}</style></head>
  <body>
  <h1>✅ Refresh token generado</h1>
  <div class="ok">
    <p><b>Cuenta autenticada:</b> ${escapeHtml(email || '(sin email)')}</p>
    <p><b>Canal asociado (mine=true):</b> ${escapeHtml(channelTitle || '(sin canal)')} ${channelId ? `(<code>${escapeHtml(channelId)}</code>)` : ''}</p>
    ${channelId === 'UC1ZCNotJuD9Kgk6t365doHA' ? '<p style="color:#22c55e">✓ Coincide con el canal JJL Latino esperado.</p>' : '<p style="color:#fbbf24">⚠ El canal no coincide con JIU JITSU LATINO (UC1ZCNotJuD9Kgk6t365doHA). Si querés cambiar de cuenta, revocá acceso en https://myaccount.google.com/permissions y reintentá.</p>'}
  </div>

  <div class="warn">
    <b>⚠ Anotá el refresh_token AHORA.</b> No lo vamos a mostrar de nuevo. Tampoco lo guardamos en DB automáticamente — vos elegís cuándo actualizar el env.
  </div>

  <h2>Refresh token</h2>
  <div class="token" id="rt">${escapeHtml(tokens.refresh_token)}</div>
  <button onclick="navigator.clipboard.writeText(document.getElementById('rt').textContent);this.textContent='✓ Copiado'">Copiar</button>

  <h2>Qué hacer con esto</h2>
  <ol>
    <li>Copiá el token arriba.</li>
    <li>Vercel → jjl-app → Settings → Environment Variables → buscá <code>YOUTUBE_REFRESH_TOKEN</code> → Edit → pegá el valor nuevo → Save.</li>
    <li>Si querés que el canal también se actualice: actualizá <code>YOUTUBE_CHANNEL_ID</code> a <code>${escapeHtml(channelId)}</code> (el que se autenticó).</li>
    <li>Redeploy (Vercel a veces lo hace solo cuando cambiás env vars; si no, push o redeploy manual).</li>
    <li>Volvé al chat con Claude y pegá el token también ahí para que pueda usarlo localmente.</li>
  </ol>
  </body></html>`;

  const res = new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  res.cookies.set('yt_oauth_state', '', { maxAge: 0, path: '/' });
  return res;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  } as Record<string, string>)[c] || c);
}
