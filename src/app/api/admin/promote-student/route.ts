import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/promote-student
 *
 * Promueve un usuario existente de `cliente_cursos` (compró un curso suelto)
 * a `alumno` del programa de 6 meses high-ticket. Pasa rol y
 * `program_member=true`; la planilla la asigna después el admin desde la
 * pantalla del alumno.
 *
 * Body: { userId }
 *
 * Solo promueve si el rol actual es `cliente_cursos`. Para cualquier otro
 * caso responde 400 — evita que un admin "promueva por accidente" a
 * alguien que ya es alumno (que sería un no-op pero confuso) o que toquen
 * a un admin.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { admin } = ctx;

  let body: { userId?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });

  const { data: current, error: lookupErr } = await admin
    .from('users')
    .select('id, rol, program_member, nombre, email')
    .eq('id', userId)
    .maybeSingle<{
      id: string; rol: string; program_member: boolean | null;
      nombre: string | null; email: string | null;
    }>();
  if (lookupErr) {
    logger.error('admin.promote.lookup.failed', { err: lookupErr, userId });
    return NextResponse.json({ error: 'No se pudo encontrar el usuario' }, { status: 500 });
  }
  if (!current) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  if (current.rol !== 'cliente_cursos') {
    return NextResponse.json({
      error: `El usuario es ${current.rol}, no se puede promover desde acá.`,
    }, { status: 400 });
  }

  const { error: updErr } = await admin
    .from('users')
    .update({ rol: 'alumno', program_member: true })
    .eq('id', userId);
  if (updErr) {
    logger.error('admin.promote.update.failed', { err: updErr, userId });
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  logger.info('admin.promote.success', { userId, email: current.email });
  return NextResponse.json({
    success: true,
    userId,
    nombre: current.nombre,
    email: current.email,
  });
}
