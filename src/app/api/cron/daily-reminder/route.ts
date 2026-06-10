import { NextResponse, type NextRequest } from 'next/server';
import { format, subDays } from 'date-fns';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { sendPushToUser, createNotification } from '@/lib/notifications';
import { requireCron } from '@/lib/cron';
import { logger } from '@/lib/logger';

/**
 * Daily journal reminder + re-engagement. Corre via Vercel Cron a las
 * 00:00 UTC (21:00 hora Argentina — buen horario para "todavía estás a
 * tiempo de registrar el día").
 *
 * Hace tres cosas en una pasada:
 *
 * 1. RECORDATORIO DIARIO (histórico): alumno que no journaleó hoy pero
 *    estuvo activo en los últimos 14 días → push genérico.
 *
 * 2. RACHA EN JUEGO (nuevo): si ese alumno además viene con una racha de
 *    entrenamiento de 3+ días, el push se personaliza — "Llevás N días
 *    seguidos, no cortes la racha hoy". La urgencia de perder la racha
 *    convierte mucho más que un recordatorio genérico.
 *
 * 3. WELCOME CALL (nuevo): alumno del programa que se registró hace 2-3
 *    días y todavía no tiene NINGUNA actividad (ni diario ni lecciones)
 *    → notificación in-app + push a los admins (excepto setter) para que
 *    le hagan una llamada de bienvenida antes de que se enfríe. La
 *    ventana de 2-3 días garantiza que se dispare una sola vez.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

interface UserRow {
  id: string;
  nombre: string;
  created_at: string;
  program_member: boolean | null;
}
interface TaskRow {
  user_id: string;
  fecha: string;
  entreno_check: boolean | null;
}

/** Racha de entrenamiento contando hacia atrás desde AYER (hoy todavía no
 *  terminó — no rompe la racha no haber entrenado aún). */
function streakAsOfYesterday(trained: Set<string>, today: string): number {
  const base = new Date(`${today}T12:00:00`);
  let streak = 0;
  for (let i = 1; i <= 14; i++) {
    const d = format(subDays(base, i), 'yyyy-MM-dd');
    if (trained.has(d)) streak++;
    else break;
  }
  return streak;
}

export async function GET(request: NextRequest) {
  const denied = requireCron(request);
  if (denied) return denied;

  const admin = createAdminSupabaseClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const floor = format(subDays(new Date(), 14), 'yyyy-MM-dd');

  const [usersRes, tasksRes] = await Promise.all([
    admin.from('users').select('id, nombre, created_at, program_member').eq('rol', 'alumno'),
    admin
      .from('daily_tasks')
      .select('user_id, fecha, entreno_check')
      .gte('fecha', floor),
  ]);

  const users = (usersRes.data as UserRow[] | null) || [];
  const tasks = (tasksRes.data as TaskRow[] | null) || [];

  const journaledToday = new Set<string>();
  const recentlyActive = new Set<string>();
  const trainedByUser = new Map<string, Set<string>>();
  for (const t of tasks) {
    if (t.fecha === today) journaledToday.add(t.user_id);
    recentlyActive.add(t.user_id);
    if (t.entreno_check) {
      if (!trainedByUser.has(t.user_id)) trainedByUser.set(t.user_id, new Set());
      trainedByUser.get(t.user_id)!.add(t.fecha);
    }
  }

  // ── 1+2. Recordatorio diario, personalizado si hay racha en juego ──
  const toNotify = users.filter(
    (u) => !journaledToday.has(u.id) && recentlyActive.has(u.id)
  );

  let streakSaves = 0;
  const results = await Promise.allSettled(
    toNotify.map((u) => {
      const streak = streakAsOfYesterday(trainedByUser.get(u.id) || new Set(), today);
      if (streak >= 3) {
        streakSaves++;
        return sendPushToUser(
          u.id,
          `🔥 Racha de ${streak} días en juego`,
          `Llevás ${streak} días seguidos entrenando. Registrá el de hoy y no la cortes.`,
          '/journal'
        );
      }
      return sendPushToUser(
        u.id,
        'Tu diario te espera',
        'Registra tu entrenamiento de hoy antes de cerrar el dia.',
        '/journal'
      );
    })
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - succeeded;

  // ── 3. Welcome call: alumno nuevo del programa, 2-3 días sin arrancar ──
  let welcomeAlerts = 0;
  try {
    const now = Date.now();
    const freshCandidates = users.filter((u) => {
      if (u.program_member !== true) return false;
      const ageDays = (now - new Date(u.created_at).getTime()) / 86_400_000;
      // Ventana [2, 3): el cron corre 1 vez al día → dispara exactamente una vez.
      return ageDays >= 2 && ageDays < 3;
    });

    if (freshCandidates.length > 0) {
      const ids = freshCandidates.map((u) => u.id);
      // Sin diario (ya lo sabemos por recentlyActive) y sin lecciones vistas.
      const { data: progressRows } = await admin
        .from('user_progress')
        .select('user_id')
        .in('user_id', ids);
      const hasProgress = new Set(((progressRows as { user_id: string }[] | null) || []).map((r) => r.user_id));

      const cold = freshCandidates.filter(
        (u) => !recentlyActive.has(u.id) && !hasProgress.has(u.id)
      );

      if (cold.length > 0) {
        const { data: adminRows } = await admin
          .from('users')
          .select('id, tags')
          .eq('rol', 'admin');
        const adminIds = ((adminRows as { id: string; tags: string[] | null }[] | null) || [])
          .filter((a) => !(a.tags || []).includes('setter'))
          .map((a) => a.id);

        for (const alumno of cold) {
          for (const adminId of adminIds) {
            try {
              await createNotification(
                adminId,
                'system',
                `${alumno.nombre} todavía no arrancó`,
                `Se registró hace 2 días y no tiene actividad (ni diario ni lecciones). Buen momento para una llamada de bienvenida.`,
                `/admin/${alumno.id}`
              );
              welcomeAlerts++;
            } catch (err) {
              logger.error('cron.daily-reminder.welcome.notify.failed', { err, alumno: alumno.id });
            }
          }
        }
      }
    }
  } catch (err) {
    // Best-effort: si esta parte falla, el recordatorio diario ya salió.
    logger.error('cron.daily-reminder.welcome.failed', { err });
  }

  logger.info('cron.daily-reminder.done', {
    total_users: users.length,
    recently_active: recentlyActive.size,
    journaled_today: journaledToday.size,
    notified: toNotify.length,
    streak_saves: streakSaves,
    welcome_alerts: welcomeAlerts,
    succeeded,
    failed,
  });

  return NextResponse.json({
    as_of: today,
    notified: toNotify.length,
    streak_saves: streakSaves,
    welcome_alerts: welcomeAlerts,
    succeeded,
    failed,
  });
}
