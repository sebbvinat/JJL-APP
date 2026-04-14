import { NextResponse, type NextRequest } from 'next/server';
import { format, subDays } from 'date-fns';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/notifications';
import { requireCron } from '@/lib/cron';
import { logger } from '@/lib/logger';

/**
 * Daily journal reminder. Runs via Vercel Cron at 00:00 UTC (21:00 -3).
 *
 * Notifies every student who:
 *   - hasn't journaled today (no daily_tasks row for today's fecha), and
 *   - has journaled at least once in the last 14 days (we don't spam brand
 *     new accounts or people who explicitly stopped using the app).
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
}

export async function GET(request: NextRequest) {
  const denied = requireCron(request);
  if (denied) return denied;

  const admin = createAdminSupabaseClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const floor = format(subDays(new Date(), 14), 'yyyy-MM-dd');

  const [usersRes, tasksRes] = await Promise.all([
    admin.from('users').select('id, nombre').eq('rol', 'alumno'),
    admin
      .from('daily_tasks')
      .select('user_id, fecha')
      .gte('fecha', floor),
  ]);

  const users = (usersRes.data as UserRow[] | null) || [];
  const tasks = (tasksRes.data as TaskFechaRow[] | null) || [];

  const journaledToday = new Set<string>();
  const recentlyActive = new Set<string>();
  for (const t of tasks) {
    if (t.fecha === today) journaledToday.add(t.user_id);
    recentlyActive.add(t.user_id);
  }

  const toNotify = users.filter(
    (u) => !journaledToday.has(u.id) && recentlyActive.has(u.id)
  );

  const results = await Promise.allSettled(
    toNotify.map((u) =>
      sendPushToUser(
        u.id,
        'Tu diario te espera',
        'Registra tu entrenamiento de hoy antes de cerrar el dia.',
        '/journal'
      )
    )
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - succeeded;

  logger.info('cron.daily-reminder.done', {
    total_users: users.length,
    recently_active: recentlyActive.size,
    journaled_today: journaledToday.size,
    notified: toNotify.length,
    succeeded,
    failed,
  });

  return NextResponse.json({
    as_of: today,
    notified: toNotify.length,
    succeeded,
    failed,
  });
}
