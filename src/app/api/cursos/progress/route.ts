import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';

// Progreso de los cursos sueltos (cursos_progress).
// Mismo patrón que /api/progress del programa.

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data } = await supabase
    .from('cursos_progress')
    .select('lesson_id')
    .eq('user_id', user.id)
    .eq('completado', true);

  const rows = (data as Array<{ lesson_id: string }> | null) ?? [];
  return NextResponse.json({ completedLessonIds: rows.map((r) => r.lesson_id) });
}

export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { lessonId, completed } = await request.json();
  if (!lessonId) {
    return NextResponse.json({ error: 'lessonId required' }, { status: 400 });
  }

  const { error } = await supabase.from('cursos_progress').upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      completado: completed ?? true,
      completed_at: completed ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id,lesson_id' }
  );

  if (error) {
    console.error('cursos progress upsert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
