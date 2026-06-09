import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';

/**
 * GET /api/student-dashboard
 *
 * Combina lo que antes hacía `/api/course-data?all=true` + `/api/progress`
 * en una sola request. La página `/modules` ahora pega 1 endpoint en lugar
 * de 2 — ahorra un round-trip secuencial cuando SWR no tiene cache.
 *
 * Shape de la response:
 *   {
 *     modules: ModuleInfo[],          // todos los módulos del alumno
 *     completedLessonIds: string[],   // ids de lecciones marcadas completas
 *     unlockedModuleIds: string[],    // ids de módulos desbloqueados
 *   }
 *
 * Cache: privado 30s + SWR 3min — el alumno marca progreso seguido pero
 * el dataset cambia poco entre minutos.
 */
export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json(
      { modules: [], completedLessonIds: [], unlockedModuleIds: [] },
      { status: 401 },
    );
  }

  // Tres queries en paralelo dentro del mismo handler — mucho más rápido
  // que dos endpoints secuenciales (el frontend hacía 2 round-trips).
  const [courseRes, progressRes, accessRes] = await Promise.all([
    supabase
      .from('course_data')
      .select('module_id, semana_numero, titulo, descripcion, lessons')
      .eq('user_id', user.id)
      .order('semana_numero', { ascending: true }),
    supabase
      .from('user_progress')
      .select('lesson_id')
      .eq('user_id', user.id)
      .eq('completado', true),
    supabase
      .from('user_access')
      .select('module_id')
      .eq('user_id', user.id)
      .eq('is_unlocked', true),
  ]);

  const modules = (courseRes.data || []).map((row: any) => ({
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

  const completedRows = (progressRes.data as Array<{ lesson_id: string }> | null) || [];
  const accessRows = (accessRes.data as Array<{ module_id: string }> | null) || [];

  // Cache HTTP removido (defensivo).
  return NextResponse.json({
    modules,
    completedLessonIds: completedRows.map((d) => d.lesson_id),
    unlockedModuleIds: accessRows.map((d) => d.module_id),
  });
}
