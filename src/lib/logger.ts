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
}

export const logger = {
  debug: (event: string, meta?: Meta) => emit('debug', event, meta),
  info: (event: string, meta?: Meta) => emit('info', event, meta),
  warn: (event: string, meta?: Meta) => emit('warn', event, meta),
  error: (event: string, meta?: Meta) => emit('error', event, meta),
};
