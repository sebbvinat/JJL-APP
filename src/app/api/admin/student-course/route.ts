import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// GET: Fetch a student's course_data (admin only)
export async function GET(request: NextRequest) {
  const targetUserId = request.nextUrl.searchParams.get('userId');
  if (!targetUserId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

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
    return NextResponse.json({ modules: [] });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify admin
  const { data: profile } = await adminClient
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  }

  // Fetch student's course data
  const { data, error } = await adminClient
    .from('course_data')
    .select('module_id, semana_numero, titulo, descripcion, lessons')
    .eq('user_id', targetUserId)
    .order('semana_numero', { ascending: true });

  if (error) {
    console.error('student-course fetch error:', error.message);
    return NextResponse.json({ modules: [] });
  }

  const modules = (data || []).map((row: any) => ({
    id: row.module_id,
    semana_numero: row.semana_numero,
    titulo: row.titulo,
    descripcion: row.descripcion || '',
    lessons: row.lessons || [],
  }));

  return NextResponse.json({ modules });
}
