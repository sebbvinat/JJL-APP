import { NextResponse, type NextRequest } from 'next/server';
import { format, subDays } from 'date-fns';
import { getAuthedUser } from '@/lib/supabase/server';
import { calculateGamification } from '@/lib/gamification';
import { logger } from '@/lib/logger';
import { todayInAppTz } from '@/lib/dates';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ProfileRow {
  /** NULL = el alumno todavia no eligio su cinturon. */
  cinturon_confirmado_at?: string | null;
  cinturon_actual: string;
  puntos: number;
  nombre: string;
  rol: string;
  created_at: string;
  onboarding_completed_at: string | null;
}
interface CourseRow {
  module_id: string;
  semana_numero: number;
  lessons: Array<{ id: string; tipo?: string }>;
}

async function fetchCore(supabase: SupabaseClient, userId: string, today: string) {
  const [profileRes, trainingRes, todayRes, unlockedRes, progressRes, courseRes, redoRes] =
    await Promise.all([
      supabase
        .from('users')
        .select('cinturon_actual, puntos, nombre, rol, created_at, onboarding_completed_at, cinturon_confirmado_at')
        .eq('id', userId)
        .single<ProfileRow>(),
      supabase
        .from('daily_tasks')
        .select('fecha')
        .eq('user_id', userId)
        .eq('entreno_check', true)
        .order('fecha', { ascending: false }),
      supabase
        .from('daily_tasks')
        .select('entreno_check, feedback_texto')
        .eq('user_id', userId)
        .eq('fecha', today)
        .maybeSingle<{ entreno_check: boolean; feedback_texto: string | null }>(),
      supabase
        .from('user_access')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_unlocked', true),
      supabase
        .from('user_progress')
        .select('lesson_id')
        .eq('user_id', userId)
        .eq('completado', true),
      supabase
        .from('course_data')
        .select('module_id, semana_numero, lessons')
        .eq('user_id', userId),
      // Videos que el instructor pidió rehacer. La push notification se
      // pierde si el alumno no la ve en el momento — este count alimenta
      // un banner PERSISTENTE en el dashboard hasta que re-suba.
      supabase
        .from('video_uploads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'para_rehacer'),
    ]);

  return {
    profile: profileRes.data,
    trainingDays: (trainingRes.data as Array<{ fecha: string }> | null) || [],
    todayTask: todayRes.data,
    unlockedModules: unlockedRes.count ?? 0,
    completedLessonIds: ((progressRes.data as Array<{ lesson_id: string }> | null) || []).map(
      (r) => r.lesson_id
    ),
    userCourseData: (courseRes.data as CourseRow[] | null) || [],
    videosParaRehacer: redoRes.count ?? 0,
  };
}

/**
 * Fallback when user has no course_data yet: compute week completion from
 * the global modules/lessons tables.
 */
async function fallbackWeekCompletion(
  supabase: SupabaseClient,
  completedLessonIds: Set<string>
): Promise<number[]> {
  const [modulesRes, lessonsRes] = await Promise.all([
    supabase.from('modules').select('id, semana_numero'),
    supabase.from('lessons').select('id, module_id'),
  ]);
  const allModules = (modulesRes.data as Array<{ id: string; semana_numero: number }> | null) || [];
  const allLessons = (lessonsRes.data as Array<{ id: string; module_id: string }> | null) || [];
  if (allModules.length === 0 || allLessons.length === 0) return [];

  const byModule = new Map<string, string[]>();
  for (const l of allLessons) {
    const list = byModule.get(l.module_id) || [];
    list.push(l.id);
    byModule.set(l.module_id, list);
  }
  const weeks: number[] = [];
  for (const m of allModules) {
    const ids = byModule.get(m.id) || [];
    if (ids.length > 0 && ids.every((id) => completedLessonIds.has(id))) {
      weeks.push(m.semana_numero);
    }
  }
  return weeks;
}

// Ancla la racha en el "hoy" de Argentina, calculado en el SERVER (ver
// lib/dates). Antes llegaba por ?today= desde el cliente: funcionaba, pero
// era el único de los tres lugares que calculan fecha que lo hacía así
// (el cron no tiene cliente a quien preguntarle, y el leaderboard usaba UTC),
// y además un alumno podía mandar otra fecha para inflar su racha.
function computeStreak(trainedDates: string[], todayStr: string): number {
  const set = new Set(trainedDates);
  // Mediodía para esquivar saltos de DST al restar días.
  const base = new Date(`${todayStr}T12:00:00`);
  const anchor = Number.isNaN(base.getTime()) ? new Date() : base;
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const date = format(subDays(anchor, i), 'yyyy-MM-dd');
    if (set.has(date)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

/**
 * Persist belt/points if calculated values advanced beyond what's stored.
 * Fire-and-forget notification on belt advancement.
 */
/**
 * Guarda los puntos cuando suben.
 *
 * Antes esta funcion tambien subia el cinturon segun el progreso (semana 4 →
 * azul, 8 → purpura...) y pisaba lo que el alumno o el admin hubieran puesto.
 * Se saco: el cinturon es un grado que se da en el tatami, no algo que se
 * gane completando videos, asi que ahora lo declara el alumno. Los puntos si
 * son de la app y siguen calculandose.
 */
async function maybeAdvancePoints(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfileRow,
  gamification: { puntos: number },
) {
  if (gamification.puntos <= (profile.puntos || 0)) return;
  const { error } = await supabase
    .from('users')
    .update({ puntos: gamification.puntos })
    .eq('id', userId);
  if (error) logger.error('dashboard.puntos.update.failed', { userId, err: error });
}

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // El server calcula la fecha en hora argentina. Ya no se confía en un
  // ?today= del cliente (inconsistente entre pantallas y falsificable).
  const today = todayInAppTz();

  const {
    profile,
    trainingDays,
    todayTask,
    unlockedModules,
    completedLessonIds,
    userCourseData,
    videosParaRehacer,
  } = await fetchCore(supabase, user.id, today);

  const completedSet = new Set(completedLessonIds);

  // Completed weeks + per-week totals
  let totalLessonsAvailable = 0;
  let completedWeeksCount = 0;
  let totalWeeks = 0;
  const completedWeekNumbers: number[] = [];
  // IDs de lecciones de VIDEO del programa. Sirve para que el numerador use la
  // MISMA definición que el denominador: antes el numerador contaba todas las
  // filas de user_progress (incluidas las 24 reflexiones) y el denominador
  // solo los videos, así que un alumno que terminaba el programa veía
  // "158/134 lecciones · 118%" y la barra se desbordaba del contenedor.
  const videoLessonIds = new Set<string>();

  if (userCourseData.length > 0) {
    for (const row of userCourseData) {
      const lessons = Array.isArray(row.lessons) ? row.lessons : [];
      // Solo lecciones de VIDEO cuentan para el progreso y para "semana
      // completa" — misma definición que usa el admin (crm.ts), la lista
      // de módulos del alumno y el perfil del alumno en el panel. Antes
      // este endpoint incluía las reflexiones, y como la reflexión no se
      // persistía nunca, NINGUNA semana podía marcarse completa: semanas
      // en 0, cinturones que no avanzaban y % de progreso desinflado.
      const videoLessons = lessons.filter((l) => l.tipo !== 'reflection');
      totalLessonsAvailable += videoLessons.length;
      totalWeeks++;
      videoLessons.forEach((l) => videoLessonIds.add(l.id));
      const completedInWeek = videoLessons.filter((l) => completedSet.has(l.id)).length;
      if (videoLessons.length > 0 && completedInWeek === videoLessons.length) {
        completedWeekNumbers.push(row.semana_numero);
        completedWeeksCount++;
      }
    }
  } else {
    const weeks = await fallbackWeekCompletion(supabase, completedSet);
    completedWeekNumbers.push(...weeks);
  }

  // Numerador alineado al denominador (solo videos). Si no tenemos el curso
  // cargado no podemos filtrar, así que caemos al conteo crudo — pero ahí
  // tampoco hay denominador, así que no puede dar >100%.
  const actualLessonsCompleted =
    videoLessonIds.size > 0
      ? completedLessonIds.filter((id) => videoLessonIds.has(id)).length
      : completedLessonIds.length;

  const trainedDates = trainingDays.map((t) => t.fecha);
  const streak = computeStreak(trainedDates, today);

  const gamification = calculateGamification({
    completedWeeks: completedWeekNumbers,
    totalTrainingDays: trainedDates.length,
    totalLessonsCompleted: actualLessonsCompleted,
  });

  // El cinturon es el que declaro el alumno, sin mezclarlo con el progreso.
  const isAdmin = profile?.rol === 'admin';
  const effectiveBelt = isAdmin ? 'black' : (profile?.cinturon_actual || 'white');
  const effectivePuntos = Math.max(profile?.puntos || 0, gamification.puntos);

  if (profile && !isAdmin) {
    await maybeAdvancePoints(supabase, user.id, profile, gamification);
  }

  const overallProgress =
    totalLessonsAvailable > 0
      ? Math.round((actualLessonsCompleted / totalLessonsAvailable) * 100)
      : 0;

  return NextResponse.json(
    {
      profile: {
        ...(profile || { nombre: 'Usuario' }),
        cinturon_actual: effectiveBelt,
        puntos: effectivePuntos,
        rol: profile?.rol || 'alumno',
      },
      trainedDays: trainedDates,
      todayChecked: todayTask?.entreno_check ?? false,
      lessonsCompleted: actualLessonsCompleted,
      totalLessonsAvailable,
      unlockedModules,
      completedLessonIds,
      completedWeekNumbers,
      completedWeeksCount,
      totalWeeks,
      overallProgress,
      streak,
      totalTrainingDays: trainedDates.length,
      videosParaRehacer,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    }
  );
}
