import { NextResponse, type NextRequest } from 'next/server';
import { format, subMonths } from 'date-fns';
import { getAuthedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Journal entries — multiple rows per day, optionally standalone (fecha=null).
 *
 * GET
 *   ?fecha=YYYY-MM-DD        → entries for that day (any kind)
 *   ?kind=aprendizaje|nota|observacion  → filter by kind (combinable with fecha)
 *   ?months=6                → last N months of entries (for library)
 *   ?q=<text>                → ilike search in text
 *   (no params)              → last 120 days of entries
 *
 * POST
 *   { kind, text, fecha? }   → create a new entry. fecha defaults to today
 *                              when omitted. Pass fecha=null explicitly to
 *                              create a standalone note.
 *
 * (PATCH/DELETE handled at /api/journal-entries/[id])
 */

type Kind = 'aprendizaje' | 'observacion' | 'nota';
const KINDS: Kind[] = ['aprendizaje', 'observacion', 'nota'];

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const fecha = params.get('fecha');
  const kind = params.get('kind');
  const monthsRaw = params.get('months');
  const q = params.get('q')?.trim() || '';

  let query = supabase
    .from('journal_entries')
    .select('id, kind, text, fecha, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500);

  if (fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: 'fecha invalida' }, { status: 400 });
    }
    query = query.eq('fecha', fecha);
  } else if (monthsRaw) {
    const months = Math.min(Math.max(Number(monthsRaw) || 6, 1), 12);
    const from = format(subMonths(new Date(), months), 'yyyy-MM-dd');
    query = query.or(`fecha.gte.${from},fecha.is.null`);
  } else {
    const from = format(subMonths(new Date(), 4), 'yyyy-MM-dd');
    query = query.or(`fecha.gte.${from},fecha.is.null`);
  }

  if (kind && KINDS.includes(kind as Kind)) {
    query = query.eq('kind', kind);
  }

  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    query = query.ilike('text', pattern);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('journal-entries.list.failed', { err: error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data || [] });
}

export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: { kind?: string; text?: string; fecha?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const { kind, text, fecha } = body;
  if (!kind || !KINDS.includes(kind as Kind)) {
    return NextResponse.json({ error: 'kind invalido' }, { status: 400 });
  }
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return NextResponse.json({ error: 'text vacio' }, { status: 400 });
  }

  let fechaValue: string | null;
  if (fecha === null) {
    fechaValue = null; // standalone
  } else if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    fechaValue = fecha;
  } else if (fecha === undefined) {
    fechaValue = format(new Date(), 'yyyy-MM-dd');
  } else {
    return NextResponse.json({ error: 'fecha invalida' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: user.id,
      kind,
      text: trimmed,
      fecha: fechaValue,
    })
    .select('id, kind, text, fecha, created_at, updated_at')
    .single();

  if (error) {
    logger.error('journal-entries.create.failed', { err: error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data });
}
