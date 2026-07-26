/**
 * Fecha "de hoy" para toda la app.
 *
 * El servidor corre en UTC (Vercel) pero los alumnos son de Argentina. Había
 * TRES criterios distintos conviviendo:
 *   - dashboard-stats recibía `?today=` del cliente
 *   - leaderboard usaba `new Date()` en UTC
 *   - el cron de recordatorios usaba UTC y no tiene cliente a quien preguntarle
 *
 * De ahí salían dos bugs concretos: el recordatorio nocturno le llegaba a TODOS
 * (el cron corre 00:00 UTC = 21:00 ART, cuando el código ya cree que es mañana,
 * así que la lista de "quién ya cargó el diario" salía vacía) y la racha
 * aparecía en 0 en el Ranking entre las 21:00 y las 23:59.
 *
 * El servidor calcula la fecha, siempre. No se confía en un `today` del
 * cliente: es inconsistente entre pantallas y además falsificable (un alumno
 * podría inflar su racha mandando otra fecha).
 *
 * Implementado con Intl para no sumar dependencias: el locale 'en-CA' formatea
 * las fechas como YYYY-MM-DD, que es justo la clave que usan daily_tasks y
 * journal_entries.
 */

export const APP_TZ = 'America/Argentina/Buenos_Aires';

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Fecha de hoy en Argentina, formato 'YYYY-MM-DD'. */
export function todayInAppTz(): string {
  return dateKeyFormatter.format(new Date());
}

/** Convierte cualquier fecha a su clave 'YYYY-MM-DD' en hora argentina. */
export function dateKeyInAppTz(d: Date | string | number): string {
  return dateKeyFormatter.format(new Date(d));
}

/**
 * Clave de hace N días (0 = hoy). Se calcula desde el mediodía de hoy en ART
 * para que el corrimiento de un día no caiga en un cambio de horario.
 */
export function dateKeyDaysAgo(n: number): string {
  const base = new Date();
  base.setUTCHours(15, 0, 0, 0); // ~mediodía en ART, lejos de cualquier borde
  base.setUTCDate(base.getUTCDate() - n);
  return dateKeyInAppTz(base);
}
