import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function getSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
}

// GET: list user's skills with their latest rating
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

  if (skillIds.length > 0) {
    const { data: ratings } = await supabase
      .from('skill_ratings')
      .select('*')
      .in('skill_id', skillIds)
      .order('semana', { ascending: true });

    (ratings || []).forEach((r: any) => {
      if (!ratingsBySkill[r.skill_id]) ratingsBySkill[r.skill_id] = [];
      ratingsBySkill[r.skill_id].push(r);
    });
  }

  const enriched = (skills || []).map((s: any) => ({
    ...s,
    ratings: ratingsBySkill[s.id] || [],
  }));

  return NextResponse.json({ skills: enriched });
}

// POST: create a new skill
export async function POST(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { nombre, descripcion, categoria } = await request.json();
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

  const { data, error } = await supabase
    .from('skills')
    .insert({
      user_id: user.id,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      categoria: categoria?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ skill: data });
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
