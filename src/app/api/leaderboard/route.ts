import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { format, subDays } from 'date-fns';

/**
 * GET /api/leaderboard
 *
 * Antes cargaba la tabla `user_progress` ENTERA (filtrada por completado=true)
 * y `daily_tasks` ENTERA (filtrada por entreno_check=true). Con cada alumno
 * que avanza el costo crece linealmente sin tope, y el streak se calculaba
 * con un loop de 365 iteraciones por usuario.
 *
 * Cambios:
 *   - Limit users a alumnos (.eq('rol', 'alumno')).
 *   - daily_tasks: solo últimos 90 días (streaks más largos no aportan al
 *     leaderboard semanal/mensual y bajan el payload >10x).
 *   - Streak loop reducido a 90 días.
 *   - Cache-Control 5min + SWR 15min — el ranking no es realtime.
 */
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

  // Solo alumnos en el ranking. Limit hard de seguridad para no agarrarnos
  // un crecimiento sin tope.
  const { data: users } = await admin
    .from('users')
    .select('id, nombre, cinturon_actual, puntos, avatar_url, rol')
    .eq('rol', 'alumno')
    .limit(500);

  if (!users || users.length === 0) {
    return NextResponse.json(
      { leaderboard: [] },
      { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=900' } },
    );
  }

  const userIds = users.map((u: any) => u.id);
  const today = new Date();
  const ninetyDaysAgo = format(subDays(today, 90), 'yyyy-MM-dd');

  // Queries en paralelo, ambas acotadas a userIds + ventana de 90 días.
  const [{ data: allProgress }, { data: allTraining }] = await Promise.all([
    admin
      .from('user_progress')
      .select('user_id')
      .eq('completado', true)
      .in('user_id', userIds),
    admin
      .from('daily_tasks')
      .select('user_id, fecha')
      .eq('entreno_check', true)
      .in('user_id', userIds)
      .gte('fecha', ninetyDaysAgo),
  ]);

  const lessonCounts: Record<string, number> = {};
  (allProgress || []).forEach((p: any) => {
    lessonCounts[p.user_id] = (lessonCounts[p.user_id] || 0) + 1;
  });

  const trainingCounts: Record<string, number> = {};
  const userTrainingDates: Record<string, Set<string>> = {};
  (allTraining || []).forEach((t: any) => {
    trainingCounts[t.user_id] = (trainingCounts[t.user_id] || 0) + 1;
    if (!userTrainingDates[t.user_id]) userTrainingDates[t.user_id] = new Set();
    userTrainingDates[t.user_id].add(t.fecha);
  });

  // Streak: loop reducido a 90 días (antes 365). Cualquier streak >90 días
  // es excepcional y no nos perdemos información útil para el ranking.
  const streaks: Record<string, number> = {};
  for (const [userId, dates] of Object.entries(userTrainingDates)) {
    let streak = 0;
    for (let i = 0; i < 90; i++) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      if (dates.has(d)) streak++;
      else if (i > 0) break;
    }
    streaks[userId] = streak;
  }

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

  leaderboard.sort((a: any, b: any) => b.puntos - a.puntos);
  leaderboard.forEach((u: any, i: number) => { u.rank = i + 1; });

  return NextResponse.json(
    { leaderboard },
    {
      // 5min + SWR 15min. El ranking no necesita ser realtime.
      headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=900' },
    },
  );
}
