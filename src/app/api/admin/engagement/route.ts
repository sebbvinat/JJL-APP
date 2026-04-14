import { NextRequest, NextResponse } from 'next/server';
import { format, subDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { requireAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/engagement
 *
 * Returns per-student metrics for the coach dashboard. Nothing fancy — we
 * read the last 30 days of daily_tasks in a single query and fold it into
 * the shape the admin UI needs. Alerts are derived server-side so the UI
 * can just render them.
 */

export const dynamic = 'force-dynamic';

type AlertKind =
  | 'no_journal_7d'
  | 'fatiga_rojo_streak'
  | 'objetivo_fails'
  | 'puntaje_bajo'
  | 'sin_reflexion';

type AlertSeverity = 'info' | 'warn' | 'critical';

interface Alert {
  kind: AlertKind;
  severity: AlertSeverity;
  detail: string;
}

interface TaskRow {
  user_id: string;
  fecha: string;
  entreno_check: boolean | null;
  fatiga: string | null;
  puntaje: number | null;
  objetivo: string | null;
  objetivo_cumplido: boolean | null;
  aprendizajes: string | null;
}

interface UserRow {
  id: string;
  nombre: string;
  email: string | null;
  avatar_url: string | null;
  cinturon_actual: string;
  rol: string;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { admin } = ctx;

    const today = new Date();
    const from = format(subDays(today, 30), 'yyyy-MM-dd');

    const [usersRes, tasksRes] = await Promise.all([
      admin
        .from('users')
        .select('id, nombre, email, avatar_url, cinturon_actual, rol')
        .eq('rol', 'alumno')
        .order('nombre', { ascending: true }),
      admin
        .from('daily_tasks')
        .select(
          'user_id, fecha, entreno_check, fatiga, puntaje, objetivo, objetivo_cumplido, aprendizajes'
        )
        .gte('fecha', from)
        .order('fecha', { ascending: false }),
    ]);

    const users = (usersRes.data as UserRow[] | null) || [];
    const tasks = (tasksRes.data as TaskRow[] | null) || [];

    const byUser = new Map<string, TaskRow[]>();
    for (const t of tasks) {
      const list = byUser.get(t.user_id) || [];
      list.push(t);
      byUser.set(t.user_id, list);
    }

    const rows = users.map((u) => {
      const userTasks = byUser.get(u.id) || [];

      const last7 = userTasks.filter((t) => {
        const d = differenceInCalendarDays(today, parseISO(t.fecha));
        return d >= 0 && d < 7;
      });
      const last30 = userTasks; // already bounded by the query

      const trained7 = last7.filter((t) => t.entreno_check).length;
      const trained30 = last30.filter((t) => t.entreno_check).length;

      const avg7 = avg(
        last7.filter((t) => t.puntaje != null).map((t) => t.puntaje as number)
      );
      const avg30 = avg(
        last30.filter((t) => t.puntaje != null).map((t) => t.puntaje as number)
      );

      const lastTask = userTasks[0];
      const lastJournalDate = lastTask?.fecha ?? null;
      const daysSinceLastJournal = lastJournalDate
        ? differenceInCalendarDays(today, parseISO(lastJournalDate))
        : null;

      // Rojo streak — fatiga='rojo' on consecutive calendar days counting
      // back from today (gaps don't count as continuation, they break it).
      let rojoStreak = 0;
      for (let i = 0; i < 14; i++) {
        const fecha = format(subDays(today, i), 'yyyy-MM-dd');
        const row = userTasks.find((t) => t.fecha === fecha);
        if (row?.fatiga === 'rojo') {
          rojoStreak++;
        } else if (i > 0 && row) {
          break;
        } else if (i > 0 && !row) {
          // no entry that day → doesn't count toward streak nor reset it
          break;
        }
      }

      const objetivoFails7 = last7.filter((t) => t.objetivo_cumplido === false).length;
      const trainedButNoReflection7 = last7.filter(
        (t) => t.entreno_check && !t.aprendizajes
      ).length;

      const alerts: Alert[] = [];

      if (daysSinceLastJournal != null && daysSinceLastJournal >= 7) {
        alerts.push({
          kind: 'no_journal_7d',
          severity: daysSinceLastJournal >= 14 ? 'critical' : 'warn',
          detail: `${daysSinceLastJournal} dias sin registrar`,
        });
      }

      if (rojoStreak >= 3) {
        alerts.push({
          kind: 'fatiga_rojo_streak',
          severity: rojoStreak >= 5 ? 'critical' : 'warn',
          detail: `${rojoStreak} dias seguidos de fatiga alta`,
        });
      }

      if (objetivoFails7 >= 3) {
        alerts.push({
          kind: 'objetivo_fails',
          severity: 'warn',
          detail: `${objetivoFails7} objetivos incumplidos en 7 dias`,
        });
      }

      if (avg7 != null && avg7 < 5 && last7.length >= 3) {
        alerts.push({
          kind: 'puntaje_bajo',
          severity: 'warn',
          detail: `Promedio 7d: ${avg7.toFixed(1)}/10`,
        });
      }

      if (trainedButNoReflection7 >= 3) {
        alerts.push({
          kind: 'sin_reflexion',
          severity: 'info',
          detail: `${trainedButNoReflection7} entrenos sin reflexion`,
        });
      }

      const severityRank: Record<AlertSeverity, number> = {
        critical: 3,
        warn: 2,
        info: 1,
      };
      const topSeverity = alerts.reduce(
        (max, a) => Math.max(max, severityRank[a.severity]),
        0
      );

      return {
        userId: u.id,
        nombre: u.nombre,
        email: u.email,
        avatarUrl: u.avatar_url,
        belt: u.cinturon_actual,
        trained7,
        trained30,
        avg7,
        avg30,
        lastJournalDate,
        daysSinceLastJournal,
        rojoStreak,
        objetivoFails7,
        alerts,
        topSeverity,
        currentObjetivo: last7.find((t) => t.objetivo)?.objetivo || null,
      };
    });

    // Order: highest severity first, then most days since last journal.
    rows.sort((a, b) => {
      if (b.topSeverity !== a.topSeverity) return b.topSeverity - a.topSeverity;
      return (b.daysSinceLastJournal ?? 0) - (a.daysSinceLastJournal ?? 0);
    });

    return NextResponse.json({ students: rows, as_of: format(today, 'yyyy-MM-dd') });
  } catch (err) {
    logger.error('admin.engagement.failed', { err });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
