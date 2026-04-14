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
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

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

  const results = await Promise.allSettled(
    toNotify.map(async (u) => {
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

  logger.info('cron.weekly-insight.done', {
    total_users: users.length,
    active: toNotify.length,
    succeeded,
    failed,
  });

  return NextResponse.json({
    as_of: format(today, 'yyyy-MM-dd'),
    notified: toNotify.length,
    succeeded,
    failed,
  });
}
