import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { format, subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  const targetUserId = request.nextUrl.searchParams.get('userId');
  if (!targetUserId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  // Verify admin
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'No service role key' }, { status: 500 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: profile } = await adminClient
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  }

  // Fetch all metrics for target student

  // 1. Training days
  const { data: trainingDays } = await adminClient
    .from('daily_tasks')
    .select('fecha, entreno_check, feedback_texto, created_at')
    .eq('user_id', targetUserId)
    .order('fecha', { ascending: false });

  const trainedDates = (trainingDays || [])
    .filter((t: any) => t.entreno_check)
    .map((t: any) => t.fecha);

  // 2. Feedbacks (non-empty)
  const feedbacks = (trainingDays || [])
    .filter((t: any) => t.feedback_texto && t.feedback_texto.trim())
    .map((t: any) => ({
      fecha: t.fecha,
      texto: t.feedback_texto,
    }));

  // 3. Completed lessons
  const { data: completedLessons } = await adminClient
    .from('user_progress')
    .select('lesson_id, completed_at')
    .eq('user_id', targetUserId)
    .eq('completado', true);

  // 4. Unlocked modules
  const { data: unlockedModules } = await adminClient
    .from('user_access')
    .select('module_id')
    .eq('user_id', targetUserId)
    .eq('is_unlocked', true);

  // 5. Calculate streak
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
    if (trainedDates.includes(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // 6. Student profile
  const { data: studentProfile } = await adminClient
    .from('users')
    .select('cinturon_actual, puntos')
    .eq('id', targetUserId)
    .single();

  return NextResponse.json({
    trainedDays: trainedDates,
    totalTrainingDays: trainedDates.length,
    streak,
    feedbacks,
    completedLessonIds: (completedLessons || []).map((l: any) => l.lesson_id),
    completedLessonsCount: (completedLessons || []).length,
    unlockedModulesCount: (unlockedModules || []).length,
    cinturon: studentProfile?.cinturon_actual || 'white',
    puntos: studentProfile?.puntos || 0,
  });
}
