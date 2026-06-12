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

  // Filtro "Script ... load failed" — Safari iOS tira esto como
  // unhandledrejection cuando intenta bajar el Service Worker (/sw.js) o
  // cualquier <script> y la conexión se corta a mitad. No es bug, es red
  // transitoria. Mismo razonamiento que el filtro de "Load failed" del
  // error-boundary, pero acá llega por promise rejection en lugar de
  // boundary de React.
  if (event === 'window.unhandledrejection' && /^Script .* load failed$/i.test(message)) {
    return;
  }

  const signature = `${event}|${message}`;
  if (reported.has(signature) || reported.size >= MAX_REPORTS_PER_SESSION) return;
  reported.add(signature);

  // Extra: cualquier campo del meta que no sea `err` (digest del React
  // boundary, userId, etc.). Lo serializamos como string y lo metemos al
  // final del stack — así llega a Supabase sin necesidad de migrar tabla.
  let extras = '';
  try {
    if (meta) {
      const { err: _omit, ...rest } = meta;
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
