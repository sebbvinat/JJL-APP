/**
 * CRM helpers — verdad única para "mes / progreso / elegibilidad / timeline".
 *
 * El programa tiene 7 bloques de mes (Fundamentos + Mes 1..6). Cada mes
 * corresponde a un rango de `semana_numero` (campo en course_data).
 *
 * IMPORTANTE: course_data se duplica por alumno y el module_id NO siempre
 * coincide con la semana (drift histórico — ver memoria
 * project_jjl-app-course-content). Por eso aquí derivamos TODO desde
 * course_data del alumno + user_access + user_progress, sin asumir
 * `mod-N = semana N`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type MonthBlock = { mes: number; label: string; semanas: number[] };

export const MONTH_RANGES: MonthBlock[] = [
  { mes: 0, label: 'Fundamentos', semanas: [0] },
  { mes: 1, label: 'Mes 1', semanas: [1, 2, 3, 4] },
  { mes: 2, label: 'Mes 2', semanas: [5, 6, 7, 8] },
  { mes: 3, label: 'Mes 3', semanas: [9, 10, 11, 12] },
  { mes: 4, label: 'Mes 4', semanas: [13, 14, 15, 16] },
  { mes: 5, label: 'Mes 5', semanas: [17, 18, 19, 20] },
  { mes: 6, label: 'Mes 6', semanas: [21, 22, 23, 24] },
];

export function mesFromSemana(n: number | null | undefined): number {
  const sem = typeof n === 'number' ? n : 0;
  for (const b of MONTH_RANGES) if (b.semanas.includes(sem)) return b.mes;
  return 0;
}

export function monthBlock(mes: number): MonthBlock | undefined {
  return MONTH_RANGES.find((b) => b.mes === mes);
}

// ---------------------------------------------------------------------------
// computeMonthProgress
// ---------------------------------------------------------------------------

export type MonthProgress = {
  mes: number;
  label: string;
  semanas: number[];
  moduleIds: string[];
  unlockedModuleIds: string[];
  totalLessons: number;
  completedLessons: number;
  percent: number;
  allUnlocked: boolean;
};

export type MonthSummary = {
  months: MonthProgress[];
  currentMes: number | null;       // mayor mes con allUnlocked=true
  nextMes: number | null;          // currentMes + 1 (null si terminó Mes 6)
  currentMesPercent: number;       // 0-100
  isEligibleFor1on1: boolean;      // currentMesPercent >= 80 AND nextMes != null
  lastActivityAt: string | null;   // ISO timestamp
};

type CourseRow = { module_id: string; semana_numero: number; lessons: unknown };
type AccessRow = { module_id: string; is_unlocked: boolean };
type ProgressRow = { lesson_id: string; completed_at: string | null };

const ELIGIBILITY_PCT = 80;

export async function computeMonthProgress(
  admin: SupabaseClient,
  userId: string,
): Promise<MonthSummary> {
  // 1. course_data del alumno
  const { data: courseRows } = await admin
    .from('course_data')
    .select('module_id, semana_numero, lessons')
    .eq('user_id', userId);
  const course: CourseRow[] = (courseRows || []) as CourseRow[];

  // 2. user_access (qué módulos están desbloqueados)
  const { data: accessRows } = await admin
    .from('user_access')
    .select('module_id, is_unlocked')
    .eq('user_id', userId);
  const access: AccessRow[] = (accessRows || []) as AccessRow[];
  const unlockedSet = new Set(access.filter((a) => a.is_unlocked).map((a) => a.module_id));

  // 3. user_progress (lecciones completadas)
  const { data: progressRows } = await admin
    .from('user_progress')
    .select('lesson_id, completed_at')
    .eq('user_id', userId)
    .eq('completado', true);
  const progress: ProgressRow[] = (progressRows || []) as ProgressRow[];
  const completedLessonSet = new Set(progress.map((p) => p.lesson_id));

  // 4. Agrupar módulos del alumno por mes (derivado de semana_numero)
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

  // 5. Computar progreso por mes
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

  // 6. Mes actual = mayor mes con allUnlocked=true (y que tenga módulos)
  let currentMes: number | null = null;
  for (let i = months.length - 1; i >= 0; i--) {
    if (months[i].allUnlocked && months[i].moduleIds.length > 0) {
      currentMes = months[i].mes;
      break;
    }
  }

  // 7. Mes siguiente = primer mes después del actual que tenga módulos pero NO esté desbloqueado
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

  // 8. Última actividad = max(completed_at en user_progress, created_at en daily_tasks)
  let lastActivityAt: string | null = null;
  for (const p of progress) {
    if (p.completed_at && (!lastActivityAt || p.completed_at > lastActivityAt)) {
      lastActivityAt = p.completed_at;
    }
  }
  try {
    const { data: dt } = await admin
      .from('daily_tasks')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    const lastDT = (dt as { created_at: string }[] | null)?.[0]?.created_at;
    if (lastDT && (!lastActivityAt || lastDT > lastActivityAt)) lastActivityAt = lastDT;
  } catch { /* silencioso */ }

  return { months, currentMes, nextMes, currentMesPercent, isEligibleFor1on1, lastActivityAt };
}

