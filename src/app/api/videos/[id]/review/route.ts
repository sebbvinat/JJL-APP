import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications';
import { sendEmail, brandedEmail } from '@/lib/email';
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
  const isRehacer = status === 'para_rehacer';
  const title = isRehacer
    ? 'Tu instructor pide un nuevo video'
    : 'Tu instructor reviso tu video';
  const message = feedback
    ? `"${updated.titulo}" — ${feedback.slice(0, 140)}${feedback.length > 140 ? '…' : ''}`
    : `"${updated.titulo}" revisado`;
  try {
    await createNotification(updated.user_id, 'system', title, message, '/upload');
  } catch (err) {
    logger.error('videos.review.notify.failed', { err, userId: updated.user_id });
  }

  // Email — best-effort. Sin RESEND_API_KEY simplemente no manda y sigue.
  // Es el canal "garantizado" cuando el push no llega (alumno con notifs
  // apagadas o en iOS sin PWA instalada).
  try {
    const { data: alumno } = await adminClient
      .from('users')
      .select('email, nombre')
      .eq('id', updated.user_id)
      .single<{ email: string | null; nombre: string | null }>();
    if (alumno?.email) {
      const cleanFeedback = feedback ? feedback.slice(0, 800) : '';
      const ctaUrl = 'https://alumno.jiujitsulatino.com/upload';
      await sendEmail({
        to: alumno.email,
        subject: isRehacer
          ? `${updated.titulo} — Tu instructor pide un nuevo video`
          : `${updated.titulo} — Tu instructor te dejó feedback`,
        html: brandedEmail({
          preheader: cleanFeedback ? cleanFeedback.slice(0, 80) : title,
          title,
          body: `
            <p style="margin:0 0 14px;">Hola${alumno.nombre ? ` ${alumno.nombre}` : ''},</p>
            <p style="margin:0 0 14px;">
              ${isRehacer
                ? `Mirá lo que te dejó tu instructor sobre <strong>"${updated.titulo}"</strong>. Te pide que subas una nueva versión:`
                : `Tu instructor revisó <strong>"${updated.titulo}"</strong>.`}
            </p>
            ${cleanFeedback ? `
              <div style="margin:18px 0;padding:14px 16px;background:#1a1a1a;border-left:3px solid #DC2626;border-radius:8px;color:#e5e5e5;white-space:pre-wrap;">${escapeHtml(cleanFeedback)}</div>
            ` : ''}
          `,
          ctaLabel: isRehacer ? 'Subir nuevo video' : 'Ver feedback completo',
          ctaUrl,
          signature: 'Equipo JJL · Si tenés dudas, respondé este mail.',
        }),
        replyTo: 'soporte@jiujitsulatino.com',
      });
    }
  } catch (err) {
    logger.error('videos.review.email.failed', { err, userId: updated.user_id });
  }

  return NextResponse.json({ success: true, status });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
