import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function getSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
}

function weekAnchor() {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return monday.toISOString().slice(0, 10);
}

// POST: add a new task to a skill
export async function POST(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { skillId, texto } = await request.json();
  if (!skillId || !texto?.trim()) return NextResponse.json({ error: 'Datos faltantes' }, { status: 400 });

  // Compute order = max + 1
  const { data: existing } = await supabase
    .from('skill_tasks')
    .select('orden')
    .eq('skill_id', skillId)
    .order('orden', { ascending: false })
    .limit(1);

  const nextOrden = (existing?.[0]?.orden ?? -1) + 1;

  const { data, error } = await supabase
    .from('skill_tasks')
    .insert({
      skill_id: skillId,
      user_id: user.id,
      texto: texto.trim(),
      orden: nextOrden,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

// PATCH: toggle task completion. When ticked, bump skill level by 1 (capped at 10).
export async function PATCH(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { taskId, completada } = await request.json();
  if (!taskId) return NextResponse.json({ error: 'taskId requerido' }, { status: 400 });

  // Update task
  const { data: task, error } = await supabase
    .from('skill_tasks')
    .update({
      completada: !!completada,
      completed_at: completada ? new Date().toISOString() : null,
    })
    .eq('id', taskId)
    .eq('user_id', user.id)
    .select('skill_id, completada')
    .single();

  if (error || !task) return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });

  const taskAny = task as any;

  // Auto-level on tick (only when transitioning to completada=true)
  let newLevel: number | null = null;
  let leveledUp = false;

  if (completada && taskAny.skill_id) {
    // Get latest rating for this skill
    const { data: latest } = await supabase
      .from('skill_ratings')
      .select('nivel')
      .eq('skill_id', taskAny.skill_id)
      .order('semana', { ascending: false })
      .limit(1);

    const currentNivel = (latest as any)?.[0]?.nivel || 0;

    if (currentNivel < 10) {
      newLevel = currentNivel + 1;
      leveledUp = true;

      // Upsert rating for current week
      await supabase.from('skill_ratings').upsert({
        skill_id: taskAny.skill_id,
        user_id: user.id,
        semana: weekAnchor(),
        nivel: newLevel,
        nota: 'Subio por completar un objetivo',
      }, { onConflict: 'skill_id,semana' });
    }
  }

  return NextResponse.json({ success: true, leveledUp, newLevel });
}

// DELETE: remove a task
export async function DELETE(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { taskId } = await request.json();
  if (!taskId) return NextResponse.json({ error: 'taskId requerido' }, { status: 400 });

  const { error } = await supabase
    .from('skill_tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
