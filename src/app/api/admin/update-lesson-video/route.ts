import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/update-lesson-video
 * Body: { module_id: string, lesson_id: string, youtube_id: string }
 *
 * Updates the youtube_id of a specific lesson for EVERY student that has
 * the module in their course_data (via JSONB array update). Lets the
 * instructor fix broken YouTube links without a deploy.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { admin } = ctx;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  const { module_id, lesson_id, youtube_id, titulo, descripcion } = body as {
    module_id?: string;
    lesson_id?: string;
    youtube_id?: string;
    titulo?: string;
    descripcion?: string;
  };
  if (!module_id || !lesson_id) {
    return NextResponse.json({ error: 'module_id y lesson_id son requeridos' }, { status: 400 });
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

  for (const row of (rows as Array<{ user_id: string; module_id: string; lessons: unknown }> | null) || []) {
    const lessons = Array.isArray(row.lessons) ? (row.lessons as LessonJSON[]) : [];
    let changed = false;
    const next = lessons.map((l) => {
      if (l && typeof l === 'object' && l.id === lesson_id) {
        const diff = Object.entries(patch).some(([k, v]) => (l as Record<string, unknown>)[k] !== v);
        if (diff) {
          changed = true;
          return { ...l, ...patch };
        }
      }
      return l;
    });
    if (!changed) continue;

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

  return NextResponse.json({ updated });
}
