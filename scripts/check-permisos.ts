/**
 * Verifica los permisos del SETTER. Correr desde la raíz del repo:
 *
 *   npx tsx scripts/check-permisos.ts
 *
 * Termina en 0 e imprime "OK" si está todo bien; si no, lista qué falló y
 * termina en 1. No toca la base ni la red: es pura lectura de archivos.
 *
 * Por qué existe: los permisos del setter viven en DOS capas que tienen que
 * decir lo mismo, y nada lo controlaba:
 *   1. la lista blanca del middleware  -> src/lib/permisos-setter.ts
 *   2. `allowSetter: true` en cada ruta -> requireAdmin (src/lib/supabase/server.ts)
 * Si se desincronizan pasa una de dos cosas malas: el setter se queda sin algo
 * que usa (403 en su pantalla), o una ruta nueva le queda abierta sin que nadie
 * lo haya decidido. Este script compara las dos capas contra los archivos
 * reales de src/app/api/admin, así que también ataja rutas nuevas.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve, sep } from 'path';
import { esApiDeAdmin, setterPuedeUsar } from '../src/lib/permisos-setter';

const fallas: string[] = [];
let chequeos = 0;

function esperar(descripcion: string, obtenido: boolean, esperado: boolean) {
  chequeos++;
  if (obtenido !== esperado) {
    fallas.push(`${descripcion}: esperaba ${esperado ? 'PERMITIDO' : 'PROHIBIDO'} y dio ${obtenido ? 'PERMITIDO' : 'PROHIBIDO'}`);
  }
}

function permitido(method: string, ruta: string) {
  esperar(`${method} ${ruta}`, setterPuedeUsar(ruta, method), true);
}

function prohibido(method: string, ruta: string) {
  esperar(`${method} ${ruta}`, setterPuedeUsar(ruta, method), false);
}

// ---------------------------------------------------------------------------
// 1. Casos fijos: lo que el setter usa hoy en /admin/agendas.
// ---------------------------------------------------------------------------
permitido('GET', '/api/admin/leads');
permitido('PATCH', '/api/admin/leads/x');
permitido('GET', '/api/admin/leads/x/contacts');
permitido('POST', '/api/admin/leads/x/contacts');
permitido('POST', '/api/admin/leads/x/convert');
permitido('POST', '/api/admin/leads/x/mark-sale');
permitido('GET', '/api/admin/leads/sales-summary');
permitido('GET', '/api/admin/setter/agenda');
permitido('GET', '/api/admin/setter/followups');
permitido('POST', '/api/admin/setter/followups');
permitido('GET', '/api/admin/setter/quiz-leads');
permitido('POST', '/api/admin/setter/guide-seen');
permitido('GET', '/api/admin/tags');
// Con query string no debería llegar nunca (el middleware pasa solo el
// pathname), pero una barra final sí puede aparecer.
permitido('GET', '/api/admin/leads/');

// ---------------------------------------------------------------------------
// 2. Casos fijos: lo que el setter NO puede tocar.
// ---------------------------------------------------------------------------
// El PATCH de tags es la escalada más directa: se saca la marca y queda admin pleno.
prohibido('PATCH', '/api/admin/tags');
prohibido('POST', '/api/admin/tags');
prohibido('DELETE', '/api/admin/tags');
prohibido('POST', '/api/admin/update-role');
prohibido('GET', '/api/admin/analytics');
prohibido('POST', '/api/admin/alumnos');
prohibido('GET', '/api/admin/soporte');
prohibido('GET', '/api/admin/soporte/abc');
prohibido('POST', '/api/admin/sync-planillas');
prohibido('GET', '/api/admin/announcements');
prohibido('DELETE', '/api/admin/announcements/abc');
prohibido('POST', '/api/admin/link-drive-folder');
prohibido('POST', '/api/admin/import-drive-video');
prohibido('GET', '/api/admin/student-diary');
prohibido('POST', '/api/admin/delete-user');
prohibido('GET', '/api/admin/students');
prohibido('POST', '/api/admin/ventas/sync');
// La ruta de comisión se borró (la comisión no se muestra en la app). Cae bajo
// el prefijo de leads, así que tiene que estar cerrada explícitamente por si
// alguien la revive.
prohibido('GET', '/api/admin/leads/commission-monthly');
// Sub-rutas de un lead que no existen hoy: nacen cerradas.
prohibido('GET', '/api/admin/leads/x/cualquier-cosa');
prohibido('GET', '/api/admin/leads/x/contacts/extra');
// Parecidos que no son lo mismo.
prohibido('GET', '/api/admin/leadsx');
prohibido('GET', '/api/admin/setter');
prohibido('GET', '/api/admin/setterx/agenda');
prohibido('GET', '/api/admin');
prohibido('GET', '/api/admin/');

// ---------------------------------------------------------------------------
// 3. Trucos de URL: ninguno tiene que abrir una ruta cerrada.
// ---------------------------------------------------------------------------
prohibido('GET', '/api/%61dmin/analytics'); // 'a' con percent-encoding
prohibido('GET', '/api/admin/%61nalytics');
prohibido('GET', '/API/ADMIN/analytics'); // mayúsculas
prohibido('GET', '/api/admin/leads/../analytics'); // escaparse del prefijo
prohibido('GET', '/api/admin/leads/%2e%2e/analytics');
prohibido('GET', '/api/admin/leads%2F..%2Fanalytics');
prohibido('GET', '//api//admin//analytics'); // barras repetidas
prohibido('PATCH', '/api/admin/tags/'); // barra final no cambia el método
prohibido('patch', '/api/admin/tags'); // método en minúscula

chequeos++;
if (!esApiDeAdmin('/api/%61dmin/analytics')) {
  fallas.push('esApiDeAdmin no reconoce /api/%61dmin/analytics: el gate del middleware se saltea con percent-encoding');
}
chequeos++;
if (esApiDeAdmin('/api/leads/quiz') || esApiDeAdmin('/admin/agendas') || esApiDeAdmin('/api/administracion')) {
  fallas.push('esApiDeAdmin marca como admin una ruta que no lo es: el gate bloquearía de más');
}
// Fuera de /api/admin la lista blanca no opina (cada ruta se autentica sola).
permitido('GET', '/api/auth/me');
permitido('POST', '/api/leads/quiz');
permitido('GET', '/admin/agendas');

// ---------------------------------------------------------------------------
// 4. Las dos capas contra los archivos reales.
// ---------------------------------------------------------------------------
const RAIZ_ADMIN = resolve(process.cwd(), 'src/app/api/admin');

/**
 * Rutas que dejan pasar al setter SIN usar `allowSetter` (hacen la auth a
 * mano). Hoy es solo tags: el GET alimenta el dropdown de asignación de leads.
 */
