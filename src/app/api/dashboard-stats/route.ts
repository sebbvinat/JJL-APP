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

  // Fetch completed lessons count
  const { count: lessonsCompleted } = await supabase
    .from('user_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('completado', true);

  // Fetch unlocked modules count
  const { count: unlockedModules } = await supabase
    .from('user_access')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_unlocked', true);

  // Fetch completed lesson IDs (for module detail pages)
  const { data: completedLessons } = await supabase
    .from('user_progress')
    .select('lesson_id')
    .eq('user_id', user.id)
    .eq('completado', true);

  // Calculate streak from training days
  const trainedDates = (trainingDays || []).map((t: any) => t.fecha);
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
    if (trainedDates.includes(date)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return NextResponse.json({
    profile: profile || { cinturon_actual: 'white', puntos: 0, nombre: 'Usuario' },
    trainedDays: trainedDates,
    todayChecked: todayTask?.entreno_check ?? false,
    lessonsCompleted: lessonsCompleted ?? 0,
    unlockedModules: unlockedModules ?? 0,
    completedLessonIds: (completedLessons || []).map((l: any) => l.lesson_id),
    streak,
    totalTrainingDays: trainedDates.length,
  });
}
