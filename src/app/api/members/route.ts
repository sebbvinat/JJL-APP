import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const memberId = request.nextUrl.searchParams.get('id');
  if (!memberId) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  // Get member profile (public info only)
  const { data: member } = await supabase
    .from('users')
    .select('id, nombre, cinturon_actual, puntos, avatar_url, created_at')
    .eq('id', memberId)
    .single();

  if (!member) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Get their stats
  const [{ count: lessonsCount }, { count: trainingDays }, { count: postsCount }] = await Promise.all([
    supabase.from('user_progress').select('*', { count: 'exact', head: true }).eq('user_id', memberId).eq('completado', true),
    supabase.from('daily_tasks').select('*', { count: 'exact', head: true }).eq('user_id', memberId).eq('entreno_check', true),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', memberId),
  ]);

  // Check if current user is admin
  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  const isAdmin = (profile as any)?.rol === 'admin';

  return NextResponse.json({
    member: {
      ...member,
      lessonsCompleted: lessonsCount ?? 0,
      trainingDays: trainingDays ?? 0,
      postsCount: postsCount ?? 0,
    },
    isAdmin,
  });
}