// ---------------------------------------------------------------------------
// computeStudentTimeline
// ---------------------------------------------------------------------------

export type TimelineItem = {
  id: string;
  type:
    | 'lesson_completed'
    | 'video_uploaded'
    | 'video_reviewed'
    | 'journal_entry'
    | 'daily_task'
    | 'message_in'
    | 'message_out'
    | 'support_in'
    | 'support_out'
    | 'event_rsvp'
    | 'competition'
    | 'llamada'
    | 'unlock'
    | 'admin_note'
    | 'notif';
  at: string;             // ISO timestamp
  titulo: string;         // texto principal
  detalle?: string;       // texto secundario
  meta?: Record<string, unknown>;
};

/**
 * Union de las tablas relevantes para el alumno. Cada llamada hace ~10
 * queries livianas en paralelo. No es streaming — devuelve hasta `limit`
 * items totales ordenados por at DESC.
 */
export async function computeStudentTimeline(
  admin: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<TimelineItem[]> {
  const items: TimelineItem[] = [];
  const HALF = Math.max(10, Math.floor(limit * 1.5)); // pull more per source, dedupe later

  // Pulls paralelas
  const [
    progressRes,
    videosRes,
    journalRes,
    dailyRes,
    messagesRes,
    supportRes,
    rsvpRes,
    compRes,
    llamadasRes,
    accessRes,
    notesRes,
    notifsRes,
  ] = await Promise.all([
    admin.from('user_progress').select('lesson_id, completed_at').eq('user_id', userId).eq('completado', true).order('completed_at', { ascending: false }).limit(HALF),
    admin.from('video_uploads').select('id, titulo, status, created_at, feedback_at, feedback_texto, reviewed_by').eq('user_id', userId).order('created_at', { ascending: false }).limit(HALF),
    safeQuery(admin, 'journal_entries', `id, kind, text, fecha, created_at`, userId, 'created_at', HALF),
    admin.from('daily_tasks').select('id, fecha, puntaje, objetivo, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(HALF),
    admin.from('messages').select('id, from_user_id, to_user_id, contenido, created_at').or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`).order('created_at', { ascending: false }).limit(HALF),
    safeQuery(admin, 'support_messages', `id, sender, contenido, created_at`, userId, 'created_at', HALF, 'user_id'),
    admin.from('event_rsvps').select('id, event_id, status, created_at, events(titulo)').eq('user_id', userId).order('created_at', { ascending: false }).limit(HALF),
    safeQuery(admin, 'competitions', `id, nombre, fecha, resultado, created_at, updated_at`, userId, 'updated_at', HALF),
    safeQuery(admin, 'llamadas', `id, tipo, scheduled_at, completed_at, status, notes, created_at, updated_at`, userId, 'updated_at', HALF),
    admin.from('user_access').select('module_id, is_unlocked, unlocked_at').eq('user_id', userId).eq('is_unlocked', true).not('unlocked_at', 'is', null).order('unlocked_at', { ascending: false }).limit(HALF),
    safeQuery(admin, 'admin_notes', `id, texto, pinned, created_at, updated_at`, userId, 'created_at', HALF),
    admin.from('notifications').select('id, tipo, titulo, mensaje, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(HALF),
  ]);

  // Lessons completadas
  for (const p of (progressRes.data as { lesson_id: string; completed_at: string | null }[] | null) || []) {
    if (!p.completed_at) continue;
    items.push({ id: `lc-${p.lesson_id}`, type: 'lesson_completed', at: p.completed_at, titulo: 'Lección completada', detalle: p.lesson_id });
  }

  // Videos: upload + review separados
  for (const v of (videosRes.data as { id: string; titulo: string; status: string; created_at: string; feedback_at: string | null; feedback_texto: string | null }[] | null) || []) {
    items.push({ id: `vu-${v.id}`, type: 'video_uploaded', at: v.created_at, titulo: 'Subió video', detalle: v.titulo });
    if (v.feedback_at) {
      items.push({ id: `vr-${v.id}`, type: 'video_reviewed', at: v.feedback_at, titulo: `Video revisado (${v.status})`, detalle: v.feedback_texto || undefined });
    }
  }

  // Journal entries
  for (const j of (journalRes as { id: string; kind?: string; text?: string; created_at: string }[] | null) || []) {
    items.push({ id: `je-${j.id}`, type: 'journal_entry', at: j.created_at, titulo: `Diario · ${j.kind || 'nota'}`, detalle: j.text?.slice(0, 140) });
  }

  // Daily tasks
  for (const d of (dailyRes.data as { id: string; fecha: string; puntaje: number | null; objetivo: string | null; created_at: string }[] | null) || []) {
    items.push({ id: `dt-${d.id}`, type: 'daily_task', at: d.created_at, titulo: `Entrenamiento · puntaje ${d.puntaje ?? '—'}`, detalle: d.objetivo || undefined, meta: { fecha: d.fecha } });
  }

  // Messages (chat instructor)
  for (const m of (messagesRes.data as { id: string; from_user_id: string; contenido: string; created_at: string }[] | null) || []) {
    const isOut = m.from_user_id === userId;
    items.push({ id: `msg-${m.id}`, type: isOut ? 'message_out' : 'message_in', at: m.created_at, titulo: isOut ? 'Mensaje del alumno (Chat)' : 'Mensaje al alumno (Chat)', detalle: m.contenido.slice(0, 140) });
  }

  // Support
  for (const s of (supportRes as { id: string; sender: 'user' | 'admin'; contenido: string; created_at: string }[] | null) || []) {
    const isOut = s.sender === 'user';
    items.push({ id: `sup-${s.id}`, type: isOut ? 'support_in' : 'support_out', at: s.created_at, titulo: isOut ? 'Escribió a Soporte' : 'Soporte respondió', detalle: s.contenido.slice(0, 140) });
  }

  // RSVPs
  for (const r of (rsvpRes.data as { id: string; event_id: string; status: string; created_at: string; events: { titulo: string } | { titulo: string }[] | null }[] | null) || []) {
    const ev = Array.isArray(r.events) ? r.events[0] : r.events;
    items.push({ id: `rsvp-${r.id}`, type: 'event_rsvp', at: r.created_at, titulo: `RSVP ${r.status}`, detalle: ev?.titulo });
  }

  // Competitions (usar updated_at como "última actividad")
  for (const c of (compRes as { id: string; nombre: string; fecha: string; resultado: string | null; updated_at: string }[] | null) || []) {
    items.push({ id: `comp-${c.id}`, type: 'competition', at: c.updated_at, titulo: `Competencia · ${c.nombre}`, detalle: c.resultado || `Fecha ${c.fecha}` });
  }

  // Llamadas
  for (const l of (llamadasRes as { id: string; tipo: string; scheduled_at: string | null; completed_at: string | null; status: string; notes: string | null; updated_at: string }[] | null) || []) {
    items.push({ id: `ll-${l.id}`, type: 'llamada', at: l.completed_at || l.scheduled_at || l.updated_at, titulo: `Llamada ${l.tipo} · ${l.status}`, detalle: l.notes?.slice(0, 140) });
  }

  // Unlocks
  for (const a of (accessRes.data as { module_id: string; unlocked_at: string }[] | null) || []) {
    items.push({ id: `ul-${a.module_id}-${a.unlocked_at}`, type: 'unlock', at: a.unlocked_at, titulo: 'Módulo desbloqueado', detalle: a.module_id });
  }

  // Admin notes
  for (const n of (notesRes as { id: string; texto: string; pinned: boolean; created_at: string }[] | null) || []) {
    items.push({ id: `n-${n.id}`, type: 'admin_note', at: n.created_at, titulo: n.pinned ? '📌 Nota interna' : 'Nota interna', detalle: n.texto.slice(0, 140) });
  }

  // Notifs (que recibió)
  for (const x of (notifsRes.data as { id: string; tipo: string; titulo: string; mensaje: string; created_at: string }[] | null) || []) {
    items.push({ id: `nf-${x.id}`, type: 'notif', at: x.created_at, titulo: `Notif · ${x.titulo}`, detalle: x.mensaje });
  }

  items.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return items.slice(0, limit);
}

// ---------------------------------------------------------------------------
// computeLastContactAt
// ---------------------------------------------------------------------------

/**
 * MAX(timestamp) sobre canales admin↔alumno: messages, support_messages,
 * llamadas (completed_at o scheduled_at), admin_notes.
 * Si no hay nada → null.
 */
export async function computeLastContactAt(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const dates: string[] = [];

  const { data: msg } = await admin
    .from('messages')
    .select('created_at')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(1);
  if ((msg as { created_at: string }[] | null)?.[0]?.created_at) dates.push(msg![0].created_at);

  const sup = await safeMaxQuery(admin, 'support_messages', 'created_at', 'user_id', userId);
  if (sup) dates.push(sup);

  const ll = await safeMaxQuery(admin, 'llamadas', 'updated_at', 'user_id', userId);
  if (ll) dates.push(ll);

  const nt = await safeMaxQuery(admin, 'admin_notes', 'updated_at', 'user_id', userId);
  if (nt) dates.push(nt);

  if (dates.length === 0) return null;
  dates.sort((a, b) => b.localeCompare(a));
  return dates[0];
}

// ---------------------------------------------------------------------------
// helpers internos
// ---------------------------------------------------------------------------

/** Query con catch — si la tabla no existe (pre-migración) devuelve null silenciosamente. */
async function safeQuery(
  admin: SupabaseClient,
  table: string,
  cols: string,
  userId: string,
  orderCol: string,
  lim: number,
  userIdCol: string = 'user_id',
): Promise<unknown[] | null> {
  try {
    const r = await admin.from(table).select(cols).eq(userIdCol, userId).order(orderCol, { ascending: false }).limit(lim);
    if (r.error) return null;
    return r.data as unknown[] | null;
  } catch { return null; }
}

async function safeMaxQuery(
  admin: SupabaseClient,
  table: string,
  col: string,
  userIdCol: string,
  userId: string,
): Promise<string | null> {
  try {
    const r = await admin.from(table).select(col).eq(userIdCol, userId).order(col, { ascending: false }).limit(1);
    if (r.error) return null;
    const row = (r.data as unknown as Record<string, string>[] | null)?.[0];
    return (row?.[col] as string | undefined) ?? null;
  } catch { return null; }
}
