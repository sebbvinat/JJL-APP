import 'server-only';

/**
 * Lectura de las consultorías agendadas en Calendly.
 *
 * El webhook de Calendly (`/api/webhooks/calendly`) nunca llegó a funcionar:
 * crear webhooks requiere plan Standard y la cuenta no lo tiene. Por eso
 * ningún lead tiene `scheduled_at` cargado y el panel nunca supo cuándo era
 * cada reunión.
 *
 * Leer las agendas SÍ está permitido en el plan actual, así que en vez de
 * esperar a que Calendly nos avise, las pedimos nosotros. Es una integración
 * de solo lectura: no se guarda nada en la base, se muestra en vivo.
 *
 * Necesita un Personal Access Token en `CALENDLY_TOKEN`
 * (Calendly → Integrations & apps → API & webhooks → Personal Access Tokens).
 */

const API = 'https://api.calendly.com';

export interface AgendaItem {
  id: string;
  /** Nombre del tipo de evento, ej "Consultoria gratuita BJJ". */
  evento: string;
  /** ISO UTC del arranque. El formateo a horario argentino se hace en el cliente. */
  inicio: string;
  fin: string;
  cancelado: boolean;
  /** Quién canceló y por qué, si está cancelado. */
  cancelacion: { por: string; motivo: string | null } | null;
  /** Link para entrar a la reunión (Google Meet / Zoom / etc). */
  joinUrl: string | null;
  invitado: {
    nombre: string | null;
    email: string | null;
    telefono: string | null;
    /** Usuario de Instagram con el que entro, si el quiz lo mando. */
    instagram: string | null;
  } | null;
}

/**
 * Cache en memoria. El panel se recarga seguido (y lo miran varios a la vez);
 * sin esto cada refresh dispara 1 + N llamadas a Calendly y nos comemos el
 * rate limit. 60s es suficiente: una consultoría nueva aparece en un minuto.
 */
const CACHE_TTL_MS = 60_000;
// La clave incluye el `desde`: con el calendario mensual se pide más de un
// rango, y un cache que los ignore devolvería el rango de la primera llamada.
let cache: { at: number; desde: string; items: AgendaItem[] } | null = null;

/** La URI de la organización no cambia nunca, así que se resuelve una sola vez. */
let orgUri: string | null = null;

