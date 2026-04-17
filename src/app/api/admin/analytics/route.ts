import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { format, subDays, subWeeks } from 'date-fns';

export async function GET(request: NextRequest) {
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
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: profile } = await adminClient.from('users').select('rol').eq('id', user.id).single();
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const weekAgo = format(subDays(now, 7), 'yyyy-MM-dd');
  const monthAgo = format(subDays(now, 30), 'yyyy-MM-dd');

  // 1. Total users
  const { count: totalUsers } = await adminClient
    .from('users')
    .select('*', { count: 'exact', head: true });

  // 2. Active users (trained or logged in last 7 days)
  const { data: recentSessions } = await adminClient
    .from('user_sessions')
    .select('user_id')
    .gte('started_at', subDays(now, 7).toISOString());

  const activeUserIds = new Set((recentSessions || []).map((s: any) => s.user_id));
  const activeUsersCount = activeUserIds.size;

  // 3. Training days this week
  const { data: weekTraining } = await adminClient
    .from('daily_tasks')
    .select('user_id, fecha')
    .eq('entreno_check', true)
    .gte('fecha', weekAgo);

  const trainingThisWeek = (weekTraining || []).length;
  const uniqueTrainers = new Set((weekTraining || []).map((t: any) => t.user_id)).size;

  // 4. Lessons completed (total + this week)
  const { count: totalLessons } = await adminClient
    .from('user_progress')
    .select('*', { count: 'exact', head: true })
    .eq('completado', true);

  const { count: weekLessons } = await adminClient
    .from('user_progress')
    .select('*', { count: 'exact', head: true })
    .eq('completado', true)
    .gte('completed_at', subDays(now, 7).toISOString());

  // 5. Community engagement (posts + comments this week)
  const { count: weekPosts } = await adminClient
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', subDays(now, 7).toISOString());

  const { count: weekComments } = await adminClient
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', subDays(now, 7).toISOString());

  // 6. Average session duration (last 7 days)
  const { data: sessions7d } = await adminClient
    .from('user_sessions')
    .select('duration_seconds')
    .gte('started_at', subDays(now, 7).toISOString())
    .gt('duration_seconds', 10); // ignore bounces

  const avgDuration = sessions7d && sessions7d.length > 0
    ? Math.round(sessions7d.reduce((sum: number, s: any) => sum + s.duration_seconds, 0) / sessions7d.length)
    : 0;

  const totalTimeMinutes = sessions7d
    ? Math.round(sessions7d.reduce((sum: number, s: any) => sum + s.duration_seconds, 0) / 60)
    : 0;

  // 7. Retention: users active this week vs last week
  const { data: lastWeekSessions } = await adminClient
    .from('user_sessions')
    .select('user_id')
    .gte('started_at', subDays(now, 14).toISOString())
    .lt('started_at', subDays(now, 7).toISOString());

  const lastWeekUsers = new Set((lastWeekSessions || []).map((s: any) => s.user_id));
  const retained = [...activeUserIds].filter((id) => lastWeekUsers.has(id)).length;
  const retentionRate = lastWeekUsers.size > 0 ? Math.round((retained / lastWeekUsers.size) * 100) : 0;

  // 8. Per-user details (for the table)
  const { data: allUsers } = await adminClient
    .from('users')
    .select('id, nombre, email, cinturon_actual, puntos, planilla_id, created_at')
    .order('created_at', { ascending: false });

  // Get per-user session totals and last active
  const { data: allSessions } = await adminClient
    .from('user_sessions')
    .select('user_id, duration_seconds, started_at')
    .gte('started_at', subDays(now, 30).toISOString())
    .gt('duration_seconds', 0);

  const userSessionMap: Record<string, { totalMin: number; count: number; lastActive: string }> = {};
  (allSessions || []).forEach((s: any) => {
    if (!userSessionMap[s.user_id]) {
      userSessionMap[s.user_id] = { totalMin: 0, count: 0, lastActive: s.started_at };
    }
    userSessionMap[s.user_id].totalMin += s.duration_seconds / 60;
    userSessionMap[s.user_id].count++;
    if (s.started_at > userSessionMap[s.user_id].lastActive) {
      userSessionMap[s.user_id].lastActive = s.started_at;
    }
  });

  // Get per-user lesson counts
  const { data: userLessons } = await adminClient
    .from('user_progress')
    .select('user_id')
    .eq('completado', true);

  const userLessonCounts: Record<string, number> = {};
  (userLessons || []).forEach((l: any) => {
    userLessonCounts[l.user_id] = (userLessonCounts[l.user_id] || 0) + 1;
  });

  // Get per-user training days count
  const { data: userTraining } = await adminClient
    .from('daily_tasks')
    .select('user_id')
    .eq('entreno_check', true);

  const userTrainingCounts: Record<string, number> = {};
  (userTraining || []).forEach((t: any) => {
    userTrainingCounts[t.user_id] = (userTrainingCounts[t.user_id] || 0) + 1;
  });

  const userDetails = (allUsers || []).map((u: any) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    cinturon: u.cinturon_actual,
    puntos: u.puntos,
    planilla: u.planilla_id,
    lessonsCompleted: userLessonCounts[u.id] || 0,
    trainingDays: userTrainingCounts[u.id] || 0,
    timeInAppMin: Math.round(userSessionMap[u.id]?.totalMin || 0),
    sessionCount: userSessionMap[u.id]?.count || 0,
    lastActive: userSessionMap[u.id]?.lastActive || null,
    joinedAt: u.created_at,
  }));

  // 9. Daily active users chart (last 14 days)
  const dailyActive: { date: string; count: number }[] = [];
  const { data: allRecentSessions } = await adminClient
    .from('user_sessions')
    .select('user_id, started_at')
    .gte('started_at', subDays(now, 14).toISOString());

  for (let i = 13; i >= 0; i--) {
    const date = format(subDays(now, i), 'yyyy-MM-dd');
    const dayUsers = new Set(
      (allRecentSessions || [])
        .filter((s: any) => s.started_at.startsWith(date))
        .map((s: any) => s.user_id)
    );
    dailyActive.push({ date, count: dayUsers.size });
  }

  return NextResponse.json({
    overview: {
      totalUsers: totalUsers ?? 0,
      activeUsers: activeUsersCount,
      retentionRate,
      avgDurationMin: Math.round(avgDuration / 60),
      totalTimeMin: totalTimeMinutes,
      totalSessions: sessions7d?.length || 0,
    },
    engagement: {
      trainingThisWeek,
      uniqueTrainers,
      lessonsTotal: totalLessons ?? 0,
      lessonsThisWeek: weekLessons ?? 0,
      postsThisWeek: weekPosts ?? 0,
      commentsThisWeek: weekComments ?? 0,
    },
    dailyActive,
    users: userDetails,
  });
}
