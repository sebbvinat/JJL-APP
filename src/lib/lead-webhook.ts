// Reenvía los eventos del lead-magnet a un webhook externo configurable
// (Make.com, Zapier, n8n, Pipedream, etc.). Sirve para conectar el flujo
// con automatizaciones que no podemos hostear acá — ej. abrir un row en
// Google Sheets para los que NO agendaron, o disparar un flow de ManyChat
// cuando el lead ya inició contacto desde IG.
//
// Configurar en Vercel:
//   LEAD_WEBHOOK_URL=https://hook.make.com/xxxxx
//   LEAD_WEBHOOK_SECRET=<opcional — se manda como header X-JJL-Secret>
//
// Si LEAD_WEBHOOK_URL no está, esto no rompe — solo loguea un warn.

import { logger } from './logger';

export type LeadWebhookEvent =
  | 'lead.quiz_completed'   // el lead terminó el quiz (puede o no haber agendado)
  | 'lead.booked'           // confirmó agenda + dejó teléfono
  | 'lead.canceled';        // canceló la agenda desde Calendly

export interface LeadWebhookPayload {
  event: LeadWebhookEvent;
  session_id: string;
  instagram: string | null;
  ocupacion: string | null;
  fortaleza: string | null;
  limitacion: string | null;
  estado: string | null;
  vision: string | null;
  compromiso: string | null;
  telefono: string | null;
  pais: string | null;
  nombre: string | null;
  email: string | null;
  scheduled_at: string | null;
  disqualified: boolean;
  booked: boolean;
  created_at: string | null;
  // Link directo para abrir un DM de IG. Útil en Make/Zapier para mandarle
  // un email al coach con un botón "Abrir DM".
  instagram_dm_url: string | null;
}

export async function dispatchLeadWebhook(
  event: LeadWebhookEvent,
  lead: Omit<LeadWebhookPayload, 'event' | 'instagram_dm_url'>,
): Promise<void> {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) {
    logger.warn('lead.webhook.skipped', { reason: 'no_url', event });
    return;
  }

  const payload: LeadWebhookPayload = {
    event,
    ...lead,
    instagram_dm_url: lead.instagram
      ? `https://ig.me/m/${encodeURIComponent(lead.instagram)}`
      : null,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.LEAD_WEBHOOK_SECRET
          ? { 'X-JJL-Secret': process.env.LEAD_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('lead.webhook.bad_response', {
        event,
        status: res.status,
        body: body.slice(0, 200),
      });
    }
  } catch (err) {
    logger.warn('lead.webhook.threw', { event, err });
  }
}
