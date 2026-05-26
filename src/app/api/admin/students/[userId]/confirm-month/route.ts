import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { computeMonthProgress, MONTH_RANGES } from '@/lib/crm';

type Ctx = { params: Promise<{ userId: string }> };

/**
 * POST /api/admin/students/[userId]/confirm-month
 * Body: { mes?: number, llamada_id?: string }
 *
 * Si `mes` se omite, usa el currentMes calculado.
 * Acciones:
 *  1. Desbloquea TODOS los módulos del mes siguiente (user_access.is_unlocked=TRUE).
 *  2. Push entry a users.month_completed_log con {mes, confirmado_at, confirmed_by, llamada_id}.
 *  3. SET users.eligible_1on1_at=NULL.
 *  4. Notif al alumno.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const llamada_id: string | null = body?.llamada_id || null;

  // Calcular currentMes + nextMes
  const progress = await computeMonthProgress(auth.admin, userId);
  const mesParam = typeof body?.mes === 'number' ? body.mes : progress.currentMes;
  if (mesParam === null || mesParam === undefined) {
    return NextResponse.json({ error: 'No se pudo determinar mes actual' }, { status: 400 });
  }
  const mesCompletado: number = mesParam;
  const nextMes = mesCompletado + 1;
  const nextBlock = MONTH_RANGES.find((b) => b.mes === nextMes);

  // Lookup módulos a desbloquear: course_data del alumno con semana_numero en nextBlock.semanas
  let unlockedModuleIds: string[] = [];
  if (nextBlock) {
    const { data: courseRows } = await auth.admin
      .from('course_data')
      .select('module_id, semana_numero')
      .eq('user_id', userId)
      .in('semana_numero', nextBlock.semanas);
    unlockedModuleIds = ((courseRows as { module_id: string }[] | null) || []).map((r) => r.module_id);
  }

  // Upsert user_access para esos módulos
  if (unlockedModuleIds.length > 0) {
    const rows = unlockedModuleIds.map((module_id) => ({
      user_id: userId,
      module_id,
      is_unlocked: true,
      unlocked_at: new Date().toISOString(),
    }));
    const { error: accErr } = await auth.admin
      .from('user_access')
      .upsert(rows, { onConflict: 'user_id,module_id' });
    if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
  }

  // Update users: append month_completed_log + clear eligible_1on1_at
  const { data: userRow } = await auth.admin
    .from('users')
    .select('month_completed_log, nombre')
    .eq('id', userId)
    .single();
  const log = Array.isArray((userRow as { month_completed_log?: unknown[] } | null)?.month_completed_log)
    ? (userRow as { month_completed_log: unknown[] }).month_completed_log
    : [];
  const newEntry = {
    mes: mesCompletado,
    confirmado_at: new Date().toISOString(),
    confirmed_by: auth.user.id,
    llamada_id,
    unlocked_module_ids: unlockedModuleIds,
  };
  await auth.admin
    .from('users')
    .update({
      month_completed_log: [...log, newEntry],
      eligible_1on1_at: null,
    })
    .eq('id', userId);

  // Notif al alumno
  try {
    const { createNotification } = await import('@/lib/notifications');
    const nextLabel = nextBlock?.label || 'el próximo mes';
    if (unlockedModuleIds.length > 0) {
      await createNotification(
        userId,
        'module',
        `Se desbloqueó ${nextLabel}`,
        `Ya tenés acceso al contenido nuevo. ¡A entrenar!`,
        '/modules',
      );
    }
  } catch { /* silencioso */ }

  return NextResponse.json({
    success: true,
    mes_completado: mesCompletado,
    next_mes: nextMes,
    next_label: nextBlock?.label || null,
    unlocked_count: unlockedModuleIds.length,
  });
}
