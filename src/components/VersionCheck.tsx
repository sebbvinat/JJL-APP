'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

// Interruptor de la recarga automática. Si llega a molestar (recargas en mal
// momento, algún bucle que no previmos) se apaga cambiando esta línea a
// `false` y pusheando: vuelve el comportamiento anterior, banner con botón y
// nada más.
const RECARGA_AUTOMATICA = true;

// Por qué recargar sola: después de un deploy, la pestaña abierta sigue con el
// JavaScript viejo y los archivos de esa versión ya no existen en el servidor.
// Al navegar a una pantalla que no había bajado, el alumno caía en "Algo salió
// mal". El banner solo no alcanza: en el celular casi nadie lo toca.
//
// 30 s de espera: le da tiempo a ver el banner y a terminar lo que esté
// haciendo, y si justo se puso a escribir lo detectamos antes de recargar.
const ESPERA_ANTES_DE_RECARGAR_MS = 30_000;
// Si tocó una tecla hace menos de esto, lo consideramos "escribiendo" aunque
// haya sacado el foco del campo (en el celular el foco se pierde al scrollear).
const SILENCIO_DE_ESCRITURA_MS = 10_000;
// Si tocó la pantalla (o una tecla) hace menos de esto, está usando la app y
// no recargamos. Hace falta porque hay trabajo que no pasa por ningún campo de
// texto: el diario se completa con botones (entrené, fatiga, puntaje) que viven
// en memoria, y el audio del chat se graba sin foco ni spinner. Como el deploy
// se detecta justo al volver a abrir la app, sin esta regla la recarga caía
// siempre en los primeros 30 s de uso. 2 minutos: más largo que casi cualquier
// audio y que el rato que uno se queda pensando qué escribir en el diario.
const SILENCIO_DE_INTERACCION_MS = 120_000;
// Señal explícita de "ahora no": cualquier pantalla puede marcar un bloque con
// este atributo mientras hace algo que una recarga rompería (grabar un audio).
const SELECTOR_NO_RECARGAR = '[data-no-recargar]';

// Marca anti-bucle: como mucho UNA recarga automática cada 10 minutos por
// pestaña. Después de recargar, la versión "inicial" pasa a ser la nueva y no
// debería haber más recargas; pero si /api/version llegara a alternar entre dos
// valores (deploy a medio propagar, respuesta cacheada) recargaríamos en cada
// chequeo. Con la marca, el peor caso es el banner de siempre.
const CLAVE_MARCA = 'jjl-recarga-version';
const VENTANA_ANTI_BUCLE_MS = 10 * 60 * 1000;

// Campos donde se puede perder texto. Se excluyen los que siempre tienen valor
// (checkbox/radio valen "on", range y color tienen default): si contaran, un
// solo click en un filtro bloquearía la recarga para siempre.
const TIPOS_SIN_TEXTO = new Set([
  'checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'image', 'hidden',
]);

function esCampoDeTexto(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !TIPOS_SIN_TEXTO.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

function textoDe(el: Element): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
  return el.textContent || '';
}

/** true si el cursor está en un campo (en el celular: teclado abierto). */
function hayFocoEnCampo(): boolean {
  const activo = document.activeElement;
  if (!activo) return false;
  return esCampoDeTexto(activo) || activo instanceof HTMLSelectElement;
}

/**
 * Borrador sin enviar: un campo en el que el alumno escribió, que sigue en
 * pantalla y sigue teniendo texto. Cubre el caso que la regla de los 10 s no
 * ve: escribió medio diario, soltó el celular un minuto, y una recarga se lo
 * borraría. Cuando envía, el formulario se vacía o se desmonta y deja de
 * contar. El costo es que un buscador con texto también frena la recarga en
 * esa pantalla — aceptable: queda el banner, como antes.
 */
function hayBorrador(camposTocados: Set<Element>): boolean {
  for (const campo of camposTocados) {
    if (!campo.isConnected) {
      camposTocados.delete(campo);
      continue;
    }
    if (textoDe(campo).trim() !== '') return true;
  }
  return false;
}

