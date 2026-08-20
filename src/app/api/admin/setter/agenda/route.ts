import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { agendaCalendly, invitadosDe, buscarPorEmail, calendlyConfigurada } from '@/lib/calendly';

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

  // Modo búsqueda: las consultorías de una persona, por mail, sin límite de
  // fecha. Es la salida cuando la venta se cerró hace más de dos semanas y ya
  // no entra en la ventana del listado.
  const emailParam = (request.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  if (emailParam) {
    if (!/^[^@s]+@[^@s]+.[^@s]+$/.test(emailParam)) {
      return NextResponse.json({ error: 'Email inválido', items: [] }, { status: 400 });
    }
    try {
      const items = await buscarPorEmail(emailParam);
      return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, max-age=60' } });
    } catch (err) {
      console.error('[agenda] busqueda por email failed', err);
      return NextResponse.json({ error: 'No se pudo buscar en Calendly' }, { status: 502 });
    }
  }

  // Modo detalle: los datos de los invitados de un puñado de eventos (los de
  // un día). Va aparte del listado porque es una llamada a Calendly por
  // evento, y pedirlas todas juntas para el mes hacía que se cortaran.
  const idsParam = (request.nextUrl.searchParams.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9-]{6,64}$/.test(s))
    // 60: dos semanas cargadas dieron 44 consultorías y con tope de 40
    // quedaban 4 sin nombre, o sea sin poder darles de alta. Se piden de a 4
    // contra Calendly, así que a tope son ~3s.
    .slice(0, 60);

  if (idsParam.length > 0) {
    try {
      const invitados = await invitadosDe(idsParam);
      return NextResponse.json({ invitados }, { headers: { 'Cache-Control': 'private, max-age=60' } });
    } catch (err) {
      console.error('[agenda] invitados failed', err);
      return NextResponse.json({ error: 'No se pudieron leer los invitados' }, { status: 502 });
    }
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
