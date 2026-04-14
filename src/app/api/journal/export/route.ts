import { NextResponse, type NextRequest } from 'next/server';
import { format, subDays, parseISO, isValid } from 'date-fns';
import { getAuthedUser } from '@/lib/supabase/server';

/**
 * GET /api/journal/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns the full journal rows for the range so /journal/export can render
 * them for print-to-PDF. Both from and to are optional:
 *   - from default: 90 days ago
 *   - to   default: today
 * Hard cap: 365 days.
 */

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const today = new Date();
  const toParam = request.nextUrl.searchParams.get('to');
  const fromParam = request.nextUrl.searchParams.get('from');

  const to = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : today;
  const defaultFrom = subDays(to, 90);
  const fromRaw =
    fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : defaultFrom;

  // Clamp to 365 days max.
  const diffDays =
    (to.getTime() - fromRaw.getTime()) / (1000 * 60 * 60 * 24);
  const from =
    diffDays > 365 ? subDays(to, 365) : fromRaw;

  const fromStr = format(from, 'yyyy-MM-dd');
  const toStr = format(to, 'yyyy-MM-dd');

  const [profileRes, entriesRes] = await Promise.all([
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
  ]);

  return NextResponse.json({
    profile: profileRes.data,
    range: { from: fromStr, to: toStr },
    entries: entriesRes.data || [],
  });
}
