'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, WifiOff } from 'lucide-react';
import { logger, esErrorDeRed } from '@/lib/logger';

/**
 * Pantalla de error global. Distingue tres causas porque cada una pide otra
 * cosa del alumno:
 *
 *  - Red (Safari "Load failed", Chrome "Failed to fetch", etc. — la lista vive
 *    en logger.ts): no es un bug. Pantalla amable de "perdiste conexión" y no
 *    se reporta.
 *  - Chunk que no carga: casi siempre es un DEPLOY en medio de la sesión. La
 *    pestaña abierta conoce los archivos de la versión vieja, que en el
 *    servidor ya no existen; al navegar a una pantalla que todavía no había
 *    bajado, el archivo da 404. Reintentar no sirve (vuelve a pedir el mismo
 *    archivo): lo único que lo arregla es recargar para traer la versión
 *    nueva. Por eso recargamos solos, UNA vez.
 *  - Cualquier otra cosa: bug real. Se reporta a /api/client-errors.
 */

// Cómo nombra cada navegador/bundler a "no pude bajar un pedazo de la app":
// Turbopack dice "Failed to load chunk", webpack "ChunkLoadError" / "Loading
// chunk N failed" / "Loading CSS chunk", y los import() nativos fallan con
// "Failed to fetch dynamically imported module" (Chrome), "error loading
// dynamically imported module" (Firefox) o "Importing a module script failed"
// (Safari).
const PATRON_CHUNK =
  /Failed to load chunk|ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i;

// Marca anti-bucle. Si la recarga no arregla el problema (el archivo falta de
// verdad, un bloqueador de anuncios lo frena, etc.) el error vuelve a saltar
// apenas carga la página; sin marca quedaríamos recargando para siempre.
//
// Guardamos la HORA de la recarga y no un '1' fijo: los alumnos dejan la app
// abierta días y hay varios deploys por día. Con un '1' que dura toda la
// sesión, solo el primer deploy se arreglaría solo y los siguientes volverían
// a mostrar la pantalla de error. Un bucle se repite en segundos, así que con
// una ventana de 5 minutos lo cortamos igual.
const CLAVE_MARCA = 'jjl-recarga-chunk';
const VENTANA_ANTI_BUCLE_MS = 5 * 60 * 1000;

type Pantalla = 'red' | 'actualizando' | 'actualizacion-fallida' | 'generico';

function esErrorDeChunk(error: Error): boolean {
  // `?.`: en JavaScript se puede tirar cualquier cosa (un string, null), y esta
  // pantalla es la última red: no puede romperse ella misma.
  return PATRON_CHUNK.test(error?.name || '') || PATRON_CHUNK.test(error?.message || '');
}

/**
 * Lee la marca y, si corresponde recargar, la deja escrita EN EL MISMO PASO.
 * Devuelve true solo si la marca quedó guardada, o sea, solo si podemos
 * GARANTIZAR que la recarga automática pasa una sola vez.
 *
 * sessionStorage puede tirar excepción (Safari en modo privado, cookies
 * bloqueadas, almacenamiento lleno). Si no podemos leer o escribir la marca no
 * hay forma de saber si ya recargamos, y preferimos mostrar el botón antes que
 * arriesgar un bucle.
 */
