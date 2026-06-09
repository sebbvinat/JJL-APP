/**
 * Cómputo BULK de enrich data para la lista de alumnos del admin.
 *
 * Reemplaza el patrón N+1 anterior (Promise.all sobre baseStudents.map →
 * cada uno disparaba ~11 queries internas en computeMonthProgress +
 * computeLastContactAt + computeStudentHealth).
 *
 * Acá hacemos ~9 queries CONSTANTES en paralelo, traemos los datos para
 * TODOS los userIds de una y después computamos en memoria por alumno.
 *
 * Para 15 alumnos pasamos de 165 queries a 9 — y la mejora es lineal:
 * con 100 alumnos serían 1100 vs 9.
 *
 * La interfaz de salida es la misma que daban las 3 funciones combinadas
 * en /api/admin/students (month / lastContactAt / health), así que el
 * endpoint no necesita cambiar su shape de response.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { MONTH_RANGES, mesFromSemana, type MonthProgress, type MonthSummary } from './crm';
import { SEVERITY_RANK, type StudentHealthSnapshot, type StudentAlert } from './student-health';

export type StudentEnrichment = {
  month: MonthSummary;
  lastContactAt: string | null;
  health: StudentHealthSnapshot;
};

const ELIGIBILITY_PCT = 80;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/**
 * Computa los 3 enrichments en BULK para los `userIds` pasados.
 * Devuelve un Map<userId, StudentEnrichment>.
 *
 * Cualquier tabla que no exista (pre-migración) se trata como vacía
 * silenciosamente — igual que las funciones originales.
 */
