import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

// GET: Load course data for the logged-in user
// ?all=true → all modules for this user (listing page)
// ?moduleId=xxx → single module for this user
export async function GET(request: NextRequest) {
  const moduleId = request.nextUrl.searchParams.get('moduleId');
  const all = request.nextUrl.searchParams.get('all');

  // Get logged-in user
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
    return NextResponse.json({ module: null, modules: [] });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const adminClient = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Return all modules for this user
  if (all === 'true') {
    const { data, error } = await adminClient
      .from('course_data')
      .select('module_id, semana_numero, titulo, descripcion, lessons')
      .eq('user_id', user.id)
      .order('semana_numero', { ascending: true });

    if (error) {
      console.error('course-data fetch all error:', error.message);
    }

    const modules = (data || []).map((row: any) => ({
      id: row.module_id,
      semana_numero: row.semana_numero,
      titulo: row.titulo,
      descripcion: row.descripcion,
      lessonCount: Array.isArray(row.lessons) ? row.lessons.length : 0,
      videoCount: Array.isArray(row.lessons)
        ? row.lessons.filter((l: any) => l.tipo !== 'reflection').length
        : 0,
      lessons: Array.isArray(row.lessons)
        ? row.lessons.map((l: any) => ({ id: l.id, tipo: l.tipo }))
        : [],
    }));

    return NextResponse.json({ modules });
  }

  // Return single module for this user
  if (!moduleId) {
    return NextResponse.json({ error: 'moduleId requerido' }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from('course_data')
    .select('*')
    .eq('user_id', user.id)
    .eq('module_id', moduleId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('course-data fetch error:', error.message);
  }

  if (data) {
    return NextResponse.json({
      module: {
        id: data.module_id,
        semana_numero: data.semana_numero,
        titulo: data.titulo,
        descripcion: data.descripcion,
        lessons: data.lessons,
      },
      moduleInfo: {
        semana_numero: data.semana_numero,
        titulo: data.titulo,
        descripcion: data.descripcion || '',
      },
    });
  }

  return NextResponse.json({ module: null });
}
