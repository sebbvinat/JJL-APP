import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { format } from 'date-fns';

function getSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

// GET: load journal entry for a date
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = getSupabase(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const fecha = request.nextUrl.searchParams.get('fecha') || format(new Date(), 'yyyy-MM-dd');
  const history = request.nextUrl.searchParams.get('history');

  // Return last 7 entries for history view (full data for detail view)
  if (history === 'true') {
    const { data } = await supabase
      .from('daily_tasks')
      .select('fecha, entreno_check, fatiga, intensidad, objetivo, objetivo_cumplido, regla, regla_cumplida, puntaje, observaciones')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false })
      .limit(7);

    return NextResponse.json({ history: data || [] });
  }

  // Return single day entry
  const { data } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('fecha', fecha)
    .single();

  return NextResponse.json({ entry: data || null });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = getSupabase(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const today = body.fecha || format(new Date(), 'yyyy-MM-dd');

  if (body.action === 'check-in') {
    const { error } = await supabase
      .from('daily_tasks')
      .upsert({
        user_id: user.id,
        fecha: today,
        entreno_check: true,
      }, { onConflict: 'user_id,fecha' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'feedback') {
    const { error } = await supabase
      .from('daily_tasks')
      .upsert({
        user_id: user.id,
        fecha: today,
        feedback_texto: body.text,
      }, { onConflict: 'user_id,fecha' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'journal') {
    const { error } = await supabase
      .from('daily_tasks')
      .upsert({
        user_id: user.id,
        fecha: today,
        entreno_check: body.entreno_check ?? false,
        fatiga: body.fatiga || null,
        intensidad: body.intensidad || null,
        objetivo: body.objetivo || null,
        objetivo_cumplido: body.objetivo_cumplido ?? null,
        regla: body.regla || null,
        regla_cumplida: body.regla_cumplida ?? null,
        puntaje: body.puntaje || null,
        observaciones: body.observaciones || null,
      }, { onConflict: 'user_id,fecha' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