export async function computeStudentsEnrichmentBulk(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, StudentEnrichment>> {
  if (userIds.length === 0) return new Map();

  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const orFilter = userIds
    .map((id) => `from_user_id.eq.${id},to_user_id.eq.${id}`)
    .join(',');

  // Todas las queries de un saque. .in('user_id', userIds) hace el push-down
  // de filtro a Postgres así que el payload es justo lo necesario.
  const [
    courseRes,
    accessRes,
    progressRes,
    dailyRes,
    videoRes,
    messagesRes,
    supportRes,
    llamadasRes,
    notesRes,
  ] = await Promise.all([
    admin
      .from('course_data')
      .select('user_id, module_id, semana_numero, lessons')
      .in('user_id', userIds),
    admin
      .from('user_access')
      .select('user_id, module_id, is_unlocked')
      .in('user_id', userIds),
    admin
      .from('user_progress')
      .select('user_id, lesson_id, completed_at')
      .eq('completado', true)
      .in('user_id', userIds),
    admin
      .from('daily_tasks')
      .select('user_id, fecha, puntaje, entreno_check, created_at')
      .in('user_id', userIds)
      .gte('fecha', since30),
    admin
      .from('video_uploads')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false }),
    admin
      .from('messages')
      .select('from_user_id, to_user_id, created_at')
      .or(orFilter),
    safeBulkQuery(admin, 'support_messages', 'user_id, created_at', userIds),
    safeBulkQuery(admin, 'llamadas', 'user_id, updated_at', userIds),
    safeBulkQuery(admin, 'admin_notes', 'user_id, updated_at', userIds),
  ]);

  // Index por user_id para cada tabla.
  type CourseRow = { user_id: string; module_id: string; semana_numero: number; lessons: unknown };
  type AccessRow = { user_id: string; module_id: string; is_unlocked: boolean };
  type ProgressRow = { user_id: string; lesson_id: string; completed_at: string | null };
  type DailyRow = { user_id: string; fecha: string; puntaje: number | null; entreno_check: boolean | null; created_at: string };
  type VideoRow = { user_id: string; created_at: string };
  type MsgRow = { from_user_id: string; to_user_id: string; created_at: string };

  const courseByUser = groupBy((courseRes.data as CourseRow[] | null) || [], (r) => r.user_id);
  const accessByUser = groupBy((accessRes.data as AccessRow[] | null) || [], (r) => r.user_id);
  const progressByUser = groupBy((progressRes.data as ProgressRow[] | null) || [], (r) => r.user_id);
  const dailyByUser = groupBy((dailyRes.data as DailyRow[] | null) || [], (r) => r.user_id);
  const videosByUser = groupBy((videoRes.data as VideoRow[] | null) || [], (r) => r.user_id);

  // Messages: pasan a maxDate por user.
  const lastMsgByUser = new Map<string, string>();
  for (const m of (messagesRes.data as MsgRow[] | null) || []) {
    for (const uid of [m.from_user_id, m.to_user_id]) {
      if (!userIds.includes(uid)) continue;
      const cur = lastMsgByUser.get(uid);
      if (!cur || m.created_at > cur) lastMsgByUser.set(uid, m.created_at);
    }
  }

  const lastSupportByUser = maxByUser(supportRes, 'created_at');
  const lastLlamadaByUser = maxByUser(llamadasRes, 'updated_at');
  const lastNoteByUser = maxByUser(notesRes, 'updated_at');

  // Compute por usuario.
  const out = new Map<string, StudentEnrichment>();
  for (const userId of userIds) {
    const course = courseByUser.get(userId) || [];
    const access = accessByUser.get(userId) || [];
    const progress = progressByUser.get(userId) || [];
    const dailyAll = dailyByUser.get(userId) || [];
    const videos = videosByUser.get(userId) || [];

    out.set(userId, {
      month: computeMonthFromBulk(course, access, progress, dailyAll),
      lastContactAt: maxIso(
        lastMsgByUser.get(userId) || null,
        lastSupportByUser.get(userId) || null,
        lastLlamadaByUser.get(userId) || null,
        lastNoteByUser.get(userId) || null,
      ),
      health: computeHealthFromBulk(userId, dailyAll, videos, progress, /* isElig */ false),
    });
  }

  // Patch isEligibleFor1on1 → afecta el alert "ready_1on1" del health.
  for (const [uid, e] of out) {
    if (e.month.isEligibleFor1on1 && !e.health.alerts.some((a) => a.kind === 'ready_1on1')) {
      e.health.alerts.push({ kind: 'ready_1on1', severity: 'info', label: 'Listo para 1-on-1' });
    }
    e.health.alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Compute por usuario a partir de bulks ya separados.
// La lógica es idéntica a computeMonthProgress / computeStudentHealth
// originales — solo cambia el origen de los datos (memoria, no DB).
// ---------------------------------------------------------------------------

function computeMonthFromBulk(
  course: Array<{ module_id: string; semana_numero: number; lessons: unknown }>,
  access: Array<{ module_id: string; is_unlocked: boolean }>,
  progress: Array<{ lesson_id: string; completed_at: string | null }>,
  dailyAll: Array<{ fecha: string; created_at: string }>,
): MonthSummary {
  const unlockedSet = new Set(access.filter((a) => a.is_unlocked).map((a) => a.module_id));
  const completedLessonSet = new Set(progress.map((p) => p.lesson_id));

  type ModuleData = { module_id: string; lessonIds: string[]; isUnlocked: boolean; semana: number };
  const modulesByMes = new Map<number, ModuleData[]>();
  for (const row of course) {
    const mes = mesFromSemana(row.semana_numero);
    const lessons = Array.isArray(row.lessons) ? row.lessons : [];
    const lessonIds = lessons
      .filter((l) => l && typeof l === 'object' && (l as { tipo?: string }).tipo !== 'reflection')
      .map((l) => (l as { id?: string }).id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const mod: ModuleData = {
      module_id: row.module_id,
      lessonIds,
      isUnlocked: unlockedSet.has(row.module_id),
      semana: row.semana_numero,
    };
    if (!modulesByMes.has(mes)) modulesByMes.set(mes, []);
    modulesByMes.get(mes)!.push(mod);
  }

  const months: MonthProgress[] = MONTH_RANGES.map((b) => {
    const mods = modulesByMes.get(b.mes) || [];
    const moduleIds = mods.map((m) => m.module_id);
    const unlockedModuleIds = mods.filter((m) => m.isUnlocked).map((m) => m.module_id);
    const allLessonIds = mods.flatMap((m) => m.lessonIds);
    const totalLessons = allLessonIds.length;
    const completedLessons = allLessonIds.filter((id) => completedLessonSet.has(id)).length;
    const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    const allUnlocked = mods.length > 0 && mods.every((m) => m.isUnlocked);
    return {
      mes: b.mes,
      label: b.label,
      semanas: b.semanas,
      moduleIds,
      unlockedModuleIds,
      totalLessons,
      completedLessons,
      percent,
      allUnlocked,
    };
  });

  let currentMes: number | null = null;
  for (let i = months.length - 1; i >= 0; i--) {
    if (months[i].allUnlocked && months[i].moduleIds.length > 0) {
      currentMes = months[i].mes;
      break;
    }
  }

  let nextMes: number | null = null;
  if (currentMes !== null) {
    for (let i = currentMes + 1; i < months.length; i++) {
      if (months[i].moduleIds.length > 0 && !months[i].allUnlocked) {
        nextMes = months[i].mes;
        break;
      }
    }
  }

  const currentMesPercent = currentMes !== null ? months[currentMes].percent : 0;
  const isEligibleFor1on1 =
    currentMes !== null && nextMes !== null && currentMesPercent >= ELIGIBILITY_PCT;

  // Última actividad: max(progress.completed_at, dailyAll.created_at)
  let lastActivityAt: string | null = null;
  for (const p of progress) {
    if (p.completed_at && (!lastActivityAt || p.completed_at > lastActivityAt)) {
      lastActivityAt = p.completed_at;
    }
  }
  for (const d of dailyAll) {
    if (d.created_at && (!lastActivityAt || d.created_at > lastActivityAt)) {
      lastActivityAt = d.created_at;
    }
  }

  return { months, currentMes, nextMes, currentMesPercent, isEligibleFor1on1, lastActivityAt };
}

function computeHealthFromBulk(
  userId: string,
  dailyAll: Array<{ fecha: string; puntaje: number | null; entreno_check: boolean | null; created_at: string }>,
  videos: Array<{ created_at: string }>,
  progress: Array<{ completed_at: string | null }>,
  isElig: boolean,
): StudentHealthSnapshot {
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  // dailyAll ya viene filtrado a 30d desde el bulk; ordenarlos por fecha DESC.
  const dts = [...dailyAll].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const lastJournalAt = dts[0]?.fecha || null;
  const lastVideoUploadAt = videos[0]?.created_at || null;
  const lastProgressAt = [...progress]
    .filter((p) => p.completed_at)
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))[0]?.completed_at || null;

  const candidates = [lastJournalAt, lastVideoUploadAt, lastProgressAt].filter((x): x is string => !!x);
  const lastActivityAt = candidates.length
    ? candidates.sort((a, b) => b.localeCompare(a))[0]
    : null;

  const dts7 = dts.filter((d) => d.fecha >= since7);
  const scored = dts7.filter((d) => typeof d.puntaje === 'number' && d.puntaje !== null);
  const avgScore7d = scored.length > 0
    ? Math.round((scored.reduce((s, d) => s + (d.puntaje as number), 0) / scored.length) * 10) / 10
    : null;
  const trainedDays7d = dts7.filter((d) => d.entreno_check).length;

  let streak = 0;
  const trainedSet = new Set(dts.filter((d) => d.entreno_check).map((d) => d.fecha));
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    if (trainedSet.has(iso)) streak++;
    else if (i > 0) break;
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

  if (isElig) {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupBy<T>(rows: T[], keyOf: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyOf(r);
    const list = m.get(k) || [];
    list.push(r);
    m.set(k, list);
  }
  return m;
}

function maxIso(...isos: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const x of isos) {
    if (x && (!best || x > best)) best = x;
  }
  return best;
}

/**
 * Query bulk con catch — si la tabla no existe (pre-migración) devuelve {data:null}
 * silenciosamente. La firma simula la respuesta de Supabase para no romper
 * los reads en el caller.
 */
async function safeBulkQuery(
  admin: SupabaseClient,
  table: string,
  cols: string,
  userIds: string[],
): Promise<{ data: Array<Record<string, string>> | null }> {
  try {
    const r = await admin.from(table).select(cols).in('user_id', userIds);
    if (r.error) return { data: null };
    // Supabase tipa data como GenericStringError[] cuando no infiere shape —
    // pasamos por unknown para forzar el cast al shape real que sabemos
    // viene de la base.
    return { data: r.data as unknown as Array<Record<string, string>> | null };
  } catch { return { data: null }; }
}

/** Max(col) por user_id en un bulk de filas. */
function maxByUser(
  res: { data: Array<Record<string, string>> | null },
  col: string,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const row of res.data || []) {
    const uid = row.user_id;
    const v = row[col];
    if (!uid || !v) continue;
    const cur = m.get(uid);
    if (!cur || v > cur) m.set(uid, v);
  }
  return m;
}
