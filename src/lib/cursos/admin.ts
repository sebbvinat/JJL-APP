import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from '@/lib/supabase/server';

// Verifica que el usuario actual sea admin. Devuelve el cliente service-role
// (bypassa RLS) para las operaciones del panel, o null si no es admin.
export async function ensureAdmin(): Promise<
  { userId: string; admin: SupabaseClient } | null
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single();
  if ((data as { rol?: string } | null)?.rol !== 'admin') return null;

  return { userId: user.id, admin: createAdminSupabaseClient() };
}
