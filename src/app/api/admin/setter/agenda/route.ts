import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { agendaCalendly, calendlyConfigurada } from '@/lib/calendly';

/**
 * GET /api/admin/setter/agenda
 *
 * Consultorías agendadas en Calendly, de ahora en adelante.
 *
 * Va bajo /api/admin/setter/ a propósito: ese prefijo ya está en la whitelist
 * del middleware, así que el setter lo puede leer sin tocar la lista de rutas
 * permitidas.
 *
 * Query params:
 *   dias   — cuántos días hacia adelante mirar (default 30, máx 90)
 *   atras  — cuántos días hacia atrás incluir (default 0, máx 60)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  if (!calendlyConfigurada()) {
    // Sin token no es un error: es que falta configurarlo. El panel muestra
    // el aviso en vez de un cartel de error rojo.
    return NextResponse.json({ items: [], setupRequired: true });
  }

  const dias = Math.min(Math.max(Number(request.nextUrl.searchParams.get('dias')) || 30, 1), 90);

  // Días hacia ATRÁS. El calendario mensual los necesita: si solo trajéramos
  // lo que viene, el mes en curso aparecería con la primera mitad vacía como
  // si no hubiera habido consultorías.
  const atras = Math.min(Math.max(Number(request.nextUrl.searchParams.get('atras')) || 0, 0), 60);

  // Cuando no se piden días para atrás igual retrocedemos una hora, para que
  // la reunión que está pasando ahora mismo no desaparezca al empezar.
  const desde = new Date(Date.now() - (atras > 0 ? atras * 86_400_000 : 3600_000)).toISOString();
  const hasta = Date.now() + dias * 86_400_000;

  try {
    // 100 es el tope por página de Calendly. Al volumen actual (~15 por mes)
    // cubre de sobra los ~4 meses que pide el calendario.
    const todos = await agendaCalendly(desde, 100);
    const items = todos.filter((i) => new Date(i.inicio).getTime() <= hasta);
    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    );
  } catch (err) {
    console.error('[agenda] calendly failed', err);
    return NextResponse.json({ error: 'No se pudo leer la agenda de Calendly' }, { status: 502 });
  }
}
