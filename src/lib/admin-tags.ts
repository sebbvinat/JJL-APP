import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Devuelve los user_id de admins que tengan el tag dado. Si nadie tiene
 * ese tag, hace fallback a TODOS los admins (asi nada se pierde antes de
 * que se configuren tags por primera vez).
 *
 * Usar para routing de notificaciones especializadas:
 *   - 'soporte'  -> consultas de Soporte de alumnos
 *   - 'profesor' -> revisar videos
 *   - 'setter'   -> leads agendados / followup
 */
export async function getAdminsByTag(
  admin: SupabaseClient,
  tag: string
): Promise<string[]> {
  // Admins con el tag especifico
  const { data: tagged } = await admin
    .from('users')
    .select('id')
    .eq('rol', 'admin')
    .contains('tags', [tag]);
  const taggedIds = ((tagged || []) as { id: string }[]).map((u) => u.id);
  if (taggedIds.length > 0) return taggedIds;

  // Fallback: todos los admins
  const { data: all } = await admin.from('users').select('id').eq('rol', 'admin');
  return ((all || []) as { id: string }[]).map((u) => u.id);
}