// Tipado local de lo poco que usamos de la API de iframes de YouTube (la carga
// CustomVideoPlayer). Se declara acá para no depender de tipos globales de
// otro archivo.
type ApiYouTube = {
  get?: (id: string) => { getPlayerState?: () => number } | undefined;
};

/**
 * true si hay un video empezado, o un reproductor del que no podemos saber.
 * Recargar en medio de una clase es la peor interrupción posible en esta app,
 * y PAUSADO cuenta como "en medio": el uso típico es pausar, ir a practicar la
 * técnica y volver. El reproductor no guarda por dónde iba, así que una
 * recarga lo devuelve al minuto cero.
 *  - <video> nativo: empezado y sin terminar.
 *  - Reproductor de las clases (YouTube vía API): YT.get(id) da el estado;
 *    1 = reproduciendo, 2 = pausado, 3 = cargando. Sin empezar (-1), en cola
 *    (5) o terminado (0) no frenan nada.
 *  - Cualquier otro iframe visible (Drive, Vimeo, Instagram en la comunidad):
 *    es otro origen y no se puede saber si está reproduciendo, así que ante la
 *    duda no recargamos.
 */
function hayAlgoReproduciendo(): boolean {
  if (document.fullscreenElement) return true;
  for (const video of Array.from(document.querySelectorAll('video'))) {
    if (!video.ended && (!video.paused || video.currentTime > 0)) return true;
  }
  const yt = (window as unknown as { YT?: ApiYouTube }).YT;
  for (const iframe of Array.from(document.querySelectorAll('iframe'))) {
    const caja = iframe.getBoundingClientRect();
    // Los iframes de 0×0 u ocultos son de medición, no reproductores.
    if (caja.width < 2 || caja.height < 2) continue;
    let estado: number | undefined;
    try {
      estado = iframe.id ? yt?.get?.(iframe.id)?.getPlayerState?.() : undefined;
    } catch {
      estado = undefined;
    }
    if (estado === undefined) return true; // no sabemos → no arriesgamos
    if (estado === 1 || estado === 2 || estado === 3) return true;
  }
  return false;
}

/**
 * true si hay algo guardándose. Todos los botones y pantallas de la app
 * muestran "cargando" con la clase `animate-spin`: si hay un spinner a la
 * vista, puede haber un pedido a medio camino (subir un video a la comunidad,
 * guardar el diario) y recargar lo cortaría.
 */
function hayAlgoGuardando(): boolean {
  return document.querySelector('.animate-spin, [aria-busy="true"]') !== null;
}

/** sessionStorage puede tirar (Safari privado, cookies bloqueadas). */
function recargoHacePoco(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_MARCA) || 0);
    return ultima > 0 && Date.now() - ultima < VENTANA_ANTI_BUCLE_MS;
  } catch {
    // Si no podemos leer la marca no podemos garantizar "una sola vez":
    // respondemos como si ya hubiéramos recargado, o sea, solo banner.
    return true;
  }
}

