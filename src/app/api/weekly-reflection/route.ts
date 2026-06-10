import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/weekly-reflection
 *
 * Persiste la reflexión semanal del alumno. Histórico: el componente
 * WeeklyReflection tenía un "TODO: Save to Supabase" desde el scaffolding
 * inicial — los alumnos escribían sus dos respuestas y el texto se perdía
 * al recargar. Este endpoint cierra ese agujero.
 *
 * Guardamos en journal_entries con kind='nota' (el CHECK de la tabla solo
 * permite aprendizaje|observacion|nota — no agregamos un kind nuevo para
 * no requerir migración). El prefijo "Reflexión Semana N" la hace
 * buscable en la biblioteca y visible en el timeline del admin.
 *
 * Body: { weekNumber: number, answer1: string, answer2: string, fecha?: 'yyyy-MM-dd' }
 */
export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  let body: { weekNumber?: number; answer1?: string; answer2?: string; fecha?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const answer1 = (body.answer1 || '').trim();
  const answer2 = (body.answer2 || '').trim();
  if (!answer1 || !answer2) {
    return NextResponse.json({ error: 'Las dos respuestas son obligatorias' }, { status: 400 });
  }

  const weekLabel =
    typeof body.weekNumber === 'number'
      ? body.weekNumber === 0
        ? 'Fundamentos'
        : `Semana ${body.weekNumber}`
      : 'Semana';

  const text = [
    `Reflexión ${weekLabel}`,
    `¿Cómo te sentiste con el entrenamiento?: ${answer1}`,
    `¿Qué te costó más y qué salió mejor?: ${answer2}`,
  ].join('\n');

  // fecha es la fecha LOCAL del alumno si la manda; si no, NULL (nota suelta).
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(body.fecha || '') ? body.fecha : null;

  const { error } = await supabase.from('journal_entries').insert({
    user_id: user.id,
    kind: 'nota',
    text,
    fecha,
  });

  if (error) {
    logger.error('weekly_reflection.insert.failed', { userId: user.id, err: error });
    return NextResponse.json({ error: 'No pudimos guardar la reflexión' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
