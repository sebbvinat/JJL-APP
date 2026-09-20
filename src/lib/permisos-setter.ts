/**
 * Permisos del SETTER sobre los endpoints de admin (/api/admin/*).
 *
 * Por qué vive acá y no adentro del middleware: es una función PURA (sin
 * imports de Next ni de Supabase) para que la use el middleware en los dos
 * hosts y, además, se pueda testear sola con `npx tsx scripts/check-permisos.ts`.
 * Antes la lista estaba enterrada en middleware.ts y solo se aplicaba en el
 * host de alumnos: entrando por jiujitsulatino.com el setter se la salteaba.
 *
 * Criterio: deny-by-default. Un setter es rol='admin' + tags:['setter'] (o una
 * alumna con la marca), y solo opera el Kanban de /admin/agendas. Todo lo que
 * no esté en esta lista le queda cerrado, así una ruta nueva nace protegida en
 * lugar de nacer expuesta por olvido.
 *
 * Lo que el setter necesita hoy:
 *  - listar y editar leads, y las sub-rutas del lead (contacts, convert, mark-sale)
 *  - el resumen de ventas por lead (sales-summary)
 *  - todo lo de /api/admin/setter/* (agenda, followups, quiz-leads, guide-seen)
 *  - el dropdown de asignación: SOLO el GET de /api/admin/tags
 *
 * Segunda capa: `requireAdmin` (src/lib/supabase/server.ts) rechaza setters
 * salvo que la ruta pase `allowSetter: true`. Las dos listas tienen que
 * coincidir; scripts/check-permisos.ts lo verifica contra los archivos reales.
 */

/** Sub-rutas de un lead (/api/admin/leads/[id]/<subruta>) que el setter usa. */
const SUBRUTAS_DE_LEAD = ['contacts', 'convert', 'mark-sale'];

/**
 * Rutas que existieron bajo /api/admin/leads/ y se retiraron a propósito.
 *
 * Por qué hace falta nombrarlas: `/api/admin/leads/<algo>` es indistinguible
 * de `/api/admin/leads/[id]` (el id puede ser cualquier texto), así que
 * "deny-by-default" no las cubre solas. `commission-monthly` mostraba la
 * comisión del setter y el dueño decidió que no se muestre en la app: si
 * alguien la revive, que nazca cerrada para el setter.
 */
const RUTAS_DE_LEADS_RETIRADAS = ['commission-monthly'];

/**
 * Parte la ruta en segmentos ya decodificados.
 *
 * Por qué decodificar: `/api/%61dmin/analytics` no empieza con '/api/admin/'
 * si se compara el texto crudo, pero el router puede resolverla igual. Comparar
 * sobre la forma decodificada evita que el gate se saltee con un simple
 * percent-encoding. Si la ruta viene mal codificada, usamos el texto crudo (el
 * router la va a rechazar de todos modos).
 */
function segmentosDe(pathname: string): string[] {
  let ruta = pathname;
  try {
    ruta = decodeURIComponent(pathname);
  } catch {
    // Percent-encoding inválido: seguimos con el texto tal cual llegó.
  }
  return ruta.split('/').filter((s) => s.length > 0);
}

/**
 * ¿La ruta es un endpoint de admin? Tolerante a mayúsculas y a encoding a
 * propósito: ante la duda preferimos tratarla como admin (y que al setter le
 * aplique la lista blanca) antes que dejarla pasar sin gate.
 */
export function esApiDeAdmin(pathname: string): boolean {
  const segs = segmentosDe(pathname);
  return segs.length >= 2 && segs[0].toLowerCase() === 'api' && segs[1].toLowerCase() === 'admin';
}

/**
 * ¿Un setter puede usar este endpoint con este método?
 *
 * Solo opina sobre /api/admin/*: para cualquier otra ruta devuelve true,
 * porque esas no dependen de esta lista (cada una se autentica por su cuenta).
 */
export function setterPuedeUsar(pathname: string, method: string): boolean {
  if (!esApiDeAdmin(pathname)) return true;

  const segs = segmentosDe(pathname);
  // Un '..' que sobreviva hasta acá es un intento de escaparse del prefijo
  // permitido (p. ej. /api/admin/leads/../analytics): cerrado.
  if (segs.some((s) => s === '.' || s === '..')) return false;
  // A partir de acá la comparación es exacta y sensible a mayúsculas, igual que
  // el router de Next: '/api/admin/Leads' no es una ruta real, así que no
  // tiene por qué estar permitida.
  if (segs[0] !== 'api' || segs[1] !== 'admin') return false;

  const recurso = segs[2];
  const resto = segs.slice(3);
  const metodo = method.toUpperCase();

  if (recurso === 'leads') {
    // /api/admin/leads → listado del Kanban.
    if (resto.length === 0) return true;
    // /api/admin/leads/sales-summary o /api/admin/leads/[id].
    if (resto.length === 1) return !RUTAS_DE_LEADS_RETIRADAS.includes(resto[0]);
    // /api/admin/leads/[id]/<subruta>: solo las que el setter usa. Una sub-ruta
    // nueva nace cerrada hasta que alguien la sume acá a conciencia.
    if (resto.length === 2) return SUBRUTAS_DE_LEAD.includes(resto[1]);
    return false;
  }

  if (recurso === 'setter') {
    // Todo lo que vive bajo /api/admin/setter/ es, por definición, del setter.
    return resto.length >= 1;
  }

  if (recurso === 'tags') {
    // Solo lectura. Sin el gate de método, un setter se borra su propio tag
    // 'setter' con un PATCH y el panel deja de restringirlo: escalada a admin
    // pleno.
    return metodo === 'GET';
  }

  return false;
}
