import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[notifications] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Service-role access is required to write notifications and read push subscriptions.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

type NotificationType = 'belt' | 'module' | 'streak' | 'achievement' | 'system' | 'anuncio';

export async function createNotification(
  userId: string,
  tipo: NotificationType,
  titulo: string,
  mensaje: string,
  url?: string
) {
  const admin = supabaseAdmin();

  // Save in-app notification with its destination url so clicks in the
  // bell dropdown can deep-link the user to the right page.
  await admin.from('notifications').insert({
    user_id: userId,
    tipo,
    titulo,
    mensaje,
    url: url || null,
  });

  // Send push notification
  await sendPushToUser(userId, titulo, mensaje, url);
}

export async function sendPushToUser(userId: string, title: string, body: string, url?: string) {
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
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      } else {
        console.error('[push] sendNotification failed', { userId, statusCode, err });
      }
    }
  }
}

/**
 * La misma notificacion para muchos usuarios a la vez.
 *
 * `createNotification` en un for hace, por cada usuario, una escritura, una
 * lectura de sus suscripciones y los pushes, uno detras del otro. Al publicar
 * en la comunidad eso eran ~140 usuarios en fila: cerca de 300 viajes a la
 * base y a los servicios de push esperandose entre si, y el alumno mirando el
 * boton de "Publicar" 10 a 30 segundos.
 *
 * Aca: una sola escritura para todas, una sola lectura de suscripciones, y los
 * pushes en paralelo (de a PUSH_EN_PARALELO para no saturar). Las
 * suscripciones vencidas (404/410) se borran igual que en el envio individual.
 */
const PUSH_EN_PARALELO = 10;

export async function createNotificationsBulk(
  userIds: string[],
  tipo: NotificationType,
  titulo: string,
  mensaje: string,
  url?: string
) {
  if (userIds.length === 0) return;
  const admin = supabaseAdmin();

  // 1. Las notificaciones de la campanita, en tandas de 500 por las dudas.
  for (let i = 0; i < userIds.length; i += 500) {
    const { error } = await admin.from('notifications').insert(
      userIds.slice(i, i + 500).map((user_id) => ({ user_id, tipo, titulo, mensaje, url: url || null })),
    );
    if (error) console.error('[notifications] bulk insert failed', error);
  }

  // 2. Los pushes: solo a quien tiene el celular suscripto.
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails('mailto:admin@jiujitsulatino.com', publicKey, privateKey);

  const subs: { user_id: string; endpoint: string; keys_p256dh: string; keys_auth: string }[] = [];
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await admin
      .from('push_subscriptions')
      .select('user_id, endpoint, keys_p256dh, keys_auth')
      .in('user_id', userIds.slice(i, i + 200));
    if (data) subs.push(...data);
  }
  if (subs.length === 0) return;

  const payload = JSON.stringify({ title: titulo, body: mensaje, url: url || '/dashboard' });
  for (let i = 0; i < subs.length; i += PUSH_EN_PARALELO) {
    await Promise.allSettled(
      subs.slice(i, i + PUSH_EN_PARALELO).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
            payload,
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 410 || statusCode === 404) {
            await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          } else {
            console.error('[push] sendNotification failed', { userId: sub.user_id, statusCode, err });
          }
        }
      }),
    );
  }
}

export const BELT_NAMES: Record<string, string> = {
  white: 'Blanco',
  blue: 'Azul',
  purple: 'Purpura',
  brown: 'Marron',
  black: 'Negro',
};
