import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Admin: update a module's content (title, description, lessons).
 *
 * Body:
 *   { module_id, semana_numero, titulo, descripcion, lessons, userId?, planilla_id? }
 *
 * - Con `userId` → upsert de la fila de ESE alumno.
 * - Sin `userId` → propaga a los alumnos de `planilla_id`. `planilla_id` es
 *   OBLIGATORIO en ese caso: sin él, el update pisaba las 4 planillas con el
 *   contenido de una sola.
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
      planilla_id?: string;
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

    // Sin userId → propagar. PERO acotado a UNA planilla.
    //
    // Antes se hacía `.update(payload).eq('module_id', module_id)` a secas: el
    // contenido cargado desde el editor (que sale de la fila de UN alumno) se
    // escribía sobre las CUATRO planillas. Un coach corrigiendo un título
    // podía meter lecciones de simbio en livianos/medios/atléticos y dejar el
    // progreso de esos alumnos apuntando a ids inexistentes.
    //
    // La planilla objetivo viene del body; si no viene, la deducimos de la
    // fila de referencia que se está editando.
    const targetPlanilla =
      typeof body?.planilla_id === 'string' && body.planilla_id.trim()
        ? body.planilla_id.trim()
        : null;

    if (!targetPlanilla) {
      return NextResponse.json(
        {
          error:
            'Falta planilla_id. Guardar sin planilla afectaría a los 4 curriculums a la vez.',
        },
        { status: 400 },
      );
    }

    // Usuarios de ESA planilla que ya tienen el módulo.
    const { data: planillaUsers, error: usersErr } = await adminClient
      .from('users')
      .select('id')
      .eq('planilla_id', targetPlanilla);

    if (usersErr) {
      logger.error('admin.save-course.users.failed', { err: usersErr, targetPlanilla });
      return NextResponse.json({ error: usersErr.message }, { status: 500 });
    }

    const userIds = ((planillaUsers as Array<{ id: string }> | null) || []).map((r) => r.id);
    if (userIds.length === 0) {
      return NextResponse.json({ success: true, scope: 'none', count: 0 });
    }

    const { error: updateErr } = await adminClient
      .from('course_data')
      .update(payload)
      .eq('module_id', module_id)
      .in('user_id', userIds);

    if (updateErr) {
      logger.error('admin.save-course.update.failed', { err: updateErr, module_id });
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      scope: 'planilla',
      planilla_id: targetPlanilla,
      count: userIds.length,
    });
  } catch (err) {
    logger.error('admin.save-course.unhandled', { err });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
