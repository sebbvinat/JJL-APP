import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';

/**
 * Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to requests from
 * its cron runner cuando la env var CRON_SECRET está seteada. Rechazamos
 * cualquier otra cosa.
 *
 * - Si no hay CRON_SECRET → 500 (no dejamos el cron abierto por accidente).
 * - La comparación del Bearer es timing-safe (crypto.timingSafeEqual).
 * - `x-vercel-cron: 1` se acepta como fallback porque Vercel lo setea en
 *   invocaciones programadas y lo STRIPEA de requests externas entrantes,
 *   así que no es spoofeable desde afuera. Permite además invocar a mano
 *   con el Bearer para tests.
 */
export function requireCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET no configurado' },
      { status: 500 }
    );
  }

  if (request.headers.get('x-vercel-cron') === '1') return null;

  const header = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  // timingSafeEqual exige buffers de igual longitud → comparamos longitud
  // primero (no es secreto) y después el contenido en tiempo constante.
  const ok =
    header.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  if (!ok) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  return null;
}