function reservarRecarga(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_MARCA) || 0);
    if (ultima > 0 && Date.now() - ultima < VENTANA_ANTI_BUCLE_MS) return false;
    sessionStorage.setItem(CLAVE_MARCA, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

// La decisión se toma UNA vez por error y se recuerda. Hace falta porque
// reservarRecarga() escribe la marca: en desarrollo React corre dos veces el
// inicializador del estado, y la segunda pasada leería la marca recién escrita
// y contestaría "ya recargué" para el mismo error.
const decisiones = new WeakMap<object, Pantalla>();

function elegirPantalla(error: Error): Pantalla {
  // WeakMap solo acepta objetos como clave (ver esErrorDeChunk: puede llegar
  // cualquier cosa).
  const esObjeto = typeof error === 'object' && error !== null;
  const previa = esObjeto ? decisiones.get(error) : undefined;
  if (previa) return previa;

  let pantalla: Pantalla;
  // Chunk va ANTES que red: "Failed to fetch dynamically imported module"
  // también matchea el patrón de red, y lo que lo arregla es recargar.
  if (esErrorDeChunk(error)) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      // Sin conexión, el chunk falló por la red y no por un deploy. Recargar
      // ahí empeora las cosas (cambia una pantalla con botón por la página
      // offline), así que lo tratamos como corte de red.
      pantalla = 'red';
    } else {
      pantalla = reservarRecarga() ? 'actualizando' : 'actualizacion-fallida';
    }
  } else {
    pantalla = esErrorDeRed(error) ? 'red' : 'generico';
  }
  if (esObjeto) decisiones.set(error, pantalla);
  return pantalla;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Se decide una sola vez, al montar. El error boundary solo se renderiza en
  // el navegador (en el servidor no hay boundaries), así que leer
  // sessionStorage acá no genera diferencias de hidratación.
  const [pantalla] = useState<Pantalla>(() => elegirPantalla(error));

  useEffect(() => {
    if (pantalla === 'actualizando') {
      // La marca anti-bucle ya quedó escrita en reservarRecarga().
      // Esperable después de cada deploy: consola sí, reporte al server no
      // (sería una alerta a los admins por cada push a main).
      console.warn('[error-boundary] chunk viejo, recargando', error.message);
      window.location.reload();
      return;
    }
    if (pantalla === 'red') {
      // Transitorio — log local para diagnóstico pero NO reportar al server.
      console.warn('[error-boundary] network', error.message);
      return;
    }
    // 'generico' o 'actualizacion-fallida'. Este último SÍ se reporta: si ya
    // recargamos y el chunk sigue sin cargar, hay algo roto de verdad (deploy
    // incompleto, archivo que falta) y conviene enterarse.
    // logger.error → en producción también reporta a /api/client-errors.
    logger.error('error-boundary', {
      err: error,
      digest: error.digest,
      ...(pantalla === 'actualizacion-fallida' ? { chunk: 'recarga-agotada' } : {}),
    });
  }, [error, pantalla]);

  if (pantalla === 'actualizando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-jjl-dark p-6">
        <div
          role="status"
          className="max-w-md w-full bg-jjl-gray border border-jjl-border rounded-2xl p-8 text-center"
        >
          <div className="mx-auto h-14 w-14 rounded-2xl border bg-jjl-red/15 border-jjl-red/30 flex items-center justify-center mb-5">
            <RefreshCw className="h-7 w-7 text-jjl-red animate-spin" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Hay una versión nueva, actualizando…</h1>
          <p className="text-sm text-jjl-muted">Es un segundo. No hace falta que toques nada.</p>
        </div>
      </div>
    );
  }

  const esRed = pantalla === 'red';
  const falloActualizar = pantalla === 'actualizacion-fallida';

  const titulo = esRed
    ? 'Perdimos la conexion'
    : falloActualizar
      ? 'No pudimos actualizar la app'
      : 'Algo salio mal';
  const texto = esRed
    ? 'No pudimos cargar esta pantalla. Reintentá en unos segundos cuando vuelvas a tener señal.'
    : falloActualizar
      ? 'Salió una versión nueva y esta pantalla no terminó de cargar. Tocá Actualizar; si sigue igual, cerrá la app y volvé a abrirla.'
      : 'Tuvimos un problema mostrando esta pantalla. Podes reintentar o volver al dashboard.';
  // Con un chunk viejo, reset() vuelve a pedir el mismo archivo que ya no
  // existe: lo único que sirve es recargar la página entera.
  const alTocarBoton = falloActualizar ? () => window.location.reload() : reset;

  return (
    <div className="min-h-screen flex items-center justify-center bg-jjl-dark p-6">
      <div className="max-w-md w-full bg-jjl-gray border border-jjl-border rounded-2xl p-8 text-center">
        <div className={`mx-auto h-14 w-14 rounded-2xl border flex items-center justify-center mb-5 ${
          esRed
            ? 'bg-amber-500/15 border-amber-500/30'
            : 'bg-jjl-red/15 border-jjl-red/30'
        }`}>
          {esRed
            ? <WifiOff className="h-7 w-7 text-amber-400" />
            : <AlertTriangle className="h-7 w-7 text-jjl-red" />}
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{titulo}</h1>
        <p className="text-sm text-jjl-muted mb-6">{texto}</p>
        {pantalla === 'generico' && error.digest && (
          <p className="text-[11px] text-jjl-muted/60 font-mono mb-4">id: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={alTocarBoton}
            className="px-4 py-2 bg-jjl-red hover:bg-jjl-red-hover text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {falloActualizar ? 'Actualizar' : 'Reintentar'}
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 bg-jjl-gray-light hover:bg-jjl-gray-light/70 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
