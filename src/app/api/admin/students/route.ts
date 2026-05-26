import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { computeMonthProgress, computeLastContactAt, MONTH_RANGES } from '@/lib/crm';
import { computeStudentHealth } from '@/lib/student-health';

/**
 * GET /api/admin/students
 *   ?all=1     — incluye compradores de cursos sueltos (no solo program_member)
 *   ?enrich=1  — agrega lifecycle/CRM/health data por alumno (más caro)
 *
 * Sin enrich devuelve la shape simple histórica (compat con UI vieja).
 * Con enrich devuelve además: lifecycle_stage, started_at, days_in_program,
 * eligible_1on1_at, last_contact_at, notes_count, current_mes_label,
 * current_mes_percent, next_mes_label, is_eligible_1on1, days_since_activity,
 * top 3 alerts.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { admin: adminClient } = ctx;

    const all = request.nextUrl.searchParams.get('all') === '1';
    const enrich = request.nextUrl.searchParams.get('enrich') === '1';

    let q = adminClient
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (!all) q = q.eq('program_member', true);
    let { data: users, error: usersErr } = await q;
    if (usersErr && /column .* does not exist/i.test(usersErr.message)) {
      const fb = await adminClient.from('users').select('*').order('created_at', { ascending: false });
      users = fb.data;
    }
    type UserRow = Record<string, unknown> & { id: string; created_at?: string; rol?: string };
    const userRows = (users || []) as UserRow[];

    // unlocked_count (bulk)
    const { data: accessData } = await adminClient
      .from('user_access')
      .select('user_id, module_id')
      .eq('is_unlocked', true);
    const unlockedMap: Record<string, number> = {};
    (accessData || []).forEach((row: { user_id: string }) => {
      unlockedMap[row.user_id] = (unlockedMap[row.user_id] || 0) + 1;
    });

    // notes_count (bulk, solo si enrich)
    let notesMap: Record<string, number> = {};
    if (enrich) {
      try {
        const { data: notes } = await adminClient.from('admin_notes').select('user_id');
        (notes || []).forEach((n: { user_id: string }) => {
          notesMap[n.user_id] = (notesMap[n.user_id] || 0) + 1;
        });
      } catch { /* tabla no existe pre-migración */ }
    }

    // base students
    const baseStudents = userRows.map((u) => ({
      ...u,
      unlocked_count: unlockedMap[u.id] || 0,
      notes_count: notesMap[u.id] || 0,
    }));

    if (!enrich) {
      return NextResponse.json({ students: baseStudents });
    }

    // ENRICH: por cada alumno, compute health + month progress. Solo para
    // los program_member (no enriquecemos compradores de cursos sueltos).
    const enrichedStudents = await Promise.all(
      baseStudents.map(async (u) => {
        const isProgramMember = (u as { program_member?: boolean }).program_member === true;
        if (!isProgramMember || u.rol === 'admin') {
          return u;
        }
        try {
          const [month, lastContact] = await Promise.all([
            computeMonthProgress(adminClient, u.id),
            computeLastContactAt(adminClient, u.id),
          ]);
          const health = await computeStudentHealth(adminClient, u.id, {
            isEligibleFor1on1: month.isEligibleFor1on1,
          });
          const currentBlock = month.currentMes !== null ? MONTH_RANGES.find((b) => b.mes === month.currentMes) : null;
          const nextBlock = month.nextMes !== null ? MONTH_RANGES.find((b) => b.mes === month.nextMes) : null;
          const startedAt = (u as { started_at?: string | null; created_at?: string }).started_at || u.created_at || null;
          const daysInProgram = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 86_400_000) : null;
          return {
            ...u,
            last_contact_at: lastContact,
            days_in_program: daysInProgram,
            current_mes_label: currentBlock?.label || null,
            current_mes_percent: month.currentMesPercent,
            next_mes_label: nextBlock?.label || null,
            is_eligible_1on1: month.isEligibleFor1on1,
            days_since_activity: health.daysSinceActivity,
            alerts: health.alerts.slice(0, 3),
            health_streak: health.streak,
          };
        } catch (err) {
          console.error('[students enrich]', u.id, err);
          return u;
        }
      })
    );

    return NextResponse.json({ students: enrichedStudents });
  } catch (error) {
    console.error('Students list error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
