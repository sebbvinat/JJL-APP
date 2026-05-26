import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { computeMonthProgress, computeLastContactAt, MONTH_RANGES } from '@/lib/crm';
import { computeStudentHealth } from '@/lib/student-health';

type Ctx = { params: Promise<{ userId: string }> };

/**
 * GET /api/admin/students/[userId]/crm-summary
 * Endpoint todo-en-uno para el header CRM: lifecycle, started_at, días en
 * programa, último contacto, mes actual + progreso, próxima acción, alertas.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  // Profile básico
  const { data: profile } = await auth.admin
    .from('users')
    .select('id, nombre, email, avatar_url, cinturon_actual, rol, planilla_id, lifecycle_stage, lifecycle_changed_at, started_at, eligible_1on1_at, month_completed_log, program_member, tags, created_at')
    .eq('id', userId)
    .single();

  if (!profile) return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 });

  // Compute en paralelo
  const [monthSummary, lastContactAt] = await Promise.all([
    computeMonthProgress(auth.admin, userId),
    computeLastContactAt(auth.admin, userId),
  ]);

  const health = await computeStudentHealth(auth.admin, userId, {
    isEligibleFor1on1: monthSummary.isEligibleFor1on1,
  });

  // Días en programa (desde started_at o created_at)
  type Prof = { started_at?: string | null; created_at?: string; eligible_1on1_at?: string | null };
  const p = profile as unknown as Prof;
  const startIso = p.started_at || p.created_at || null;
  const daysInProgram = startIso ? Math.floor((Date.now() - new Date(startIso).getTime()) / 86_400_000) : null;
  const eligibleDays = p.eligible_1on1_at ? Math.floor((Date.now() - new Date(p.eligible_1on1_at).getTime()) / 86_400_000) : null;

  // Próxima acción sugerida
  const currentLabel = monthSummary.currentMes !== null
    ? MONTH_RANGES.find((b) => b.mes === monthSummary.currentMes)?.label || `Mes ${monthSummary.currentMes}`
    : 'Sin mes activo';
  const nextLabel = monthSummary.nextMes !== null
    ? MONTH_RANGES.find((b) => b.mes === monthSummary.nextMes)?.label || `Mes ${monthSummary.nextMes}`
    : null;

  let nextActionTitle: string;
  let nextActionDetail: string;
  if (monthSummary.isEligibleFor1on1) {
    nextActionTitle = `🎯 Listo para 1-on-1`;
    nextActionDetail = `${currentLabel} ${monthSummary.currentMesPercent}% completado. Agendá la llamada y desbloqueá ${nextLabel}.`;
  } else if (monthSummary.currentMes === null) {
    nextActionTitle = 'Sin mes asignado';
    nextActionDetail = 'El alumno no tiene módulos desbloqueados. Cargá planilla y desbloqueá Fundamentos.';
  } else if (monthSummary.nextMes === null) {
    nextActionTitle = '🎓 Programa completado';
    nextActionDetail = `${currentLabel} ${monthSummary.currentMesPercent}% completado. No hay próximo mes.`;
  } else {
    nextActionTitle = `${currentLabel} en curso`;
    nextActionDetail = `${monthSummary.currentMesPercent}% completado. Próximo: ${nextLabel} cuando llegue al 80%.`;
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      nombre: profile.nombre,
      email: profile.email,
      avatar_url: profile.avatar_url,
      cinturon_actual: profile.cinturon_actual,
      rol: profile.rol,
      planilla_id: profile.planilla_id,
      program_member: (profile as { program_member?: boolean }).program_member,
      tags: (profile as { tags?: string[] }).tags || [],
      lifecycle_stage: (profile as { lifecycle_stage?: string }).lifecycle_stage || 'prospect',
      lifecycle_changed_at: (profile as { lifecycle_changed_at?: string }).lifecycle_changed_at || null,
      started_at: startIso,
      created_at: p.created_at,
      eligible_1on1_at: p.eligible_1on1_at,
      eligible_days: eligibleDays,
      days_in_program: daysInProgram,
      last_contact_at: lastContactAt,
      month_completed_log: (profile as { month_completed_log?: unknown[] }).month_completed_log || [],
    },
    month: monthSummary,
    health,
    next_action: {
      title: nextActionTitle,
      detail: nextActionDetail,
      can_schedule_1on1: monthSummary.currentMes !== null,
      can_confirm_month: monthSummary.isEligibleFor1on1,
    },
  });
}
