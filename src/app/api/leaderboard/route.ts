import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { format, subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get all non-admin users
  const { data: users } = await admin
    .from('users')
    .select('id, nombre, cinturon_actual, puntos, avatar_url, rol')
    .eq('rol', 'alumno');

  if (!users) return NextResponse.json({ leaderboard: [] });

  // Get lesson counts per user
  const { data: allProgress } = await admin
    .from('user_progress')
    .select('user_id')
    .eq('completado', true);

  const lessonCounts: Record<string, number> = {};
  (allProgress || []).forEach((p: any) => {
    lessonCounts[p.user_id] = (lessonCounts[p.user_id] || 0) + 1;
  });

  // Get training days per user (last 30 days for streak)
  const { data: allTraining } = await admin
    .from('daily_tasks')
    .select('user_id, fecha')
    .eq('entreno_check', true);

  const trainingCounts: Record<string, number> = {};
  const streaks: Record<string, number> = {};

  // Group by user
  const userTrainingDates: Record<string, Set<string>> = {};
  (allTraining || []).forEach((t: any) => {
    trainingCounts[t.user_id] = (trainingCounts[t.user_id] || 0) + 1;
    if (!userTrainingDates[t.user_id]) userTrainingDates[t.user_id] = new Set();
    userTrainingDates[t.user_id].add(t.fecha);
  });

  // Calculate streaks
  const today = new Date();
  for (const [userId, dates] of Object.entries(userTrainingDates)) {
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      if (dates.has(d)) streak++;
      else if (i > 0) break;
    }
    streaks[userId] = streak;
  }

  // Build leaderboard
  const leaderboard = users.map((u: any) => ({
    id: u.id,
    nombre: u.nombre,
    avatar_url: u.avatar_url,
    cinturon: u.cinturon_actual,
    puntos: u.puntos || 0,
    lessons: lessonCounts[u.id] || 0,
    trainingDays: trainingCounts[u.id] || 0,
    streak: streaks[u.id] || 0,
    isMe: u.id === user.id,
  }));

  // Sort by points descending
  leaderboard.sort((a: any, b: any) => b.puntos - a.puntos);

  // Add rank
  leaderboard.forEach((u: any, i: number) => { u.rank = i + 1; });

  return NextResponse.json({ leaderboard });
}
