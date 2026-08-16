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
 */
export async function agendaCalendly(desdeIso: string, limite = 50): Promise<AgendaItem[]> {
  if (cache && cache.desde === desdeIso && Date.now() - cache.at < CACHE_TTL_MS) return cache.items;

  const org = await organizacion();
  const qs = new URLSearchParams({
    organization: org,
    min_start_time: desdeIso,
    sort: 'start_time:asc',
    count: String(Math.min(limite, 100)),
  });
  const { collection } = await get<{ collection: RawEvent[] }>(`${API}/scheduled_events?${qs}`);

  // Los datos del invitado vienen en otra llamada, una por evento. Van en
  // paralelo, pero de a tandas: 50 requests simultáneos a Calendly devuelven
  // 429 y perdemos toda la lista por querer ir más rápido.
  const items: AgendaItem[] = [];
  const TANDA = 5;
  for (let i = 0; i < collection.length; i += TANDA) {
    const tanda = collection.slice(i, i + TANDA);
    const conInvitado = await Promise.all(
      tanda.map(async (ev) => {
        let invitado: AgendaItem['invitado'] = null;
        try {
          const r = await get<{ collection: RawInvitee[] }>(`${ev.uri}/invitees?count=1`);
          const inv = r.collection?.[0];
          if (inv) {
            invitado = {
              nombre: inv.name?.trim() || null,
              email: inv.email?.trim() || null,
              telefono: telefonoDe(inv),
            };
          }
        } catch {
          // Si falla el invitado igual mostramos el horario: media agenda es
          // mucho mejor que un panel en blanco.
        }
        return {
          id: ev.uri.split('/').pop() || ev.uri,
          evento: ev.name,
          inicio: ev.start_time,
          fin: ev.end_time,
          cancelado: ev.status === 'canceled',
          cancelacion: ev.cancellation
            ? { por: ev.cancellation.canceled_by || 'alguien', motivo: ev.cancellation.reason ?? null }
            : null,
          joinUrl: joinUrlDe(ev),
          invitado,
        } satisfies AgendaItem;
      }),
    );
    items.push(...conInvitado);
  }

  cache = { at: Date.now(), desde: desdeIso, items };
  return items;
}

export function calendlyConfigurada(): boolean {
  return !!process.env.CALENDLY_TOKEN;
}
