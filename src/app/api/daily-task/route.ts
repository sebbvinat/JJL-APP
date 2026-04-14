import { NextResponse, type NextRequest } from 'next/server';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { getAuthedUser } from '@/lib/supabase/server';

const HISTORY_DAYS = 120; // ~4 months of history

const FULL_COLUMNS =
  'fecha, entreno_check, fatiga, intensidad, objetivo, objetivo_cumplido, regla, regla_cumplida, puntaje, observaciones, aprendizajes, notas, meta_entreno';

interface DailyRow {
  fecha: string;
  objetivo: string | null;
  regla: string | null;
  meta_entreno: string | null;
}

/**
 * GET
 *   ?fecha=YYYY-MM-DD           → entry for that day
 *   ?history=true[&q=...]       → history (last 120 days), optional text search
 *   ?search=true&q=...          → same as history but returns only hits
 *   ?weekly=YYYY-MM-DD          → derive weekly focus from the latest day in
 *                                 the ISO week of that date
 */
export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const history = params.get('history') === 'true';
  const weekly = params.get('weekly');
  const q = params.get('q')?.trim().toLowerCase() || '';

  if (weekly) {
    const anchor = new Date(weekly + 'T12:00:00');
    const from = format(startOfWeek(anchor, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const to = format(endOfWeek(anchor, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('daily_tasks')
      .select('fecha, objetivo, regla, meta_entreno')
      .eq('user_id', user.id)
      .gte('fecha', from)
      .lte('fecha', to)
      .order('fecha', { ascending: false });
    const rows = (data as DailyRow[] | null) || [];
    const pick = (field: keyof DailyRow) => rows.find((r) => r[field])?.[field] ?? null;
    return NextResponse.json({
      week: { from, to },
      objetivo: pick('objetivo'),
      regla: pick('regla'),
      meta_entreno: pick('meta_entreno'),
    });
  }

  if (history) {
    let query = supabase
      .from('daily_tasks')
      .select(FULL_COLUMNS)
      .eq('user_id', user.id)
      .order('fecha', { ascending: false })
      .limit(HISTORY_DAYS);

    if (q) {
      // Case-insensitive match across the text fields we persist long-term.
      const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      query = query.or(
        [
          `observaciones.ilike.${pattern}`,
          `aprendizajes.ilike.${pattern}`,
          `notas.ilike.${pattern}`,
          `objetivo.ilike.${pattern}`,
          `meta_entreno.ilike.${pattern}`,
        ].join(',')
      );
    }

    const { data } = await query;
    return NextResponse.json({ history: data || [] });
  }

  const fecha = params.get('fecha') || format(new Date(), 'yyyy-MM-dd');
  const { data } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('fecha', fecha)
    .maybeSingle();

  return NextResponse.json({ entry: data || null });
}

export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const today = body.fecha || format(new Date(), 'yyyy-MM-dd');

  if (body.action === 'check-in') {
    const { error } = await supabase
      .from('daily_tasks')
      .upsert(
        { user_id: user.id, fecha: today, entreno_check: true },
        { onConflict: 'user_id,fecha' }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'feedback') {
    const { error } = await supabase
      .from('daily_tasks')
      .upsert(
        { user_id: user.id, fecha: today, feedback_texto: body.text },
        { onConflict: 'user_id,fecha' }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'journal') {
    const { error } = await supabase.from('daily_tasks').upsert(
      {
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
        aprendizajes: body.aprendizajes || null,
        notas: body.notas || null,
        meta_entreno: body.meta_entreno || null,
      },
      { onConflict: 'user_id,fecha' }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
