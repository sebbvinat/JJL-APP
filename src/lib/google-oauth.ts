import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente OAuth2 de Google con credenciales del proyecto.
 * Se usa para:
 *   - Generar la URL de consent (init).
 *   - Intercambiar el code por refresh+access token (callback).
 *   - Ejecutar requests autenticadas como el usuario que conectó (uploads).
 */
export function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alumno.jiujitsulatino.com';
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET no configurados');
  }
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${baseUrl.replace(/\/$/, '')}/api/admin/google-oauth/callback`
  );
}

export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const CONFIG_KEY = 'google_oauth_token';

export type OAuthTokenRecord = {
  refresh_token: string;
  email?: string | null;
  connected_at?: string;
};

/**
 * Lee el refresh token + email del admin conectado, de app_config.
 * Devuelve null si no existe (no se conectó nadie aún) o si la tabla
 * no existe todavía (pre-migración).
 */
export async function loadOAuthToken(): Promise<OAuthTokenRecord | null> {
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from('app_config')
      .select('value')
      .eq('key', CONFIG_KEY)
      .maybeSingle();
    if (error) {
      if (/relation .* does not exist/i.test(error.message)) return null;
      console.error('[oauth] load error', error);
      return null;
    }
    const v = (data as { value?: OAuthTokenRecord } | null)?.value;
    return v && v.refresh_token ? v : null;
  } catch (err) {
    console.error('[oauth] load exception', err);
    return null;
  }
}

export async function saveOAuthToken(rec: OAuthTokenRecord, updatedBy?: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from('app_config')
    .upsert(
      { key: CONFIG_KEY, value: rec, updated_by: updatedBy || null, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error) throw new Error(error.message);
}

export async function deleteOAuthToken(): Promise<void> {
  const admin = getAdminSupabase();
  await admin.from('app_config').delete().eq('key', CONFIG_KEY);
}

/**
 * Devuelve un cliente OAuth2 ya configurado con el refresh_token activo,
 * listo para hacer requests. googleapis se encarga de refrescar el
 * access_token automáticamente cuando expira.
 */
export async function getAuthenticatedOAuthClient(): Promise<ReturnType<typeof getOAuthClient> | null> {
  const token = await loadOAuthToken();
  if (!token) return null;
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: token.refresh_token });
  return client;
}
