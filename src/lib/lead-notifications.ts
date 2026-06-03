import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotification } from '@/lib/notifications';
import { getAdminsByTag } from '@/lib/admin-tags';
import { logger } from '@/lib/logger';
import {
  COMPROMISO_LABEL,
  ESTADO_LABEL,
  FORTALEZA_LABEL,
  LIMITACION_LABEL,
  VISION_LABEL,
  flagFor,
} from '@/lib/lead-labels';

/**
 * Lead row shape lo más mínimo para armar los mensajes — los callers traen
 * lo que ya tienen, no exigimos campos opcionales.
 */
export interface LeadForNotification {
  id?: string;
  session_id: string;
  nombre?: string | null;
  instagram?: string | null;
  ocupacion?: string | null;
  fortaleza?: string | null;
  limitacion?: string | null;
  estado?: string | null;
  vision?: string | null;
  compromiso?: string | null;
  pais?: string | null;
  scheduled_at?: string | null;
  created_at?: string | null;
}

/**
 * Genera un identificador legible para usar en títulos de notificación:
 *   1) `@instagram` si está
 *   2) `nombre` si está
 *   3) `session_id` truncado como fallback
 */
function leadLabel(lead: LeadForNotification): string {
  if (lead.instagram?.trim()) return `@${lead.instagram.trim()}`;
  if (lead.nombre?.trim()) return lead.nombre.trim();
  return lead.session_id.slice(0, 8);
}

/**
 * Notifica a los setters (admins con tag='setter') que un lead AGENDÓ.
 * Idempotencia controlada por el caller (no se vuelve a llamar si la fila
 * ya tiene `setter_notified_booked_at`).
 */
export async function notifySettersLeadBooked(
  admin: SupabaseClient,
  lead: LeadForNotification,
): Promise<{ notified: number }> {
  const setterIds = await getAdminsByTag(admin, 'setter');
  if (setterIds.length === 0) {
    logger.warn('lead.notify.booked.no_setters', { sessionId: lead.session_id });
    return { notified: 0 };
  }

  const flag = flagFor(lead.pais);
  const label = leadLabel(lead);
  const fechaPretty = lead.scheduled_at
    ? new Date(lead.scheduled_at).toLocaleString('es-AR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'fecha por confirmar';

  const titulo = `🟢 ${flag} ${label} agendó`;
  const mensaje = `Fecha: ${fechaPretty}`;
  const url = `/admin/agendas?session=${encodeURIComponent(lead.session_id)}`;

  let notified = 0;
  for (const userId of setterIds) {
    try {
      await createNotification(userId, 'system', titulo, mensaje, url);
      notified++;
    } catch (err) {
      logger.error('lead.notify.booked.failed', { err, userId, sessionId: lead.session_id });
    }
  }
  return { notified };
}

/**
 * Notifica a los setters que un lead llenó el quiz y NO agendó dentro del
 * SLA (default 2hs). Lo dispara el cron `/api/cron/setter-no-book-followup`.
 */
export async function notifySettersLeadNoBook(
  admin: SupabaseClient,
  lead: LeadForNotification,
): Promise<{ notified: number }> {
  const setterIds = await getAdminsByTag(admin, 'setter');
  if (setterIds.length === 0) {
    logger.warn('lead.notify.nobook.no_setters', { sessionId: lead.session_id });
    return { notified: 0 };
  }

  const flag = flagFor(lead.pais);
  const label = leadLabel(lead);

  // Detalles para que el setter sepa con qué llamar al lead — copy más
  // contextual que en booked porque acá tiene que decidir prioridad.
  const fortaleza = lead.fortaleza ? FORTALEZA_LABEL[lead.fortaleza] || lead.fortaleza : null;
  const limitacion = lead.limitacion ? LIMITACION_LABEL[lead.limitacion] || lead.limitacion : null;
  const estado = lead.estado ? ESTADO_LABEL[lead.estado] || lead.estado : null;
  const vision = lead.vision ? VISION_LABEL[lead.vision] || lead.vision : null;
  const compromiso = lead.compromiso ? COMPROMISO_LABEL[lead.compromiso] || lead.compromiso : null;

  const detalles = [
    fortaleza && `fuerte: ${fortaleza}`,
    limitacion && `limita: ${limitacion}`,
    estado && `estado: ${estado}`,
    vision && `quiere: ${vision}`,
    compromiso && `compromiso: ${compromiso}`,
  ].filter(Boolean).join(' · ');

  const titulo = `⚠️ ${flag} ${label} — llenó quiz sin agendar`;
  const mensaje = detalles || 'Contactar para agendar consultoría.';
  const url = `/admin/agendas?session=${encodeURIComponent(lead.session_id)}`;

  let notified = 0;
  for (const userId of setterIds) {
    try {
      await createNotification(userId, 'system', titulo, mensaje, url);
      notified++;
    } catch (err) {
      logger.error('lead.notify.nobook.failed', { err, userId, sessionId: lead.session_id });
    }
  }
  return { notified };
}
