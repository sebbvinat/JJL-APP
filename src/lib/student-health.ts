/**
 * student-health — calcula alertas de engagement por alumno.
 *
 * Comparte la lógica con el cálculo legacy en /api/admin/engagement
 * (que vive en EngagementPanel.tsx) pero como helper reusable que la
 * home admin (Fase B) y el perfil del alumno (Fase A) pueden consumir.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type AlertSeverity = 'critical' | 'warn' | 'info';
export type AlertKind =
  | 'no_journal_7d'
  | 'no_journal_14d'
  | 'streak_break'
  | 'low_score'
  | 'inactive'
  | 'no_video_30d'
  | 'ready_1on1';

export type StudentAlert = {
  kind: AlertKind;
  severity: AlertSeverity;
  label: string;
  detail?: string;
};

export type StudentHealthSnapshot = {
  userId: string;
  lastJournalAt: string | null;
  lastVideoUploadAt: string | null;
  lastActivityAt: string | null;
  daysSinceJournal: number | null;
  daysSinceActivity: number | null;
  daysSinceVideo: number | null;
  avgScore7d: number | null;
  trainedDays7d: number;
  streak: number;
  alerts: StudentAlert[];
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/**
 * Devuelve snapshot completo para UN alumno.
 * Hace queries livianas paralelas. No persiste — calcular on-demand.
 */
export async function computeStudentHealth(
  admin: SupabaseClient,
  userId: string,
  opts: { isEligibleFor1on1?: boolean } = {},
): Promise<StudentHealthSnapshot> {
  // daily_tasks últimos 30 días
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const [dtRes, vRes, prRes] = await Promise.all([
    admin
      .from('daily_tasks')
      .select('fecha, puntaje, entreno_check')
      .eq('user_id', userId)
      .gte('fecha', since30)
      .order('fecha', { ascending: false }),
    admin
      .from('video_uploads')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1),
    admin
      .from('user_progress')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('completado', true)
      .order('completed_at', { ascending: false })
      .limit(1),
  ]);

  type DT = { fecha: string; puntaje: number | null; entreno_check: boolean | null };
  const dts: DT[] = ((dtRes.data as DT[] | null) || []);
  const lastJournalAt = dts[0]?.fecha || null;
  const lastVideoUploadAt = ((vRes.data as { created_at: string }[] | null) || [])[0]?.created_at || null;
  const lastProgressAt = ((prRes.data as { completed_at: string }[] | null) || [])[0]?.completed_at || null;

  // Última actividad = max(journal, video upload, progress)
  const candidates = [lastJournalAt, lastVideoUploadAt, lastProgressAt].filter((x): x is string => !!x);
  const lastActivityAt = candidates.length
    ? candidates.sort((a, b) => b.localeCompare(a))[0]
    : null;

  // Últimos 7 días: avg puntaje y días entrenados
  const dts7 = dts.filter((d) => d.fecha >= since7);
  const scored = dts7.filter((d) => typeof d.puntaje === 'number' && d.puntaje !== null);
  const avgScore7d = scored.length > 0
    ? Math.round((scored.reduce((s, d) => s + (d.puntaje as number), 0) / scored.length) * 10) / 10
    : null;
  const trainedDays7d = dts7.filter((d) => d.entreno_check).length;

  // Streak desde hoy hacia atrás
  let streak = 0;
  const trainedSet = new Set(dts.filter((d) => d.entreno_check).map((d) => d.fecha));
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    if (trainedSet.has(iso)) streak++;
    else if (i > 0) break; // hoy puede no estar entrenado todavía sin romper streak
  }

  const daysSinceJournal = daysSince(lastJournalAt);
  const daysSinceActivity = daysSince(lastActivityAt);
  const daysSinceVideo = daysSince(lastVideoUploadAt);

  const alerts: StudentAlert[] = [];

  if (daysSinceJournal !== null && daysSinceJournal >= 14) {
    alerts.push({ kind: 'no_journal_14d', severity: 'critical', label: `${daysSinceJournal}d sin diario` });
  } else if (daysSinceJournal !== null && daysSinceJournal >= 7) {
    alerts.push({ kind: 'no_journal_7d', severity: 'warn', label: `${daysSinceJournal}d sin diario` });
  }

  if (daysSinceActivity !== null && daysSinceActivity >= 7) {
    alerts.push({ kind: 'inactive', severity: daysSinceActivity >= 14 ? 'critical' : 'warn', label: `Sin actividad ${daysSinceActivity}d` });
  }

  if (avgScore7d !== null && avgScore7d < 5 && dts7.length >= 3) {
    alerts.push({ kind: 'low_score', severity: 'warn', label: `Puntaje bajo (${avgScore7d})` });
  }

  if (streak === 0 && daysSinceJournal !== null && daysSinceJournal >= 3) {
    alerts.push({ kind: 'streak_break', severity: 'info', label: 'Racha cortada' });
  }

  if (daysSinceVideo === null || daysSinceVideo >= 30) {
    alerts.push({ kind: 'no_video_30d', severity: 'info', label: daysSinceVideo === null ? 'Sin videos aún' : `${daysSinceVideo}d sin subir video` });
  }

  if (opts.isEligibleFor1on1) {
    alerts.push({ kind: 'ready_1on1', severity: 'info', label: 'Listo para 1-on-1' });
  }

  return {
    userId,
    lastJournalAt,
    lastVideoUploadAt,
    lastActivityAt,
    daysSinceJournal,
    daysSinceActivity,
    daysSinceVideo,
    avgScore7d,
    trainedDays7d,
    streak,
    alerts,
  };
}

export const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warn: 1, info: 2 };
