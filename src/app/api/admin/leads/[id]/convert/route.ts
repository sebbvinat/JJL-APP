import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { darDeAltaAlumno } from '@/lib/alta-alumno';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/leads/[id]/convert
 * Body: { nombre, email, telefono?, planilla_id, meses_iniciales[], password? }
 *
 * Convierte un lead en alumno del programa. El alta en sí (cuenta, perfil,
 * planilla y meses desbloqueados) vive en `darDeAltaAlumno`, compartida con
 * /api/admin/alumnos — que es el mismo alta pero arrancando desde una
 * consultoría de Calendly, sin lead.
 *
 * Acá quedan solo las partes propias del lead: marcarlo convertido, dejarlo
 * vinculado al alumno (que es lo que permite saber de qué campaña salió) y
 * avisar por notificación.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id: leadId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const nombre = String(body?.nombre || '').trim();
  const telefono = body?.telefono ? String(body.telefono).trim() : null;

  const res = await darDeAltaAlumno(auth.admin, {
    nombre,
    email: String(body?.email || ''),
    planilla_id: String(body?.planilla_id || 'livianos'),
    meses_iniciales: Array.isArray(body?.meses_iniciales)
      ? body.meses_iniciales.filter((n: unknown) => typeof n === 'number')
      : [0, 1],
    password: body?.password ? String(body.password) : null,
  });

  if (res.error || !res.userId) {
    return NextResponse.json({ error: res.error || 'No se pudo convertir' }, { status: res.status || 500 });
  }

  const updates: Record<string, unknown> = {
    stage: 'convertido',
    converted_user_id: res.userId,
    booked: true,
    disqualified: false,
  };
  if (telefono) updates.telefono = telefono;
  await auth.admin.from('lead_quiz_responses').update(updates).eq('id', leadId);

  try {
    const { createNotification } = await import('@/lib/notifications');
    await createNotification(
      auth.user.id,
      'achievement',
      'Lead convertido',
      `${nombre} ahora es alumno del programa.`,
      `/admin/${res.userId}`,
    );
  } catch { /* silencioso */ }

  return NextResponse.json({ success: true, user_id: res.userId, lead_id: leadId });
}
