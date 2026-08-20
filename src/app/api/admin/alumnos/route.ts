import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { darDeAltaAlumno } from '@/lib/alta-alumno';

/**
 * POST /api/admin/alumnos
 * Body: { nombre, email, planilla_id, meses_iniciales[], password?, lead_id? }
 *
 * Da de alta un alumno del programa SIN necesitar un lead. Es el camino que
 * se usa desde una consultoría de Calendly: ahí la persona figura con nombre
 * y mail reales, mientras que los leads solo guardan el Instagram y no se
 * pueden encontrar por mail.
 *
 * `lead_id` es opcional: si viene, además se marca ese lead como convertido
 * y queda vinculado, que es lo que permite saber de qué campaña salió.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const meses = Array.isArray(body.meses_iniciales)
    ? (body.meses_iniciales as unknown[]).filter((n): n is number => typeof n === 'number')
    : [0, 1];

  const res = await darDeAltaAlumno(auth.admin, {
    nombre: String(body.nombre || ''),
    email: String(body.email || ''),
    planilla_id: String(body.planilla_id || 'livianos'),
    meses_iniciales: meses,
    password: body.password ? String(body.password) : null,
  });

  if (res.error || !res.userId) {
    return NextResponse.json({ error: res.error || 'No se pudo crear' }, { status: res.status || 500 });
  }

  const leadId = body.lead_id ? String(body.lead_id) : null;
  if (leadId) {
    await auth.admin
      .from('lead_quiz_responses')
      .update({ stage: 'convertido', converted_user_id: res.userId, booked: true, disqualified: false })
      .eq('id', leadId);
  }

  try {
    const { createNotification } = await import('@/lib/notifications');
    await createNotification(
      auth.user.id,
      'achievement',
      'Alumno creado',
      `${String(body.nombre || '').trim()} ya tiene acceso al programa.`,
      `/admin/${res.userId}`,
    );
  } catch { /* silencioso */ }

  return NextResponse.json({ success: true, user_id: res.userId, reutilizada: !!res.reutilizada });
}