const EXCEPCIONES_POR_METODO: Record<string, Record<string, boolean>> = {
  '/api/admin/tags': { GET: true, PATCH: false },
};

/**
 * Rutas de admin que todavía hacen la auth a mano en vez de usar
 * requireAdmin / verificarAdmin. Están relevadas: para el setter las cierra el
 * middleware. Una ruta NUEVA que no use el helper central hace fallar el
 * script, a propósito: a mano es como nacieron los agujeros que cerró WP-01.
 */
const AUTH_A_MANO_CONOCIDAS = [
  // A propósito: deja pasar al setter en GET (dropdown de asignación).
  '/api/admin/tags',
  // Pendientes de migrar al helper central (quedaron fuera de WP-01). Miran
  // solo `rol === 'admin'`, así que para el setter dependen del middleware.
  '/api/admin/sync-drive-videos',
  '/api/admin/youtube-oauth/callback',
  '/api/admin/google-oauth/callback',
];

function listarRutas(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const completo = join(dir, nombre);
    if (statSync(completo).isDirectory()) salida.push(...listarRutas(completo));
    else if (nombre === 'route.ts') salida.push(completo);
  }
  return salida;
}

if (!existsSync(RAIZ_ADMIN)) {
  fallas.push(`No encuentro ${RAIZ_ADMIN}. Corré el script desde la raíz del repo.`);
} else {
  const archivos = listarRutas(RAIZ_ADMIN);
  if (archivos.length < 20) {
    // Si de golpe hay muy pocas, el recorrido está roto y el chequeo no vale.
    fallas.push(`Solo encontré ${archivos.length} rutas bajo src/app/api/admin: el recorrido de archivos está mal.`);
  }

  for (const archivo of archivos) {
    const partes = relative(RAIZ_ADMIN, archivo).split(sep).slice(0, -1);
    const patron = '/api/admin/' + partes.join('/');
    // Un [param] se prueba con un valor cualquiera, como lo haría un id real.
    const ruta = '/api/admin/' + partes.map((p) => (p.startsWith('[') ? 'abc123' : p)).join('/');
    const codigo = readFileSync(archivo, 'utf8');

    const metodos = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].filter((m) =>
      new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(codigo),
    );
    const declaraSetter = /allowSetter:\s*true/.test(codigo);
    const usaHelperCentral = /\b(requireAdmin|verificarAdmin)\(/.test(codigo);

    chequeos++;
    if (!usaHelperCentral && !AUTH_A_MANO_CONOCIDAS.includes(patron)) {
      fallas.push(
        `${patron}: no usa requireAdmin/verificarAdmin. Las rutas de admin se autentican con el helper central (rechaza setters por defecto).`,
      );
    }

    for (const metodo of metodos) {
      const excepcion = EXCEPCIONES_POR_METODO[patron]?.[metodo];
      const esperado = excepcion ?? declaraSetter;
      chequeos++;
      const obtenido = setterPuedeUsar(ruta, metodo);
      if (obtenido !== esperado) {
        fallas.push(
          esperado
            ? `${metodo} ${patron}: la ruta declara allowSetter pero la lista blanca (permisos-setter.ts) la cierra -> al setter le daría 403.`
            : `${metodo} ${patron}: la lista blanca la abre pero la ruta NO declara allowSetter -> capas desincronizadas.`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
if (fallas.length > 0) {
  console.error(`FALLÓ: ${fallas.length} de ${chequeos} chequeos`);
  for (const f of fallas) console.error(' - ' + f);
  process.exit(1);
}
console.log(`OK (${chequeos} chequeos)`);
