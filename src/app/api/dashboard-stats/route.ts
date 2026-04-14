import { NextResponse, type NextRequest } from 'next/server';
import { format, subDays } from 'date-fns';
import { getAuthedUser } from '@/lib/supabase/server';
import { calculateGamification } from '@/lib/gamification';
import { BELT_PROGRESSION } from '@/lib/constants';
import { createNotification, BELT_NAMES } from '@/lib/notifications';
import { logger } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ProfileRow {
  cinturon_actual: string;
  puntos: number;
  nombre: string;
  rol: string;
}
interface CourseRow {
  module_id: string;
  semana_numero: number;
  lessons: Array<{ id: string }>;
}

async function fetchCore(supabase: SupabaseClient, userId: string, today: string) {
  const [profileRes, trainingRes, todayRes, unlockedRes, progressRes, courseRes] =
    await Promise.all([
      supabase
        .from('users')
        .select('cinturon_actual, puntos, nombre, rol')
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

function computeStreak(trainedDates: string[]): number {
  const set = new Set(trainedDates);
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
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
async function maybeAdvanceBelt(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfileRow,
  gamification: { newBelt: string; puntos: number },
  profileBeltIdx: number,
  calculatedBeltIdx: number
) {
  const advancedBelt = calculatedBeltIdx > profileBeltIdx;
  const advancedPoints = gamification.puntos > (profile.puntos || 0);
  if (!advancedBelt && !advancedPoints) return;

  const updates: Record<string, unknown> = {};
  if (advancedBelt) updates.cinturon_actual = gamification.newBelt;
  if (advancedPoints) updates.puntos = gamification.puntos;

  const { error } = await supabase.from('users').update(updates).eq('id', userId);
  if (error) {
    logger.error('dashboard.belt.update.failed', { userId, err: error });
    return;
  }

  if (advancedBelt) {
    try {
      const beltName = BELT_NAMES[gamification.newBelt] || gamification.newBelt;
      await createNotification(
        userId,
        'belt',
        `Nuevo cinturon: ${beltName}`,
        `Felicitaciones! Avanzaste al cinturon ${beltName}. Segui entrenando!`
      );
    } catch (err) {
      logger.error('dashboard.belt.notify.failed', { userId, err });
    }
  }
}

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const url = new URL(request.url);
  const today = url.searchParams.get('today') || format(new Date(), 'yyyy-MM-dd');

  const {
    profile,
    trainingDays,
    todayTask,
    unlockedModules,
    completedLessonIds,
    userCourseData,
  } = await fetchCore(supabase, user.id, today);

  const completedSet = new Set(completedLessonIds);
  const actualLessonsCompleted = completedLessonIds.length;

  // Completed weeks + per-week totals
  let totalLessonsAvailable = 0;
  let completedWeeksCount = 0;
  let totalWeeks = 0;
  const completedWeekNumbers: number[] = [];

  if (userCourseData.length > 0) {
    for (const row of userCourseData) {
      const lessons = Array.isArray(row.lessons) ? row.lessons : [];
      totalLessonsAvailable += lessons.length;
      totalWeeks++;
      const completedInWeek = lessons.filter((l) => completedSet.has(l.id)).length;
      if (lessons.length > 0 && completedInWeek === lessons.length) {
        completedWeekNumbers.push(row.semana_numero);
        completedWeeksCount++;
      }
    }
  } else {
    const weeks = await fallbackWeekCompletion(supabase, completedSet);
    completedWeekNumbers.push(...weeks);
  }

  const trainedDates = trainingDays.map((t) => t.fecha);
  const streak = computeStreak(trainedDates);

  const gamification = calculateGamification({
    completedWeeks: completedWeekNumbers,
    totalTrainingDays: trainedDates.length,
    totalLessonsCompleted: actualLessonsCompleted,
  });

  // Belt resolution: max(stored, calculated). Admins always = black.
  const beltOrder = BELT_PROGRESSION.map((b) => b.key);
  const profileBeltIdx = beltOrder.indexOf((profile?.cinturon_actual as typeof beltOrder[number]) || 'white');
  const calculatedBeltIdx = beltOrder.indexOf(gamification.newBelt);
  const isAdmin = profile?.rol === 'admin';
  const effectiveBelt = isAdmin
    ? 'black'
    : beltOrder[Math.max(profileBeltIdx, calculatedBeltIdx)] || gamification.newBelt;
  const effectivePuntos = Math.max(profile?.puntos || 0, gamification.puntos);

  if (profile && !isAdmin) {
    await maybeAdvanceBelt(supabase, user.id, profile, gamification, profileBeltIdx, calculatedBeltIdx);
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
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    }
  );
}
