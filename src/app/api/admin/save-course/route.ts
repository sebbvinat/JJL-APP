import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Admin: update a module's content (title, description, lessons).
 *
 * Body:
 *   { module_id, semana_numero, titulo, descripcion, lessons, userId? }
 *
 * - If `userId` is present → upsert that single student's row.
 * - If omitted → propagate the edit to ALL students that already have this
 *   module assigned (bulk update). This was the implicit intent of the
 *   previous (broken) `onConflict: 'module_id'` code.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { admin: adminClient } = ctx;

    const body = await request.json();
    const { module_id, semana_numero, titulo, descripcion, lessons, userId } = body as {
      module_id: string;
      semana_numero?: number;
      titulo: string;
      descripcion?: string;
      lessons?: unknown[];
      userId?: string;
    };

    if (!module_id || !titulo) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const payload = {
      semana_numero: semana_numero || 0,
      titulo,
      descripcion: descripcion || '',
      lessons: lessons || [],
      updated_at: new Date().toISOString(),
    };

    if (userId) {
      const { error } = await adminClient
        .from('course_data')
        .upsert(
          { user_id: userId, module_id, ...payload },
          { onConflict: 'user_id,module_id' }
        );
      if (error) {
        logger.error('admin.save-course.upsert.failed', { err: error, userId, module_id });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, scope: 'single', userId });
    }

    // No userId → propagate to every student that already has this module.
    const { data: affected, error: listErr } = await adminClient
      .from('course_data')
      .select('user_id')
      .eq('module_id', module_id);

    if (listErr) {
      logger.error('admin.save-course.list.failed', { err: listErr, module_id });
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const userIds = ((affected as Array<{ user_id: string }> | null) || []).map((r) => r.user_id);
    if (userIds.length === 0) {
      return NextResponse.json({ success: true, scope: 'none', count: 0 });
    }

    const { error: updateErr } = await adminClient
      .from('course_data')
      .update(payload)
      .eq('module_id', module_id);

    if (updateErr) {
      logger.error('admin.save-course.update.failed', { err: updateErr, module_id });
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, scope: 'all', count: userIds.length });
  } catch (err) {
    logger.error('admin.save-course.unhandled', { err });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
