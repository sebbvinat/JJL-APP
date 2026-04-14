import { NextResponse, type NextRequest } from 'next/server';
import { format, subDays, parseISO, isValid } from 'date-fns';
import { getAuthedUser } from '@/lib/supabase/server';

/**
 * GET /api/journal/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns every structured daily_tasks row in the range, plus every
 * journal_entries row (aprendizaje / observacion / nota), so the print page
 * can assemble a complete diary.
 *
 * Defaults:
 *   - from: 90 days ago (cap 365)
 *   - to:   today
 */

interface JournalEntryRow {
  id: string;
  kind: 'aprendizaje' | 'observacion' | 'nota';
  text: string;
  fecha: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const today = new Date();
  const toParam = request.nextUrl.searchParams.get('to');
  const fromParam = request.nextUrl.searchParams.get('from');

  const to = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : today;
  const defaultFrom = subDays(to, 90);
  const fromRaw = fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : defaultFrom;

  const diffDays = (to.getTime() - fromRaw.getTime()) / (1000 * 60 * 60 * 24);
  const from = diffDays > 365 ? subDays(to, 365) : fromRaw;

  const fromStr = format(from, 'yyyy-MM-dd');
  const toStr = format(to, 'yyyy-MM-dd');

  const [profileRes, tasksRes, entriesRes] = await Promise.all([
    supabase
      .from('users')
      .select('nombre, cinturon_actual')
      .eq('id', user.id)
      .single<{ nombre: string; cinturon_actual: string }>(),
    supabase
      .from('daily_tasks')
      .select('*')
      .eq('user_id', user.id)
      .gte('fecha', fromStr)
      .lte('fecha', toStr)
      .order('fecha', { ascending: false }),
    supabase
      .from('journal_entries')
      .select('id, kind, text, fecha, created_at')
      .eq('user_id', user.id)
      .gte('fecha', fromStr)
      .lte('fecha', toStr)
      .order('created_at', { ascending: true }),
  ]);

  const entriesByFecha: Record<
    string,
    { aprendizajes: string[]; observaciones: string[]; notas: string[] }
  > = {};
  for (const e of (entriesRes.data as JournalEntryRow[] | null) || []) {
    if (!e.fecha) continue;
    const bucket = (entriesByFecha[e.fecha] ||= {
      aprendizajes: [],
      observaciones: [],
      notas: [],
    });
    if (e.kind === 'aprendizaje') bucket.aprendizajes.push(e.text);
    else if (e.kind === 'observacion') bucket.observaciones.push(e.text);
    else if (e.kind === 'nota') bucket.notas.push(e.text);
  }

  return NextResponse.json({
    profile: profileRes.data,
    range: { from: fromStr, to: toStr },
    entries: tasksRes.data || [],
    entriesByFecha,
  });
}
