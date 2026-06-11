'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertTriangle, WifiOff } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Errores de red transitorios — Safari iOS dice "Load failed", Chrome
 * "Failed to fetch", Firefox "NetworkError". No son bugs: pasan cuando la
 * app se va a background, hay un microcorte de conexión, etc. Los
 * tratamos distinto: pantalla amable de "perdiste conexión" y no
 * reportamos a /api/client-errors (era ruido).
 */
function isNetworkError(error: Error): boolean {
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('load failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('the network connection was lost')
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isNetwork = isNetworkError(error);

  useEffect(() => {
    if (isNetwork) {
      // Transitorio — log local para diagnóstico pero NO reportar al server.
      console.warn('[error-boundary] network', error.message);
      return;
    }
    // logger.error → en producción también reporta a /api/client-errors.
    logger.error('error-boundary', { err: error, digest: error.digest });
  }, [error, isNetwork]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-jjl-dark p-6">
      <div className="max-w-md w-full bg-jjl-gray border border-jjl-border rounded-2xl p-8 text-center">
        <div className={`mx-auto h-14 w-14 rounded-2xl border flex items-center justify-center mb-5 ${
          isNetwork
            ? 'bg-amber-500/15 border-amber-500/30'
            : 'bg-jjl-red/15 border-jjl-red/30'
        }`}>
          {isNetwork
            ? <WifiOff className="h-7 w-7 text-amber-400" />
            : <AlertTriangle className="h-7 w-7 text-jjl-red" />}
        </div>
        <h1 className="text-xl font-bold text-white mb-2">
          {isNetwork ? 'Perdimos la conexion' : 'Algo salio mal'}
        </h1>
        <p className="text-sm text-jjl-muted mb-6">
          {isNetwork
            ? 'No pudimos cargar esta pantalla. Reintentá en unos segundos cuando vuelvas a tener señal.'
            : 'Tuvimos un problema mostrando esta pantalla. Podes reintentar o volver al dashboard.'}
        </p>
        {!isNetwork && error.digest && (
          <p className="text-[11px] text-jjl-muted/60 font-mono mb-4">id: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-jjl-red hover:bg-jjl-red-hover text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
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
