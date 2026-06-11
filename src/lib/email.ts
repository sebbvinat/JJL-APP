import { logger } from '@/lib/logger';

/**
 * Helper de email único. Centraliza la decisión "tengo Resend configurado o
 * no" en un solo lugar — el llamador no necesita preocuparse.
 *
 * Comportamiento:
 *  - Sin RESEND_API_KEY → no-op, retorna { sent: false, reason: 'no-key' }.
 *    Es el modo por defecto en local y mientras Cloudflare Email Routing no
 *    esté listo. El feedback in-app y el push siguen llegando.
 *  - Con la key → envía y devuelve el id de Resend.
 *
 * El "from" arranca en `noreply@jiujitsulatino.com` (mismo dominio que
 * events/remind ya está usando). Cuando se cierre el tema mail puede pasar
 * a `notificaciones@` o lo que decidamos sin tocar callsites.
 */

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  /** Opcional: para responder al alumno cae acá. */
  replyTo?: string;
}

const FROM = 'JJL Elite <noreply@jiujitsulatino.com>';

export async function sendEmail({ to, subject, html, replyTo }: SendEmailArgs):
  Promise<{ sent: boolean; reason?: string; id?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: 'no-key' };
  if (!to || !to.includes('@')) return { sent: false, reason: 'invalid-to' };

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      logger.error('email.send.failed', { err: error.message, subject });
      return { sent: false, reason: error.message };
    }
    return { sent: true, id: data?.id };
  } catch (err) {
    logger.error('email.send.threw', { err });
    return { sent: false, reason: 'exception' };
  }
}

/**
 * Wrap simple para mantener consistencia visual con el email de events/remind:
 * fondo oscuro JJL + título rojo + cuerpo + CTA opcional + firma.
 */
export function brandedEmail({
  preheader,
  title,
  body,
  ctaLabel,
  ctaUrl,
  signature,
}: {
  preheader?: string;
  title: string;
  body: string; // HTML permitido
  ctaLabel?: string;
  ctaUrl?: string;
  signature?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>${title}</title></head>
<body style="margin:0;padding:24px;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#0a0a0a;opacity:0;">${preheader}</div>` : ''}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:#111;border-radius:14px;border:1px solid #1f1f1f;">
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0;color:#DC2626;font-size:11px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;">JIU JITSU LATINO</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;line-height:1.25;">${title}</h1>
    </td></tr>
    <tr><td style="padding:16px 28px 8px;color:#d4d4d4;font-size:15px;line-height:1.55;">
      ${body}
    </td></tr>
    ${ctaLabel && ctaUrl ? `
    <tr><td style="padding:20px 28px 4px;">
      <a href="${ctaUrl}" style="display:inline-block;background:#DC2626;color:#fff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">${ctaLabel}</a>
    </td></tr>` : ''}
    <tr><td style="padding:24px 28px;border-top:1px solid #1f1f1f;color:#666;font-size:12px;line-height:1.5;">
      ${signature || 'Equipo JJL'}
    </td></tr>
  </table>
</body>
</html>`;
}
