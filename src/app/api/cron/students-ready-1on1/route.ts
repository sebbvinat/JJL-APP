import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeMonthProgress } from '@/lib/crm';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/cron/students-ready-1on1
 * Cron diario (Vercel manda Authorization: Bearer ${CRON_SECRET}).
 *
 * Para cada alumno program_member en lifecycle 'active'|'onboarding':
 *   - Si isEligibleFor1on1 == true AND users.eligible_1on1_at IS NULL:
 *     setea eligible_1on1_at=NOW() + notifica a admins con tag 'soporte'.
 *   - Si lastActivity >= 14 días AND lifecycle='active':
 *     marca lifecycle='at_risk' + admin_note automática.
 *
 * Idempotente: no re-notifica a los ya marcados eligibles.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Pull alumnos elegibles del programa
  let students: { id: string; nombre: string; eligible_1on1_at: string | null; lifecycle_stage: string }[] = [];
  {
    const { data, error } = await admin
      .from('users')
      .select('id, nombre, eligible_1on1_at, lifecycle_stage')
      .eq('program_member', true)
      .neq('rol', 'admin')
      .in('lifecycle_stage', ['active', 'onboarding']);
    if (error) {
      if (/column .* does not exist/i.test(error.message)) {
        return NextResponse.json({ error: 'Migración CRM pendiente (lifecycle_stage column missing)' }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    students = (data || []) as typeof students;
  }

  const newlyEligible: { id: string; nombre: string }[] = [];
  const newlyAtRisk: { id: string; nombre: string; daysInactive: number }[] = [];
  const FOURTEEN_DAYS_MS = 14 * 86_400_000;
  const now = Date.now();

  for (const s of students) {
    try {
      const prog = await computeMonthProgress(admin, s.id);

      // 1) Eligibility para 1-on-1 (nuevos solamente — no re-notificar)
      if (prog.isEligibleFor1on1 && !s.eligible_1on1_at) {
        await admin.from('users').update({ eligible_1on1_at: new Date().toISOString() }).eq('id', s.id);
        newlyEligible.push({ id: s.id, nombre: s.nombre });
      }

      // 2) At-risk si inactivo 14+ días (solo si está 'active')
      if (s.lifecycle_stage === 'active' && prog.lastActivityAt) {
        const inactive = now - new Date(prog.lastActivityAt).getTime();
        if (inactive >= FOURTEEN_DAYS_MS) {
          await admin.from('users').update({
            lifecycle_stage: 'at_risk',
            lifecycle_changed_at: new Date().toISOString(),
          }).eq('id', s.id);
          await admin.from('admin_notes').insert({
            user_id: s.id,
            texto: `Marcado at_risk automáticamente: ${Math.floor(inactive / 86_400_000)} días sin actividad.`,
            pinned: false,
            // created_by null (sistema)
          });
          newlyAtRisk.push({ id: s.id, nombre: s.nombre, daysInactive: Math.floor(inactive / 86_400_000) });
        }
      }
    } catch (err) {
      console.error('[cron 1on1] error for student', s.id, err);
    }
  }

  // Notificar a admins de los nuevos elegibles
  if (newlyEligible.length > 0) {
    try {
      const { createNotification } = await import('@/lib/notifications');
      const { getAdminsByTag } = await import('@/lib/admin-tags');
      const adminIds = await getAdminsByTag(admin, 'soporte');
      const list = newlyEligible.map((s) => s.nombre).join(', ');
      for (const aid of adminIds) {
        await createNotification(
          aid,
          'system',
          `${newlyEligible.length} listo${newlyEligible.length === 1 ? '' : 's'} para 1-on-1`,
          list.slice(0, 140),
          '/admin',
        );
      }
    } catch (err) {
      console.error('[cron 1on1] notify failed', err);
    }
  }

  return NextResponse.json({
    success: true,
    scanned: students.length,
    newly_eligible: newlyEligible,
    newly_at_risk: newlyAtRisk,
  });
}
