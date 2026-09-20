/**
 * Minimal structured logger. Meant as a single seam that we can later swap
 * for a real service (Sentry, Axiom, Logflare) without touching callsites.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.error('push.subscribe.failed', { userId, err });
 *   logger.warn('upload.rejected', { reason: 'size', bytes });
 *   logger.info('auth.login', { userId });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Meta = Record<string, unknown> | undefined;

const isDev = process.env.NODE_ENV !== 'production';

// ── Errores de red y ruido del celular ────────────────────────────────────
// Por qué vive acá y no en un archivo propio: el logger es quien decide qué es
// "ruido", y el error boundary, el push y el check-in necesitan la MISMA
// definición de "error de red". Con una sola lista no pasa que una pantalla
// trate "Load failed" como red y otra lo reporte como bug.
//
// Cada navegador le pone otro nombre a lo mismo (se cortó la conexión, la app
// pasó a segundo plano, el celular cambió de wifi a datos):
//   Safari iOS → "Load failed" / "The network connection was lost"
//   Chrome     → "Failed to fetch"
//   Firefox    → "NetworkError when attempting to fetch resource"
//   RN/WebView → "Network request failed"
// Incluye "Script https://…/sw.js load failed" (Safari, cuando se corta la
// bajada del service worker), que antes tenía un filtro propio.
const PATRONES_DE_RED: RegExp[] = [
  /load failed/i,
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /the network connection was lost/i,
];

// Ruido que NO es de red pero tampoco es un bug nuestro ni algo accionable:
//   - "Failed to update a ServiceWorker": el navegador no pudo bajar /sw.js en
//     su chequeo periódico (red mala). Reintenta solo al minuto.
//   - "Java object is gone" / "Java exception was raised": los tira el WebView
//     de Android (navegadores internos tipo Instagram, y el postMessage del
//     reproductor de YouTube ahí adentro) cuando el puente nativo de la app
//     contenedora se destruye. No es código nuestro.
const PATRONES_DE_RUIDO: RegExp[] = [
  /failed to update a serviceworker/i,
  /java object is gone/i,
  /java exception was raised/i,
];

function mensajeDe(err: unknown): string {
  if (err instanceof Error) return err.message || '';
  if (typeof err === 'string') return err;
  return '';
}

/** true si el error es un corte de conexión transitorio, no un bug. */
export function esErrorDeRed(err: unknown): boolean {
  const mensaje = mensajeDe(err);
  return mensaje !== '' && PATRONES_DE_RED.some((p) => p.test(mensaje));
}

function esRuido(mensaje: string): boolean {
  if (!mensaje) return false;
  return (
    PATRONES_DE_RED.some((p) => p.test(mensaje)) ||
    PATRONES_DE_RUIDO.some((p) => p.test(mensaje))
  );
}

/**
 * Corre `operacion` y, si falla por un error de RED, espera y prueba una sola
 * vez más. En el celular la mayoría de los cortes duran menos de un segundo
 * (cambio de antena, la app vuelve de segundo plano): con un reintento el
 * alumno ni se entera. Un solo reintento a propósito: si la red está caída de
 * verdad, insistir solo demora el aviso de "sin conexión".
 *
 * OJO: usar solo con operaciones idempotentes (upserts). Si el primer pedido
 * llegó al servidor y lo que se perdió fue la respuesta, el reintento lo
 * repite.
 *
 * Los errores que no son de red se relanzan sin reintentar: esos sí son bugs
 * y reintentarlos los taparía.
 */
export async function reintentarSiFallaLaRed<T>(
  operacion: () => Promise<T>,
  esperaMs = 1500,
): Promise<T> {
  try {
    return await operacion();
  } catch (err) {
    if (!esErrorDeRed(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, esperaMs));
    return operacion();
  }
}

// ── Reporte de errores del browser al server ──────────────────────────────
// Cada logger.error() en el cliente (producción) se manda también a
// /api/client-errors para quedar registrado en Supabase. Dedupe por firma
// dentro de la sesión + tope duro para que un loop de errores no inunde.
const reported = new Set<string>();
const MAX_REPORTS_PER_SESSION = 20;

function reportToServer(event: string, meta?: Meta) {
  if (typeof window === 'undefined' || isDev) return;
  // Nunca reportar fallas del propio reporte (evita recursión).
  if (event.startsWith('client-errors.')) return;

  const err = meta?.err;
  const message =
    err instanceof Error ? err.message :
    typeof err === 'string' ? err :
    err ? JSON.stringify(err).slice(0, 300) : '';
  const stack = err instanceof Error ? err.stack || '' : '';

  // Filtro "Script error." — cuando un script CROSS-ORIGIN tira un error, el
  // browser oculta el mensaje real por seguridad y nos llega solo
  // "Script error." sin stack. NO podemos hacer nada con eso — es ruido de
  // GA/Calendly/Manychat etc., no es código nuestro. Lo descartamos.
  if (event === 'window.onerror' && message === 'Script error.' && !stack) {
    return;
  }

  // Filtro de ruido — cortes de red del celular, el chequeo del service worker
  // que no pudo bajar /sw.js, y el puente Java del WebView de Android. Llegan
  // por cualquier camino (window.onerror, unhandledrejection, un catch de
  // fetch), por eso se filtra por MENSAJE y no por evento. No son bugs y no
  // hay nada que arreglar: en client_errors solo tapaban los errores reales y
  // gastaban el tope de reportes por sesión. El log en consola se mantiene
  // (lo hace emit() antes de llegar acá), así que para diagnosticar en el
  // dispositivo siguen estando.
  if (esRuido(message)) return;

  const signature = `${event}|${message}`;
  if (reported.has(signature) || reported.size >= MAX_REPORTS_PER_SESSION) return;
  reported.add(signature);

  // Extra: cualquier campo del meta que no sea `err` (digest del React
  // boundary, userId, etc.). Lo serializamos como string y lo metemos al
  // final del stack — así llega a Supabase sin necesidad de migrar tabla.
  let extras = '';
  try {
    if (meta) {
      const rest = Object.fromEntries(Object.entries(meta).filter(([clave]) => clave !== 'err'));
      if (Object.keys(rest).length > 0) extras = '\n\n[meta] ' + JSON.stringify(rest).slice(0, 800);
    }
  } catch {}

  try {
    const body = JSON.stringify({
      event,
      message,
      stack: (stack + extras).slice(0, 5000),
      url: window.location.href,
    });
    // keepalive: sobrevive a navegaciones/cierres de pestaña.
    fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {}
}

function emit(level: LogLevel, event: string, meta?: Meta) {
  const line = {
    level,
    event,
    ts: new Date().toISOString(),
    ...(meta || {}),
  };

  // Serialize errors so they don't collapse to "{}" in JSON.stringify.
  const serialized = JSON.parse(
    JSON.stringify(line, (_key, value) => {
      if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack };
      }
      return value;
    })
  );

  const fn =
    level === 'error' ? console.error :
    level === 'warn' ? console.warn :
    level === 'debug' ? console.debug :
    console.log;

  if (isDev) {
    fn(`[${level}] ${event}`, meta || '');
  } else {
    fn(JSON.stringify(serialized));
  }

  if (level === 'error') reportToServer(event, meta);
}

export const logger = {
  debug: (event: string, meta?: Meta) => emit('debug', event, meta),
  info: (event: string, meta?: Meta) => emit('info', event, meta),
  warn: (event: string, meta?: Meta) => emit('warn', event, meta),
  error: (event: string, meta?: Meta) => emit('error', event, meta),
};
