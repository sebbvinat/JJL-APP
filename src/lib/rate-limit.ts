import { createHash } from 'node:crypto';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Límite de frecuencia para los endpoints públicos del embudo (WP-03).
 *
 * Por qué vive en la base y no en memoria: Vercel es serverless, cada pedido
 * puede caer en un proceso distinto y un `Map` en memoria no ve los pedidos de
 * los otros procesos. El contador es la función SQL `rate_limit_hit` (ver
 * supabase/migrations/2026_09_20_rate_limit.sql), que suma y compara en una
 * sola operación atómica.
 *
 * REGLA DE ORO: todo esto falla ABIERTO. Si la migración no se corrió, si la
 * base tarda, si falta una variable de entorno o si no sabemos la IP, el pedido
 * PASA. Perder un lead real por culpa de la protección es mucho peor que dejar
 * pasar a un abusador de vez en cuando.
 *
 * Solo para el servidor (usa node:crypto y la service role key).
 */

/**
 * Una sola tabla con todos los umbrales, para que ajustar un número no obligue
 * a ir a buscar la ruta. Están pensados para no molestar a gente real detrás de
 * una misma IP (los celulares de una misma operadora suelen compartir IP): el
 * recorrido completo de un lead son 2 POST a `quiz`, 1 a `phone` y ~10 GET a
 * `check`, muy lejos de cualquiera de estos techos.
 */
export const LIMITES = {
  quiz: { limite: 30, ventanaSeg: 600 },
  // `phone` y `near-miss` son los que le mandan WhatsApp al coach: techo bajo.
  phone: { limite: 5, ventanaSeg: 600 },
  'near-miss': { limite: 5, ventanaSeg: 600 },
  'calendly-event': { limite: 30, ventanaSeg: 600 },
  // `check` se consulta en bucle unos 6 segundos después de agendar.
  check: { limite: 60, ventanaSeg: 600 },
  'match-quiz': { limite: 30, ventanaSeg: 600 },
  'track-click': { limite: 60, ventanaSeg: 600 },
  'client-errors': { limite: 20, ventanaSeg: 600 },
} as const;

export type RutaLimitada = keyof typeof LIMITES;

/** Cuánto esperamos a la base antes de rendirnos y dejar pasar. */
const TIMEOUT_MS = 1500;

/**
 * Si la función SQL no existe, no tiene sentido pegarle a la base en cada
 * pedido para que conteste lo mismo. Pausamos unos minutos y volvemos a probar:
 * así, cuando Sebastián corra la migración, el límite arranca solo, sin deploy.
 */
const PAUSA_SIN_FUNCION_MS = 5 * 60 * 1000;
let pausadoHasta = 0;

/** Avisos que se loguean una sola vez por proceso, para no inundar los logs. */
const yaAvisado = new Set<string>();
function avisarUnaVez(evento: string, meta?: Record<string, unknown>) {
  if (yaAvisado.has(evento)) return;
  yaAvisado.add(evento);
  logger.warn(evento, meta);
}

/** Apagable desde Vercel sin deploy: RATE_LIMIT_ENABLED=0. */
function limiteActivo(): boolean {
  return process.env.RATE_LIMIT_ENABLED !== '0';
}

/**
 * IP del que llama. En Vercel `x-forwarded-for` lo escribe la plataforma (el
 * cliente no lo puede falsear) y el primer valor es la IP real.
 */
export function ipDe(request: Request): string | null {
  const reenviada = request.headers.get('x-forwarded-for');
  const primera = reenviada ? reenviada.split(',')[0]?.trim() : '';
  if (primera) return primera;
  const real = request.headers.get('x-real-ip')?.trim();
  return real || null;
}

/**
 * La IP va hasheada en la clave: es un dato personal y para contar no hace
 * falta guardarla en crudo. Mismo criterio que `ip_hash` en link_clicks.
 */
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/** ¿El error dice "esa función/tabla no existe"? (migración sin correr) */
function esFaltaDeMigracion(error: { code?: string; message?: string }): boolean {
  // PGRST202: PostgREST no encuentra la función. 42883: función inexistente.
  // 42P01: tabla inexistente (función creada pero tabla borrada).
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01') return true;
  return /rate_limit_hit|api_rate_limits/i.test(error.message || '') &&
    /not find|does not exist|schema cache/i.test(error.message || '');
}

/**
 * Suma un pedido a `clave` y dice si entra dentro del límite.
 * `true` = dejalo pasar. `false` = se pasó, cortalo.
 *
 * Nunca tira: cualquier problema devuelve `true`.
 */
export async function permitir(
  clave: string,
  limite: number,
  ventanaSeg: number,
): Promise<boolean> {
  if (!limiteActivo()) return true;
  if (Date.now() < pausadoHasta) return true;

  try {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .rpc('rate_limit_hit', {
        p_clave: clave,
        p_limite: limite,
        p_ventana_seg: ventanaSeg,
      })
      // Sin este corte, una base lenta le colgaría el formulario al lead.
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));

    if (error) {
      if (esFaltaDeMigracion(error)) {
        pausadoHasta = Date.now() + PAUSA_SIN_FUNCION_MS;
        avisarUnaVez('rate-limit.sin-tabla', {
          hint: 'Falta correr supabase/migrations/2026_09_20_rate_limit.sql. Mientras tanto no se limita nada.',
        });
      } else {
        avisarUnaVez('rate-limit.error', { err: error });
      }
      return true;
    }

    // La función devuelve boolean. Cualquier otra cosa (null, etc.) = dejar pasar.
    return data !== false;
  } catch (err) {
    avisarUnaVez('rate-limit.error', { err });
    return true;
  }
}

/**
 * Límite por IP para una ruta pública. Es lo primero que llama cada handler,
 * ANTES de validar el body: así los pedidos basura también cuentan y un script
 * no puede martillar gratis con JSON inválido.
 */
export async function permitirRuta(request: Request, ruta: RutaLimitada): Promise<boolean> {
  if (!limiteActivo()) return true;

  const ip = ipDe(request);
  if (!ip) {
    // Sin IP, todos los pedidos caerían en una misma clave y un solo abusador
    // bloquearía a todo el mundo. Preferimos no limitar. En Vercel no pasa.
    avisarUnaVez('rate-limit.sin-ip', { ruta });
    return true;
  }

  const { limite, ventanaSeg } = LIMITES[ruta];
  const ok = await permitir(`${ruta}:${hashIp(ip)}`, limite, ventanaSeg);
  if (!ok) {
    // Este sí se loguea siempre: es la señal de que alguien está abusando (o de
    // que un umbral quedó corto para gente real y hay que subirlo).
    logger.warn('rate-limit.excedido', { ruta, ip_hash: hashIp(ip), limite, ventanaSeg });
  }
  return ok;
}
