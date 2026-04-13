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

  // Fetch profile (belt, points)
  const { data: profile } = await supabase
    .from('users')
    .select('cinturon_actual, puntos, nombre')
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

  // Recalculate belt and points, update profile if changed
  const { calculateGamification } = await import('@/lib/gamification');
  const gamification = calculateGamification({
    completedWeeks: completedWeekNumbers,
    totalTrainingDays: trainedDates.length,
    totalLessonsCompleted: actualLessonsCompleted,
  });

  const newBelt = gamification.newBelt;
  const newPuntos = gamification.puntos;

  // Update user profile if belt or points changed
  if (
    profile &&
    (profile.cinturon_actual !== newBelt || profile.puntos !== newPuntos)
  ) {
    await supabase
      .from('users')
      .update({ cinturon_actual: newBelt, puntos: newPuntos })
      .eq('id', user.id);

    // Notify on belt advancement
    if (profile.cinturon_actual !== newBelt) {
      const { createNotification, BELT_NAMES } = await import('@/lib/notifications');
      await createNotification(
        user.id,
        'belt',
        `Nuevo cinturon: ${BELT_NAMES[newBelt] || newBelt}`,
        `Felicitaciones! Avanzaste al cinturon ${BELT_NAMES[newBelt] || newBelt}. Segui entrenando!`
      );
    }
  }

  // Count total lessons available for this user (for progress display)
  let totalLessonsAvailable = 0;
  if (userCourseData && userCourseData.length > 0) {
    for (const row of userCourseData) {
      const lessons = Array.isArray(row.lessons) ? row.lessons : [];
      totalLessonsAvailable += lessons.length;
    }
  }

  return NextResponse.json({
    profile: {
      ...(profile || { nombre: 'Usuario' }),
      cinturon_actual: newBelt,
      puntos: newPuntos,
    },
    trainedDays: trainedDates,
    todayChecked: todayTask?.entreno_check ?? false,
    lessonsCompleted: actualLessonsCompleted,
    totalLessonsAvailable,
    unlockedModules: unlockedModules ?? 0,
    completedLessonIds,
    completedWeekNumbers,
    streak,
    totalTrainingDays: trainedDates.length,
  });
}
