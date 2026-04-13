import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { format, subDays } from 'date-fns';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch profile (belt, points, role)
  const { data: profile } = await supabase
    .from('users')
    .select('cinturon_actual, puntos, nombre, rol')
    .eq('id', user.id)
    .single();

  // Fetch training days (daily_tasks where entreno_check = true)
  const { data: trainingDays } = await supabase
    .from('daily_tasks')
    .select('fecha')
    .eq('user_id', user.id)
    .eq('entreno_check', true)
    .order('fecha', { ascending: false });

  // Use client-provided date to avoid timezone issues
  const url = new URL(request.url);
  const today = url.searchParams.get('today') || format(new Date(), 'yyyy-MM-dd');
  const { data: todayTask } = await supabase
    .from('daily_tasks')
    .select('entreno_check, feedback_texto')
    .eq('user_id', user.id)
    .eq('fecha', today)
    .single();

  // Fetch unlocked modules count
  const { count: unlockedModules } = await supabase
    .from('user_access')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_unlocked', true);

  // Fetch completed lesson IDs (replaces separate count query above)
  const { data: completedLessons } = await supabase
    .from('user_progress')
    .select('lesson_id')
    .eq('user_id', user.id)
    .eq('completado', true);

  const completedLessonIds = (completedLessons || []).map((l: any) => l.lesson_id);
  const actualLessonsCompleted = completedLessonIds.length;

  // Calculate completed weeks from course_data view (has per-user lesson arrays)
  const { data: userCourseData } = await supabase
    .from('course_data')
    .select('module_id, semana_numero, lessons')
    .eq('user_id', user.id);

  const completedSet = new Set(completedLessonIds);
  const completedWeekNumbers: number[] = [];

  // Also try from modules/lessons tables as fallback
  if (userCourseData && userCourseData.length > 0) {
    for (const row of userCourseData) {
      const lessons = Array.isArray(row.lessons) ? row.lessons : [];
      if (lessons.length > 0 && lessons.every((l: any) => completedSet.has(l.id))) {
        completedWeekNumbers.push(row.semana_numero);
      }
    }
  } else {
    // Fallback: use modules + lessons tables directly
    const { data: allModules } = await supabase
      .from('modules')
      .select('id, semana_numero');
    const { data: allLessons } = await supabase
      .from('lessons')
      .select('id, module_id');

    if (allModules && allLessons) {
      const lessonsByModule = new Map<string, string[]>();
      for (const lesson of allLessons) {
        const list = lessonsByModule.get(lesson.module_id) || [];
        list.push(lesson.id);
        lessonsByModule.set(lesson.module_id, list);
      }
      for (const mod of allModules) {
        const moduleLessons = lessonsByModule.get(mod.id) || [];
        if (moduleLessons.length > 0 && moduleLessons.every((lid) => completedSet.has(lid))) {
          completedWeekNumbers.push(mod.semana_numero);
        }
      }
    }
  }

  // Calculate streak from training days (optimized with Set)
  const trainedDates = (trainingDays || []).map((t: any) => t.fecha);
  const trainedSet = new Set(trainedDates);
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
    if (trainedSet.has(date)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // Recalculate belt and points
  const { calculateGamification } = await import('@/lib/gamification');
  const { BELT_PROGRESSION } = await import('@/lib/constants');
  const gamification = calculateGamification({
    completedWeeks: completedWeekNumbers,
    totalTrainingDays: trainedDates.length,
    totalLessonsCompleted: actualLessonsCompleted,
  });

  const isAdmin = profile?.rol === 'admin';

  // Belt logic: use the HIGHER of calculated vs profile (admin-set) belt
  // Admin users always get black belt
  const beltOrder = BELT_PROGRESSION.map((b) => b.key);
  const profileBeltIdx = beltOrder.indexOf(profile?.cinturon_actual || 'white');
  const calculatedBeltIdx = beltOrder.indexOf(gamification.newBelt);
  const effectiveBelt = isAdmin
    ? 'black'
    : beltOrder[Math.max(profileBeltIdx, calculatedBeltIdx)] || gamification.newBelt;
  const effectivePuntos = Math.max(profile?.puntos || 0, gamification.puntos);

  // Only update DB if calculated belt/points advanced beyond what's stored
  if (
    profile &&
    !isAdmin &&
    (calculatedBeltIdx > profileBeltIdx || gamification.puntos > (profile.puntos || 0))
  ) {
    const updates: Record<string, any> = {};
    if (calculatedBeltIdx > profileBeltIdx) updates.cinturon_actual = gamification.newBelt;
    if (gamification.puntos > (profile.puntos || 0)) updates.puntos = gamification.puntos;

    await supabase.from('users').update(updates).eq('id', user.id);

    // Notify on belt advancement
    if (updates.cinturon_actual) {
      const { createNotification, BELT_NAMES } = await import('@/lib/notifications');
      await createNotification(
        user.id,
        'belt',
        `Nuevo cinturon: ${BELT_NAMES[gamification.newBelt] || gamification.newBelt}`,
        `Felicitaciones! Avanzaste al cinturon ${BELT_NAMES[gamification.newBelt] || gamification.newBelt}. Segui entrenando!`
      );
    }
  }

  // Calculate per-week completion for progress display
  let totalLessonsAvailable = 0;
  let completedWeeksCount = 0;
  let totalWeeks = 0;
  const weekProgress: { semana: number; completed: number; total: number }[] = [];

  if (userCourseData && userCourseData.length > 0) {
    for (const row of userCourseData) {
      const lessons = Array.isArray(row.lessons) ? row.lessons : [];
      totalLessonsAvailable += lessons.length;
      totalWeeks++;
      const completedInWeek = lessons.filter((l: any) => completedSet.has(l.id)).length;
      weekProgress.push({ semana: row.semana_numero, completed: completedInWeek, total: lessons.length });
      if (lessons.length > 0 && completedInWeek === lessons.length) {
        completedWeeksCount++;
      }
    }
  }

  // Overall lesson-based progress percentage
  const overallProgress = totalLessonsAvailable > 0
    ? Math.round((actualLessonsCompleted / totalLessonsAvailable) * 100)
    : 0;

  return NextResponse.json({
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
    unlockedModules: unlockedModules ?? 0,
    completedLessonIds,
    completedWeekNumbers,
    completedWeeksCount,
    totalWeeks,
    overallProgress,
    streak,
    totalTrainingDays: trainedDates.length,
  });
}