function dejarMarcaDeRecarga(): boolean {
  try {
    sessionStorage.setItem(CLAVE_MARCA, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export default function VersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let initialBuildId: string | null = null;
    let cancelled = false;
    let timerRecarga: ReturnType<typeof setTimeout> | null = null;
    // true cuando decidimos que en esta pestaña ya no se recarga sola (no hay
    // dónde dejar la marca anti-bucle, o ya recargamos hace poco).
    let recargaDescartada = false;
    let ultimaEscritura = 0;
    let ultimaInteraccion = 0;
    const camposTocados = new Set<Element>();

    function alInteractuar() {
      ultimaInteraccion = Date.now();
    }

    // Se escucha desde que monta y no recién cuando hay versión nueva: el
    // borrador puede venir de antes del deploy.
    function alEscribir(e: Event) {
      ultimaEscritura = Date.now();
      if (e.target instanceof Element && esCampoDeTexto(e.target)) {
        camposTocados.add(e.target);
        // Que el Set no crezca sin límite en sesiones largas (chat, comunidad).
        if (camposTocados.size > 30) hayBorrador(camposTocados);
      }
    }

    function intentarRecarga() {
      timerRecarga = null;
      if (cancelled) return;
      const ocupado =
        hayFocoEnCampo() ||
        Date.now() - ultimaEscritura < SILENCIO_DE_ESCRITURA_MS ||
        Date.now() - ultimaInteraccion < SILENCIO_DE_INTERACCION_MS ||
        document.querySelector(SELECTOR_NO_RECARGAR) !== null ||
        hayBorrador(camposTocados) ||
        hayAlgoReproduciendo() ||
        hayAlgoGuardando();
      if (ocupado) {
        // No es "nunca": cuando termine de escribir o de ver el video,
        // volvemos a mirar. Mientras tanto queda el banner como siempre.
        timerRecarga = setTimeout(intentarRecarga, ESPERA_ANTES_DE_RECARGAR_MS);
        return;
      }
      if (!dejarMarcaDeRecarga()) {
        recargaDescartada = true;
        return;
      }
      window.location.reload();
    }

    function programarRecarga() {
      if (!RECARGA_AUTOMATICA || recargaDescartada || timerRecarga !== null) return;
      if (recargoHacePoco()) {
        recargaDescartada = true;
        return;
      }
      timerRecarga = setTimeout(intentarRecarga, ESPERA_ANTES_DE_RECARGAR_MS);
    }

    async function checkVersion() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (!buildId || cancelled) return;

        if (!initialBuildId) {
          initialBuildId = buildId;
        } else if (buildId !== initialBuildId) {
          // Primero el aviso, siempre. La recarga automática va aparte y solo
          // si el alumno no está en el medio de algo: una versión anterior
          // recargaba sola a los 2 s sin mirar nada, y si estaba escribiendo
          // el diario o un mensaje justo cuando salía un deploy, lo perdía.
          setUpdateAvailable(true);
          programarRecarga();
        }
      } catch (err) {
        logger.debug('version.check.failed', { err });
      }
    }

    checkVersion();
    // Polling cada 5 min (antes era 60s — innecesariamente agresivo). El
    // chequeo en visibilitychange cubre "vuelvo después de horas" sin
    // gastar requests en background. Además ahora salteamos el tick del
    // setInterval si el tab está oculto: si estás haciendo otra cosa, no
    // tiene sentido chequear versión.
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      checkVersion();
    }, 300_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };
    document.addEventListener('visibilitychange', onVisible);
    if (RECARGA_AUTOMATICA) {
      // En captura: algunos componentes frenan la propagación de sus eventos.
      document.addEventListener('input', alEscribir, true);
      document.addEventListener('change', alEscribir, true);
      // pointerdown cubre dedo y mouse (incluye el arranque de un scroll);
      // keydown cubre teclado. Pasivos: solo anotan la hora, no frenan nada.
      document.addEventListener('pointerdown', alInteractuar, { capture: true, passive: true });
      document.addEventListener('keydown', alInteractuar, { capture: true, passive: true });
    }
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (timerRecarga !== null) clearTimeout(timerRecarga);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('input', alEscribir, true);
      document.removeEventListener('change', alEscribir, true);
      document.removeEventListener('pointerdown', alInteractuar, true);
      document.removeEventListener('keydown', alInteractuar, true);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-jjl-red text-white py-2.5 px-4 flex items-center justify-center gap-3 text-sm font-medium shadow-lg">
      <RefreshCw className="h-4 w-4 shrink-0" />
      <span>Hay una versión nueva de la app.</span>
      <button
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-md bg-white/20 hover:bg-white/30 px-3 py-1 text-[13px] font-semibold transition-colors"
      >
        Actualizar
      </button>
    </div>
  );
}
