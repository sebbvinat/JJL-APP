import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// POST: rate a skill for the current week
export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { skillId, nivel, nota, semana } = await request.json();
  if (!skillId || !nivel) return NextResponse.json({ error: 'Datos faltantes' }, { status: 400 });
  if (nivel < 1 || nivel > 10) return NextResponse.json({ error: 'Nivel invalido' }, { status: 400 });

  // Default to monday of current week (YYYY-MM-DD format)
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const defaultSemana = monday.toISOString().slice(0, 10);

  const { error } = await supabase
    .from('skill_ratings')
    .upsert({
      skill_id: skillId,
      user_id: user.id,
      semana: semana || defaultSemana,
      nivel,
      nota: nota?.trim() || null,
    }, { onConflict: 'skill_id,semana' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