function token(): string {
  const t = process.env.CALENDLY_TOKEN;
  if (!t) throw new Error('CALENDLY_TOKEN no configurada');
  return t;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    // Sin cache de Next: el cache lo manejamos nosotros arriba, con TTL propio.
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Calendly ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function organizacion(): Promise<string> {
  if (orgUri) return orgUri;
  const me = await get<{ resource: { current_organization: string } }>(`${API}/users/me`);
  orgUri = me.resource.current_organization;
  return orgUri;
}

interface RawEvent {
  uri: string;
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  location?: { join_url?: string | null; actual_instance?: { join_url?: string | null } | null } | null;
  cancellation?: { canceled_by?: string; reason?: string | null } | null;
}

/**
 * El link de la reunión.
 *
 * La API devuelve `location` plano (`{ type, join_url }`), pero algunos
 * clientes envuelven el oneOf en `actual_instance`. Leemos las dos formas
 * para no depender de por dónde vino la respuesta.
 */
function joinUrlDe(ev: RawEvent): string | null {
  return ev.location?.join_url || ev.location?.actual_instance?.join_url || null;
}

interface RawInvitee {
  name?: string | null;
  email?: string | null;
  text_reminder_number?: string | null;
  questions_and_answers?: { question: string; answer: string }[] | null;
}

/**
 * El Instagram viaja en la pregunta "REF (no llenar)" del formulario de
 * Calendly, que el quiz prellena con el handle. Es lo unico que permite atar
 * la consultoria al lead, porque los leads no guardan ni nombre ni mail.
 */
function instagramDe(inv: RawInvitee): string | null {
  const qa = (inv.questions_and_answers || []).find((q) => /^\s*ref\b/i.test(q.question));
  const v = (qa?.answer || '').trim().replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : null;
}

/** El teléfono puede venir en el recordatorio por SMS o en una pregunta del form. */
function telefonoDe(inv: RawInvitee): string | null {
  if (inv.text_reminder_number) return inv.text_reminder_number;
  const qa = (inv.questions_and_answers || []).find((q) =>
    /tel|phone|whats|celular|número|numero/i.test(q.question),
  );
  return qa?.answer?.trim() || null;
}

/**
 * Consultorías desde `desdeIso` en adelante, ordenadas por horario.
 * Incluye las canceladas: al setter le sirve verlas para re-agendar.
 *
 * NO trae los datos del invitado. Eso es una llamada por evento, y el
 * calendario pide ~4 meses: con 77 eventos se perdían 33 nombres (Calendly
 * corta) y tardaba 10 segundos. Los datos de la persona se piden aparte, solo
 * para el día que el setter abre — ver `invitadosDe`.
 */
export async function agendaCalendly(desdeIso: string, limite = 100): Promise<AgendaItem[]> {
  if (cache && cache.desde === desdeIso && Date.now() - cache.at < CACHE_TTL_MS) return cache.items;

  const org = await organizacion();
  const qs = new URLSearchParams({
    organization: org,
    min_start_time: desdeIso,
    sort: 'start_time:asc',
    count: String(Math.min(limite, 100)),
  });
  const { collection } = await get<{ collection: RawEvent[] }>(`${API}/scheduled_events?${qs}`);

  const items: AgendaItem[] = collection.map((ev) => ({
    id: ev.uri.split('/').pop() || ev.uri,
    evento: ev.name,
    inicio: ev.start_time,
    fin: ev.end_time,
    cancelado: ev.status === 'canceled',
    cancelacion: ev.cancellation
      ? { por: ev.cancellation.canceled_by || 'alguien', motivo: ev.cancellation.reason ?? null }
      : null,
    joinUrl: joinUrlDe(ev),
    invitado: null,
  }));

  cache = { at: Date.now(), desde: desdeIso, items };
  return items;
}

/**
 * Nombre, mail y teléfono de los invitados de estos eventos.
 *
 * Se llama con los eventos de UN día (2 a 7), no con los del mes, que es lo
 * que hacía fallar a Calendly. Si uno falla se devuelve sin ese, para no
 * perder los demás.
 */
export async function invitadosDe(ids: string[]): Promise<Record<string, AgendaItem['invitado']>> {
  const salida: Record<string, AgendaItem['invitado']> = {};
  const TANDA = 4;
  for (let i = 0; i < ids.length; i += TANDA) {
    await Promise.all(
      ids.slice(i, i + TANDA).map(async (id) => {
        try {
          const r = await get<{ collection: RawInvitee[] }>(
            `${API}/scheduled_events/${encodeURIComponent(id)}/invitees?count=1`,
          );
          const inv = r.collection?.[0];
          if (inv) {
            salida[id] = {
              nombre: inv.name?.trim() || null,
              email: inv.email?.trim() || null,
              telefono: telefonoDe(inv),
              instagram: instagramDe(inv),
            };
          }
        } catch {
          // Sin los datos de esa persona igual se muestra el horario.
        }
      }),
    );
  }
  return salida;
}

/**
 * Consultorías de una persona, buscando por su mail. Sin límite de fecha.
 *
 * Es la salida para las ventas que se cerraron hace más de dos semanas: la
 * lista de "pasadas" muestra una ventana corta para no traer cientos de
 * eventos, pero Calendly filtra por invitado del lado del servidor, así que
 * con el mail se llega a cualquiera sin importar cuándo fue la call.
 *
 * Devuelve con los datos del invitado ya cargados: son una o dos, no el
 * problema de volumen que tiene el listado.
 */
export async function buscarPorEmail(email: string): Promise<AgendaItem[]> {
  const org = await organizacion();
  const qs = new URLSearchParams({
    organization: org,
    invitee_email: email.trim().toLowerCase(),
    sort: 'start_time:desc',
    count: '10',
  });
  const { collection } = await get<{ collection: RawEvent[] }>(`${API}/scheduled_events?${qs}`);
  if (collection.length === 0) return [];

  const items: AgendaItem[] = collection.map((ev) => ({
    id: ev.uri.split('/').pop() || ev.uri,
    evento: ev.name,
    inicio: ev.start_time,
    fin: ev.end_time,
    cancelado: ev.status === 'canceled',
    cancelacion: ev.cancellation
      ? { por: ev.cancellation.canceled_by || 'alguien', motivo: ev.cancellation.reason ?? null }
      : null,
    joinUrl: joinUrlDe(ev),
    invitado: null,
  }));

  const invitados = await invitadosDe(items.map((i) => i.id));
  return items.map((i) => ({ ...i, invitado: invitados[i.id] ?? null }));
}

export function calendlyConfigurada(): boolean {
  return !!process.env.CALENDLY_TOKEN;
}
