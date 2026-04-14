import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications';
import { logger } from '@/lib/logger';

/**
 * POST /api/videos/[id]/review
 * Admin only. Marks a video as reviewed (or para_rehacer) with a short
 * feedback text and notifies the alumno.
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { user: admin, admin: adminClient } = ctx;

  const { id } = await context.params;
  const body = await request.json();
  const status: 'revisado' | 'para_rehacer' = body.status === 'para_rehacer' ? 'para_rehacer' : 'revisado';
  const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : '';

  const { data: updated, error } = await adminClient
    .from('video_uploads')
    .update({
      status,
      feedback_texto: feedback || null,
      feedback_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq('id', id)
    .select('user_id, titulo')
    .single<{ user_id: string; titulo: string }>();

  if (error || !updated) {
    logger.error('videos.review.failed', { err: error, id });
    return NextResponse.json(
      { error: error?.message || 'No se pudo actualizar' },
      { status: 500 }
    );
  }

  // Notify the alumno. Errors don't fail the review — the DB row is saved.
  try {
    const title =
      status === 'para_rehacer'
        ? 'Tu instructor pide un nuevo video'
        : 'Tu instructor reviso tu video';
    const message = feedback
      ? `"${updated.titulo}" — ${feedback.slice(0, 140)}${feedback.length > 140 ? '…' : ''}`
      : `"${updated.titulo}" revisado`;
    await createNotification(updated.user_id, 'system', title, message, '/upload');
  } catch (err) {
    logger.error('videos.review.notify.failed', { err, userId: updated.user_id });
  }

  return NextResponse.json({ success: true, status });
}
