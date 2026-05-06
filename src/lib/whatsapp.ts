// Notificación al coach por WhatsApp usando CallMeBot (gratis, sin servidor).
//
// SETUP de una sola vez (lo hace el coach desde su WhatsApp):
//   1. Agendar el contacto +34 644 51 95 15 ("CallMeBot")
//   2. Enviarle el mensaje:  I allow callmebot to send me messages
//   3. CallMeBot responde con un APIKEY personal asociado al número.
//   4. Configurar en Vercel:
//        WHATSAPP_NOTIFY_PHONE  = 5491166518801   (sin "+", solo dígitos)
//        WHATSAPP_CALLMEBOT_KEY = <APIKEY recibido>
//
// Si cualquiera de las dos env vars falta, esta función no rompe — solo loguea
// un warn y devuelve { sent: false }.

import { logger } from './logger';

interface SendResult {
  sent: boolean;
  reason?: string;
}

export async function notifyCoachWhatsApp(message: string): Promise<SendResult> {
  const phone = process.env.WHATSAPP_NOTIFY_PHONE?.replace(/\D/g, '');
  const apikey = process.env.WHATSAPP_CALLMEBOT_KEY;

  if (!phone || !apikey) {
    logger.warn('whatsapp.notify.skipped', {
      reason: 'missing_env',
      hasPhone: Boolean(phone),
      hasKey: Boolean(apikey),
    });
    return { sent: false, reason: 'missing_env' };
  }

  // CallMeBot URL: https://api.callmebot.com/whatsapp.php?phone=...&text=...&apikey=...
  const url = new URL('https://api.callmebot.com/whatsapp.php');
  url.searchParams.set('phone', phone);
  url.searchParams.set('text', message);
  url.searchParams.set('apikey', apikey);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      // No queremos que un timeout aguante a la request del usuario.
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('whatsapp.notify.bad_response', { status: res.status, body });
      return { sent: false, reason: `status_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    logger.warn('whatsapp.notify.threw', { err });
    return { sent: false, reason: 'fetch_threw' };
  }
}
