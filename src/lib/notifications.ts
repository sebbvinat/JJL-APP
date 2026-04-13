import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

type NotificationType = 'belt' | 'module' | 'streak' | 'achievement' | 'system';

export async function createNotification(
  userId: string,
  tipo: NotificationType,
  titulo: string,
  mensaje: string
) {
  const admin = supabaseAdmin();
  await admin.from('notifications').insert({
    user_id: userId,
    tipo,
    titulo,
    mensaje,
  });
}

export const BELT_NAMES: Record<string, string> = {
  white: 'Blanco',
  blue: 'Azul',
  purple: 'Purpura',
  brown: 'Marron',
  black: 'Negro',
};
