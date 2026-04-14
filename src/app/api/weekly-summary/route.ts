import { NextResponse, type NextRequest } from 'next/server';
import {
  format,
  startOfWeek,
  endOfWeek,
  subWeeks,
  eachDayOfInterval,
  parseISO,
} from 'date-fns';
import { getAuthedUser } from '@/lib/supabase/server';

/**
 * Weekly retrospective data for /weekly.
 *
 *   ?week=YYYY-MM-DD  → any date inside the target ISO week; defaults to
 *                       the current week.
 *
 * Returns: per-day rows for the week + aggregates (trained, avg puntaje,
 * fatiga breakdown, objetivo completion), plus the foco already set for
 * this week (objetivo / regla / meta_entreno) and last week's foco for
 * comparison.
 */

interface TaskRow {
  fecha: string;
  entreno_check: boolean | null;
  fatiga: string | null;
  intensidad: string | null;
  puntaje: number | null;
  objetivo: string | null;
  objetivo_cumplido: boolean | null;
  regla: string | null;
  regla_cumplida: boolean | null;
  meta_entreno: string | null;
  aprendizajes: string | null;
  observaciones: string | null;
  notas: string | null;
}

function summarize(rows: TaskRow[]) {
  const trained = rows.filter((r) => r.entreno_check).length;
  const puntajes = rows
    .filter((r) => r.puntaje != null)
    .map((r) => r.puntaje as number);
  const avgPuntaje =
    puntajes.length > 0
      ? Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 10) /
        10
      : null;

  const fatiga = { verde: 0, amarillo: 0, rojo: 0 };
  for (const r of rows) {
    if (r.fatiga === 'verde') fatiga.verde++;
    if (r.fatiga === 'amarillo') fatiga.amarillo++;
    if (r.fatiga === 'rojo') fatiga.rojo++;
  }

  const objetivoRows = rows.filter((r) => r.objetivo_cumplido != null);
  const objetivoCumplidos = objetivoRows.filter((r) => r.objetivo_cumplido).length;

  const reglaRows = rows.filter((r) => r.regla_cumplida != null);
  const reglaCumplidas = reglaRows.filter((r) => r.regla_cumplida).length;

  return {
    trained,
    avgPuntaje,
    fatiga,
    objetivoRatio:
      objetivoRows.length > 0
        ? { done: objetivoCumplidos, of: objetivoRows.length }
        : null,
    reglaRatio:
      reglaRows.length > 0
        ? { done: reglaCumplidas, of: reglaRows.length }
        : null,
  };
}

function pickFirst<T>(rows: TaskRow[], field: keyof TaskRow): string | null {
  for (const r of rows) {
    const v = r[field];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const weekParam = request.nextUrl.searchParams.get('week');
  const anchor = weekParam ? parseISO(weekParam) : new Date();
  const thisFrom = startOfWeek(anchor, { weekStartsOn: 1 });
  const thisTo = endOfWeek(anchor, { weekStartsOn: 1 });
  const lastFrom = startOfWeek(subWeeks(anchor, 1), { weekStartsOn: 1 });
  const lastTo = endOfWeek(subWeeks(anchor, 1), { weekStartsOn: 1 });

  const { data } = await supabase
    .from('daily_tasks')
    .select(
      'fecha, entreno_check, fatiga, intensidad, puntaje, objetivo, objetivo_cumplido, regla, regla_cumplida, meta_entreno, aprendizajes, observaciones, notas'
    )
    .eq('user_id', user.id)
    .gte('fecha', format(lastFrom, 'yyyy-MM-dd'))
    .lte('fecha', format(thisTo, 'yyyy-MM-dd'))
    .order('fecha', { ascending: true });

  const rows = ((data as TaskRow[] | null) || []).slice();
  const thisWeekRows = rows.filter(
    (r) => r.fecha >= format(thisFrom, 'yyyy-MM-dd') && r.fecha <= format(thisTo, 'yyyy-MM-dd')
  );
  const lastWeekRows = rows.filter(
    (r) => r.fecha >= format(lastFrom, 'yyyy-MM-dd') && r.fecha <= format(lastTo, 'yyyy-MM-dd')
  );

  const days = eachDayOfInterval({ start: thisFrom, end: thisTo }).map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    const row = thisWeekRows.find((r) => r.fecha === key);
    return {
      fecha: key,
      entrenado: !!row?.entreno_check,
      fatiga: row?.fatiga ?? null,
      intensidad: row?.intensidad ?? null,
      puntaje: row?.puntaje ?? null,
      hasReflection: !!(row?.aprendizajes || row?.observaciones),
    };
  });

  const aprendizajes = thisWeekRows
    .filter((r) => r.aprendizajes && r.aprendizajes.trim())
    .map((r) => ({ fecha: r.fecha, text: (r.aprendizajes as string).trim() }));

  return NextResponse.json({
    week: {
      from: format(thisFrom, 'yyyy-MM-dd'),
      to: format(thisTo, 'yyyy-MM-dd'),
    },
    previousWeek: {
      from: format(lastFrom, 'yyyy-MM-dd'),
      to: format(lastTo, 'yyyy-MM-dd'),
    },
    days,
    summary: summarize(thisWeekRows),
    previousSummary: summarize(lastWeekRows),
    foco: {
      objetivo: pickFirst(thisWeekRows, 'objetivo'),
      regla: pickFirst(thisWeekRows, 'regla'),
      meta_entreno: pickFirst(thisWeekRows, 'meta_entreno'),
    },
    previousFoco: {
      objetivo: pickFirst(lastWeekRows, 'objetivo'),
      regla: pickFirst(lastWeekRows, 'regla'),
      meta_entreno: pickFirst(lastWeekRows, 'meta_entreno'),
    },
    aprendizajes,
  });
}
