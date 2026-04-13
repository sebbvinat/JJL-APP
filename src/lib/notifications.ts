import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

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
  mensaje: string,
  url?: string
) {
  const admin = supabaseAdmin();

  // Save in-app notification
  await admin.from('notifications').insert({
    user_id: userId,
    tipo,
    titulo,
    mensaje,
  });

  // Send push notification
  await sendPushToUser(userId, titulo, mensaje, url);
}

async function sendPushToUser(userId: string, title: string, body: string, url?: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;

  webpush.setVapidDetails('mailto:admin@jiujitsulatino.com', publicKey, privateKey);

  const admin = supabaseAdmin();
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, body, url: url || '/dashboard' });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        payload
      );
    } catch (err: any) {
      // Remove expired/invalid subscriptions
      if (err.statusCode === 410 || err.statusCode === 404) {
        await admin
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
    }
  }
}

export const BELT_NAMES: Record<string, string> = {
  white: 'Blanco',
  blue: 'Azul',
  purple: 'Purpura',
  brown: 'Marron',
  black: 'Negro',
};
