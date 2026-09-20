import { NextResponse, type NextRequest } from 'next/server';
import { format, subDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications';
import { requireCron } from '@/lib/cron';
import { logger } from '@/lib/logger';

/**
 * Weekly retrospective trigger. Runs via Vercel Cron at 23:00 UTC Sunday
 * (20:00 -3) so the athlete sees a ritual prompt before closing the week.
 *
 * We don't precompute the summary here — /weekly derives everything from
 * daily_tasks at render time. This endpoint's job is just to notify.
 *
 * Al final, además, limpia las notificaciones viejas (ver
 * `limpiarNotificacionesViejas`). Va colgado de este cron y no de uno propio
 * porque el plan gratuito de Vercel deja muy pocos crons, y una vez por semana
 * alcanza de sobra para una limpieza.
 *
 * `?dry=1` sirve para invocarlo a mano sin consecuencias: NO manda el aviso a
 * los alumnos y NO borra nada; devuelve a cuántos les avisaría y cuántas
 * notificaciones borraría.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

type ClienteAdmin = ReturnType<typeof createAdminSupabaseClient>;

const MS_POR_DIA = 86_400_000;
/** Una notificación ya leída no le sirve a nadie después de tres meses. */
const DIAS_LEIDAS = 90;
/**
 * Las no leídas se guardan el doble: borrarle a alguien algo que todavía no
 * vio es más delicado. A los seis meses ya no es un aviso, es basura.
 */
const DIAS_NO_LEIDAS = 180;
/** Filas por tanda: un delete corto por vez en lugar de uno gigante. */
const TANDA = 1000;
/**
 * La función muere a los 60s (`maxDuration`). La limpieza deja de pedir tandas
 * pasado este punto, contado desde que ENTRÓ el request (los avisos a los
 * alumnos corren antes y también gastan tiempo). Lo que quede se borra el
 * domingo siguiente: acá no hay apuro, y cortar prolijo es mejor que un timeout.
 */
const PRESUPUESTO_MS = 40_000;

interface ResultadoRegla {
  borradas: number;
  /** false si se cortó por tiempo o por un error: queda resto para la próxima. */
  completa: boolean;
  error?: string;
}

interface ResultadoLimpieza {
  leidas: number;
  no_leidas: number;
  completa: boolean;
  error?: string;
}

/**
 * Borra (o cuenta, en dry) las notificaciones de UNA regla, de a tandas.
 *
 * PostgREST no tiene "delete ... limit", y juntar 1000 ids para un
 * `.in('id', ...)` arma una URL de ~37 KB que el gateway rechaza. Entonces
 * cada tanda se delimita por fecha: se leen las 1000 más viejas que cumplen la
 * regla, se toma el `created_at` de la última y se borra todo lo que cumple la
 * regla hasta esa fecha inclusive. Si varias filas comparten ese instante
 * (los avisos masivos se insertan de a 500 con el mismo `created_at`) la tanda
 * se pasa un poco de 1000; no importa, todas cumplen la regla.
 *
 * El `created_at` se reusa tal cual vino, como texto: trae microsegundos y un
 * Date de JS los redondea a milisegundos, con lo que el borrado podía dejar
 * afuera justo la fila del corte.
 */
async function limpiarRegla(
  admin: ClienteAdmin,
  regla: { soloLeidas: boolean; antesDe: string },
  opciones: { dry: boolean; limite: number },
): Promise<ResultadoRegla> {
  // Los errores se DEVUELVEN en vez de tirarse: si falla la tercera tanda, lo
  // que borraron las dos primeras igual tiene que quedar contado en el log.
  //
  // La regla se escribe igual en el select que mide la tanda y en el delete,
  // para que filtren EXACTAMENTE lo mismo:
  //   leídas:    leido = true
  //   no leídas: NOT (leido IS TRUE)  → incluye false y null (la columna no es
  //              NOT NULL); un `.eq('leido', false)` dejaría las null para siempre.
  if (opciones.dry) {
    const base = admin.from('notifications').select('id', { count: 'exact', head: true });
    const filtrada = regla.soloLeidas ? base.eq('leido', true) : base.not('leido', 'is', true);
    const { count, error } = await filtrada.lt('created_at', regla.antesDe);
    if (error) return { borradas: 0, completa: false, error: error.message };
    return { borradas: count ?? 0, completa: true };
  }

  let borradas = 0;
  while (Date.now() < opciones.limite) {
    const lectura = admin.from('notifications').select('created_at');
    const lecturaFiltrada = regla.soloLeidas
      ? lectura.eq('leido', true)
      : lectura.not('leido', 'is', true);
    const { data, error } = await lecturaFiltrada
      .lt('created_at', regla.antesDe)
      .order('created_at', { ascending: true })
      .limit(TANDA);
    if (error) return { borradas, completa: false, error: error.message };

    const filas = (data as { created_at: string }[] | null) || [];
    if (filas.length === 0) return { borradas, completa: true };
    const hasta = filas[filas.length - 1].created_at;

    const borrado = admin.from('notifications').delete({ count: 'exact' });
    const borradoFiltrado = regla.soloLeidas
      ? borrado.eq('leido', true)
      : borrado.not('leido', 'is', true);
    // El `.lt(antesDe)` se repite aunque `hasta` ya sea anterior: es el seguro
    // de que este delete jamás pueda tocar una notificación reciente.
    const { count, error: errorBorrado } = await borradoFiltrado
      .lt('created_at', regla.antesDe)
      .lte('created_at', hasta);
    if (errorBorrado) return { borradas, completa: false, error: errorBorrado.message };

    // Si había filas y no se borró ninguna, algo no cierra: cortar antes que
    // quedarse girando hasta el timeout.
    if (!count) return { borradas, completa: false, error: 'la tanda no borró ninguna fila' };
    borradas += count;

    if (filas.length < TANDA) return { borradas, completa: true };
  }
  return { borradas, completa: false };
}

/**
 * Limpieza de `notifications`. La tabla solo crecía: cada aviso masivo suma
 * una fila por alumno y nunca se borraba nada (7.795 filas al 19/9), y la
 * campanita solo muestra las últimas 20.
 *
 * Nunca tira: si la limpieza falla, el cron igual tiene que responder 200,
 * porque los avisos de la semana ya salieron y un 500 invita a reintentarlo (y
 * a mandarlos dos veces).
 */
async function limpiarNotificacionesViejas(
  admin: ClienteAdmin,
  opciones: { dry: boolean; limite: number },
): Promise<ResultadoLimpieza> {
  const ahora = Date.now();
  const resultado: ResultadoLimpieza = { leidas: 0, no_leidas: 0, completa: true };
  try {
    const leidas = await limpiarRegla(
      admin,
      { soloLeidas: true, antesDe: new Date(ahora - DIAS_LEIDAS * MS_POR_DIA).toISOString() },
      opciones,
    );
    resultado.leidas = leidas.borradas;

    const noLeidas = await limpiarRegla(
      admin,
      { soloLeidas: false, antesDe: new Date(ahora - DIAS_NO_LEIDAS * MS_POR_DIA).toISOString() },
      opciones,
    );
    resultado.no_leidas = noLeidas.borradas;

    resultado.completa = leidas.completa && noLeidas.completa;
    const error = leidas.error || noLeidas.error;
    if (error) resultado.error = error;
  } catch (err) {
    // Red caída, cliente mal armado, etc.: lo que no vuelve como `error` de
    // Supabase sino como excepción.
    resultado.completa = false;
    resultado.error = err instanceof Error ? err.message : String(err);
  }
  if (resultado.error) {
    logger.error('cron.weekly-insight.limpieza.failed', { ...resultado });
  }
  return resultado;
}

interface UserRow {
  id: string;
  nombre: string;
}
interface TaskFechaRow {
  user_id: string;
  fecha: string;
  entreno_check: boolean | null;
  puntaje: number | null;
}

export async function GET(request: NextRequest) {
  const denied = requireCron(request);
  if (denied) return denied;

  // Se mide desde acá para que avisos + limpieza entren juntos en maxDuration.
  const inicio = Date.now();
  const dry = request.nextUrl.searchParams.get('dry') === '1';

  const admin = createAdminSupabaseClient();
  const today = new Date();
  const floor = format(subDays(today, 7), 'yyyy-MM-dd');

  const [usersRes, tasksRes] = await Promise.all([
    admin.from('users').select('id, nombre').eq('rol', 'alumno'),
    admin
      .from('daily_tasks')
      .select('user_id, fecha, entreno_check, puntaje')
      .gte('fecha', floor),
  ]);

  const users = (usersRes.data as UserRow[] | null) || [];
  const tasks = (tasksRes.data as TaskFechaRow[] | null) || [];

  const summary = new Map<
    string,
    { trained: number; puntajes: number[]; lastFecha: string | null }
  >();
  for (const t of tasks) {
    const prev = summary.get(t.user_id) || {
      trained: 0,
      puntajes: [],
      lastFecha: null,
    };
    if (t.entreno_check) prev.trained++;
    if (t.puntaje != null) prev.puntajes.push(t.puntaje);
    if (!prev.lastFecha || t.fecha > prev.lastFecha) prev.lastFecha = t.fecha;
    summary.set(t.user_id, prev);
  }

  // Only notify users with at least 1 journal entry in the last 7 days —
  // inactive accounts shouldn't get weekly pings.
  const toNotify = users.filter((u) => summary.get(u.id));

  // En dry no se le manda nada a nadie: el dry existe para poder probar la
  // limpieza a mano, y un push de "Ritual del domingo" un martes a todos los
  // alumnos activos sería un costo absurdo para una prueba.
  const destinatarios = dry ? [] : toNotify;

  const results = await Promise.allSettled(
    destinatarios.map(async (u) => {
      const s = summary.get(u.id)!;
      const avg =
        s.puntajes.length > 0
          ? s.puntajes.reduce((a, b) => a + b, 0) / s.puntajes.length
          : null;
      const parts: string[] = [];
      parts.push(`${s.trained} entrenos esta semana`);
      if (avg != null) parts.push(`promedio ${avg.toFixed(1)}/10`);

      const daysSince = s.lastFecha
        ? differenceInCalendarDays(today, parseISO(s.lastFecha))
        : null;

      const body =
        daysSince != null && daysSince >= 3
          ? `${parts.join(' · ')}. Revisa tu semana y fija el foco de la proxima.`
          : `${parts.join(' · ')}. Abri el ritual del domingo.`;

      await createNotification(
        u.id,
        'system',
        'Tu semana — Ritual del domingo',
        body,
        '/weekly'
      );
    })
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - succeeded;

  // Al final y no al principio: primero lo que el alumno espera (su aviso), y
  // con el tiempo que sobre, el mantenimiento.
  const limpieza = await limpiarNotificacionesViejas(admin, {
    dry,
    limite: inicio + PRESUPUESTO_MS,
  });

  logger.info('cron.weekly-insight.done', {
    dry,
    total_users: users.length,
    active: toNotify.length,
    succeeded,
    failed,
    // En dry son las que SE BORRARÍAN; en una corrida real, las borradas.
    limpieza_leidas: limpieza.leidas,
    limpieza_no_leidas: limpieza.no_leidas,
    limpieza_completa: limpieza.completa,
  });

  return NextResponse.json({
    as_of: format(today, 'yyyy-MM-dd'),
    dry,
    notified: toNotify.length,
    succeeded,
    failed,
    limpieza,
  });
}
