import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ userId: string }> };

/**
 * POST /api/admin/students/[userId]/schedule-1on1
 * Body: { fecha_hora, duration_min?, meet_link?, mensaje? }
 *
 * 1. Inserta row en `llamadas` (tipo=1on1, status=agendada).
 * 2. Crea evento en `events` para que aparezca también en /events del alumno.
 * 3. Inserta event_rsvps con status=confirmed para el alumno.
 * 4. Notif al alumno.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const fecha_hora = String(body?.fecha_hora || '');
  const duration_min = typeof body?.duration_min === 'number' ? body.duration_min : 45;
  const meet_link = body?.meet_link ? String(body.meet_link).trim() : null;
  const mensaje = body?.mensaje ? String(body.mensaje).trim() : '';

  if (!fecha_hora) return NextResponse.json({ error: 'fecha_hora requerida' }, { status: 400 });
  if (Number.isNaN(new Date(fecha_hora).getTime())) {
    return NextResponse.json({ error: 'fecha_hora invalida' }, { status: 400 });
  }

  // Datos del alumno para el titulo del evento
  const { data: studentRow } = await auth.admin
    .from('users')
    .select('nombre')
    .eq('id', userId)
    .single();
  const studentName = (studentRow as { nombre?: string } | null)?.nombre || 'Alumno';

  const titulo = `1-on-1 con ${studentName}`;
  const descripcion = mensaje || 'Llamada 1-on-1 de seguimiento.';

  // 1. Insert en events
  const { data: ev, error: evErr } = await auth.admin
    .from('events')
    .insert({
      titulo,
      descripcion,
      fecha_hora,
      duracion_min: duration_min,
      meet_link,
      created_by: auth.user.id,
      // recurrencia / parent_event_id quedan null
    })
    .select('id')
    .single();
  if (evErr || !ev) {
    return NextResponse.json({ error: evErr?.message || 'Error creando evento' }, { status: 500 });
  }
  const event_id = (ev as { id: string }).id;

  // 2. Insert en llamadas
  const { data: lla, error: llaErr } = await auth.admin
    .from('llamadas')
    .insert({
      user_id: userId,
      tipo: '1on1',
      scheduled_at: fecha_hora,
      duration_min,
      meet_link,
      notes: mensaje || null,
      status: 'agendada',
      called_by: auth.user.id,
      event_id,
    })
    .select('id')
    .single();
  if (llaErr) {
    // Rollback evento? No es crítico, pero queda el evento huérfano. Lo logueamos.
    console.error('[schedule-1on1] llamadas insert failed', llaErr);
    return NextResponse.json({ error: llaErr.message }, { status: 500 });
  }
  const llamada_id = (lla as { id: string }).id;

  // 3. RSVP confirmed del alumno
  try {
    await auth.admin.from('event_rsvps').insert({
      event_id,
      user_id: userId,
      status: 'confirmed',
    });
  } catch { /* silencioso */ }

  // 4. Notif al alumno
  try {
    const { createNotification } = await import('@/lib/notifications');
    const fecha = new Date(fecha_hora).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
    await createNotification(
      userId,
      'system',
      'Llamada 1-on-1 agendada',
      `${fecha} (${duration_min} min)${meet_link ? ` · link: ${meet_link}` : ''}${mensaje ? ' · ' + mensaje : ''}`,
      '/events',
    );
  } catch { /* silencioso */ }

  return NextResponse.json({ success: true, event_id, llamada_id });
}
