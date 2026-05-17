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
  } = body as {
    module_id?: string;
    lesson_id?: string;
    lesson_titulo_original?: string;
    youtube_id?: string;
    titulo?: string;
    descripcion?: string;
  };
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

  // Fetch every course_data row that has this module and has the lesson
  // with matching lesson_id inside its lessons array. We update each row's
  // lessons JSONB individually because Postgres JSONB array updates are
  // cleanest one row at a time.
  const { data: rows, error: readErr } = await admin
    .from('course_data')
    .select('user_id, module_id, lessons')
    .eq('module_id', module_id);
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

  for (const row of (rows as Array<{ user_id: string; module_id: string; lessons: unknown }> | null) || []) {
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
