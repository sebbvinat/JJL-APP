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

/**
 * Helper: return the authenticated user AND verify admin role.
 * Returns { user, supabase, admin } where admin is the service-role client,
 * or null if not authenticated / not admin.
 */
export async function requireAdmin(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return null;

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') return null;

  return { user, supabase, admin };
}
