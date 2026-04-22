import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function getSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
}

// GET: list user's skills with their ratings + tasks
export async function GET(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: skills } = await supabase
    .from('skills')
    .select('*')
    .eq('user_id', user.id)
    .eq('activa', true)
    .order('created_at', { ascending: true });

  const skillIds = (skills || []).map((s: any) => s.id);
  let ratingsBySkill: Record<string, any[]> = {};
  let tasksBySkill: Record<string, any[]> = {};

  if (skillIds.length > 0) {
    const [{ data: ratings }, { data: tasks }] = await Promise.all([
      supabase
        .from('skill_ratings')
        .select('*')
        .in('skill_id', skillIds)
        .order('semana', { ascending: true }),
      supabase
        .from('skill_tasks')
        .select('*')
        .in('skill_id', skillIds)
        .order('orden', { ascending: true }),
    ]);

    (ratings || []).forEach((r: any) => {
      if (!ratingsBySkill[r.skill_id]) ratingsBySkill[r.skill_id] = [];
      ratingsBySkill[r.skill_id].push(r);
    });
    (tasks || []).forEach((t: any) => {
      if (!tasksBySkill[t.skill_id]) tasksBySkill[t.skill_id] = [];
      tasksBySkill[t.skill_id].push(t);
    });
  }

  const enriched = (skills || []).map((s: any) => ({
    ...s,
    ratings: ratingsBySkill[s.id] || [],
    tasks: tasksBySkill[s.id] || [],
  }));

  return NextResponse.json({ skills: enriched });
}

// POST: create a new skill with optional base level + tasks list
export async function POST(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { nombre, categoria, nivelBase, tasks } = await request.json();
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

  // Create skill
  const { data: skill, error: skillErr } = await supabase
    .from('skills')
    .insert({
      user_id: user.id,
      nombre: nombre.trim(),
      categoria: categoria?.trim() || null,
    })
    .select()
    .single();

  if (skillErr || !skill) return NextResponse.json({ error: skillErr?.message || 'Error' }, { status: 500 });

  // Insert base level rating if provided
  if (typeof nivelBase === 'number' && nivelBase >= 1 && nivelBase <= 10) {
    // Week anchor: monday of current week
    const today = new Date();
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const semana = monday.toISOString().slice(0, 10);

    await supabase.from('skill_ratings').insert({
      skill_id: (skill as any).id,
      user_id: user.id,
      semana,
      nivel: nivelBase,
      nota: 'Nivel base inicial',
    });
  }

  // Insert tasks if provided
  if (Array.isArray(tasks) && tasks.length > 0) {
    const rows = tasks
      .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
      .map((texto: string, i: number) => ({
        skill_id: (skill as any).id,
        user_id: user.id,
        texto: texto.trim(),
        orden: i,
      }));
    if (rows.length > 0) {
      await supabase.from('skill_tasks').insert(rows);
    }
  }

  return NextResponse.json({ skill });
}

// DELETE: archive a skill
export async function DELETE(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { skillId } = await request.json();
  if (!skillId) return NextResponse.json({ error: 'skillId requerido' }, { status: 400 });

  const { error } = await supabase
    .from('skills')
    .update({ activa: false })
    .eq('id', skillId)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
