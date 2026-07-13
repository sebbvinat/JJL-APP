import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/update-lesson-video
 * Body: { module_id, lesson_id, lesson_titulo_original?, youtube_id?, titulo?, descripcion? }
 *
 * Updates the youtube_id (and/or titulo, descripcion) of a specific lesson
 * for EVERY student that has the module in their course_data (via JSONB
 * array update). Lets the instructor fix broken YouTube links without a
 * deploy.
 *
 * Matching strategy: prefer lesson_id, fall back to lesson_titulo_original.
 * The /admin/videos editor still iterates MOCK_LESSONS whose lesson IDs
 * (les-4-2 etc.) don't match the planilla-generated IDs in DB rows
 * (livianos-s4-1 etc.), so titulo matching is what actually finds the row.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { admin } = ctx;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  const {
    module_id,
    lesson_id,
    lesson_titulo_original,
    youtube_id,
    titulo,
    descripcion,
    semana_numero,
  } = body as {
    module_id?: string;
    lesson_id?: string;
    lesson_titulo_original?: string;
    youtube_id?: string;
    titulo?: string;
    descripcion?: string;
    semana_numero?: number;
  };
  // Scope por semana: si el caller lo manda, SOLO tocamos lecciones de esa
  // semana. Evita que un título repetido en varias semanas (ej "Drill 1: Leg
  // Trap") se contamine entre semanas. Las semanas compartidas (mes 1-2) igual
  // aplican a las 4 planillas porque el scope es por semana, no por planilla.
  const scopeSemana = typeof semana_numero === 'number' ? semana_numero : null;
  if (!module_id || (!lesson_id && !lesson_titulo_original)) {
    return NextResponse.json(
      { error: 'module_id y lesson_id (o lesson_titulo_original) son requeridos' },
      { status: 400 },
    );
  }
  const patch: Record<string, string> = {};
  if (typeof youtube_id === 'string') patch.youtube_id = youtube_id;
  if (typeof titulo === 'string') patch.titulo = titulo;
  if (typeof descripcion === 'string') patch.descripcion = descripcion;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 });
  }

  // Traemos TODOS los course_data y matcheamos por lesson_id/titulo más abajo.
  // No filtramos por module_id porque quedó desalineado entre el editor
  // (mock-data), la planilla y los course_data viejos de los alumnos (el
  // "Mes 2" se reordenó y nunca se re-sincronizó). Filtrar por module_id hacía
  // que la edición no llegara a ningún alumno. La cohorte es chica, así que
  // escanear todas las filas es barato. Igual seguimos persistiendo el
  // override canónico para que /api/course-data lo aplique por titulo.
  const { data: rows, error: readErr } = await admin
    .from('course_data')
    .select('user_id, module_id, lessons, semana_numero');
  if (readErr) {
    logger.error('admin.updateLessonVideo.read.failed', { err: readErr });
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  type LessonJSON = { id: string; youtube_id?: string; titulo?: string; descripcion?: string; [k: string]: unknown };
  let updated = 0;

  // Normalize once for titulo fallback matching (case + diacritics insensitive).
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  const targetTituloNorm = lesson_titulo_original ? norm(lesson_titulo_original) : '';

  for (const row of (rows as Array<{ user_id: string; module_id: string; lessons: unknown; semana_numero: number | null }> | null) || []) {
    // Scope por semana: si el caller mandó semana_numero y esta fila es de OTRA
    // semana, la salteamos. Filas sin semana_numero (datos viejos) no se filtran
    // para no dejar de actualizarlas — usan el match por título como antes.
    if (scopeSemana !== null && row.semana_numero != null && row.semana_numero !== scopeSemana) {
      continue;
    }
    const lessons = Array.isArray(row.lessons) ? (row.lessons as LessonJSON[]) : [];
    let matchedIdx = -1;
    if (lesson_id) {
      matchedIdx = lessons.findIndex((l) => l && typeof l === 'object' && l.id === lesson_id);
    }
    if (matchedIdx === -1 && targetTituloNorm) {
      matchedIdx = lessons.findIndex(
        (l) =>
          l && typeof l === 'object' && typeof l.titulo === 'string' && norm(l.titulo) === targetTituloNorm,
      );
    }
    if (matchedIdx === -1) continue;
    const cur = lessons[matchedIdx];
    const diff = Object.entries(patch).some(([k, v]) => (cur as Record<string, unknown>)[k] !== v);
    if (!diff) continue;
    const next = lessons.slice();
    next[matchedIdx] = { ...cur, ...patch };

    const { error: updErr } = await admin
      .from('course_data')
      .update({ lessons: next, updated_at: new Date().toISOString() })
      .eq('user_id', row.user_id)
      .eq('module_id', row.module_id);
    if (updErr) {
      logger.error('admin.updateLessonVideo.write.failed', {
        err: updErr,
        userId: row.user_id,
        module_id,
      });
      continue;
    }
    updated++;
  }

  // Persistir SIEMPRE un override canónico, exista o no algún alumno con el
  // módulo. Así el video no se pierde al recargar ni al redeployar. La key
  // es el titulo normalizado (preferimos el original; si solo vino el id,
  // igual necesitamos un titulo — usamos el nuevo si cambió).
  const overrideKey = norm(lesson_titulo_original || titulo || '');
  if (overrideKey) {
    const overrideRow: Record<string, unknown> = {
      module_id,
      lesson_key: overrideKey,
      updated_at: new Date().toISOString(),
    };
    if (typeof youtube_id === 'string') overrideRow.youtube_id = youtube_id;
    if (typeof titulo === 'string') overrideRow.titulo = titulo;
    if (typeof descripcion === 'string') overrideRow.descripcion = descripcion;
    const { error: ovErr } = await admin
      .from('lesson_video_overrides')
      .upsert(overrideRow, { onConflict: 'module_id,lesson_key' });
    if (ovErr) {
      logger.error('admin.updateLessonVideo.override.failed', {
        err: ovErr,
        module_id,
        overrideKey,
      });
    }
  }

  return NextResponse.json({ updated });
}
