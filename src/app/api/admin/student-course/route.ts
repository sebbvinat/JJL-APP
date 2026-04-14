import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

// GET: Fetch a student's course_data (admin only)
export async function GET(request: NextRequest) {
  const targetUserId = request.nextUrl.searchParams.get('userId');
  if (!targetUserId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { admin: adminClient } = ctx;

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
