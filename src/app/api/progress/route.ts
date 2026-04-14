import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { lessonId, completed } = await request.json();

  if (!lessonId) {
    return NextResponse.json({ error: 'lessonId required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: user.id,
      lesson_id: lessonId,
      completado: completed ?? true,
      completed_at: completed ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,lesson_id' });

  if (error) {
    console.error('Progress upsert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const [progressRes, accessRes] = await Promise.all([
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

  const completedRows = (progressRes.data as Array<{ lesson_id: string }> | null) || [];
  const accessRows = (accessRes.data as Array<{ module_id: string }> | null) || [];

  return NextResponse.json({
    completedLessonIds: completedRows.map((d) => d.lesson_id),
    unlockedModuleIds: accessRows.map((d) => d.module_id),
  });
}
