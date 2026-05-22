import type { NextRequest } from 'next/server';

// Ruteo por dominio. Un mismo deploy sirve dos productos:
//  - 'alumno'  -> el programa de 6 meses (alumno.jiujitsulatino.com)
//  - 'cursos'  -> los cursos sueltos / instruccionales (jiujitsulatino.com)
//
// El segmento literal /cursos del route group permite, en dev/localhost,
// probar el sitio Cursos sin un hostname propio: jiujitsulatino.com/x se
// sirve internamente como /cursos/x vía rewrite en el middleware.

export type Site = 'cursos' | 'alumno';

export const CURSOS_HOSTS = [
  'jiujitsulatino.com',
  'www.jiujitsulatino.com',
  'cursos.localhost',
];

export const ALUMNO_HOSTS = [
  'alumno.jiujitsulatino.com',
  'alumno.localhost',
];

/** Hostname sin puerto, en minúscula. */
function hostnameOf(request: NextRequest): string {
  const raw = request.headers.get('host') ?? '';
  return raw.split(':')[0].toLowerCase();
}

/**
 * Decide qué producto sirve esta request.
 * Prioridad: NEXT_PUBLIC_SITE (dev) > hostname > prefijo de path /cursos (dev) > 'alumno'.
 *
 * En producción NEXT_PUBLIC_SITE debe quedar SIN setear: ambos dominios
 * pegan al mismo deploy y el ruteo es puramente por hostname. Hosts
 * desconocidos (previews *.vercel.app) caen en 'alumno'.
 */
export function getSiteFromRequest(request: NextRequest): Site {
  const forced = process.env.NEXT_PUBLIC_SITE;
  if (forced === 'cursos' || forced === 'alumno') return forced;

  const host = hostnameOf(request);
  if (CURSOS_HOSTS.includes(host)) return 'cursos';
  if (ALUMNO_HOSTS.includes(host)) return 'alumno';

  // Dev / localhost: permite probar el sitio Cursos con el prefijo /cursos.
  const { pathname } = request.nextUrl;
  if (pathname === '/cursos' || pathname.startsWith('/cursos/')) return 'cursos';

  return 'alumno';
}
