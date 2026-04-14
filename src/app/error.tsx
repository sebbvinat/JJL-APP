'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[error-boundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-jjl-dark p-6">
      <div className="max-w-md w-full bg-jjl-gray border border-jjl-border rounded-2xl p-8 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-jjl-red/15 border border-jjl-red/30 flex items-center justify-center mb-5">
          <AlertTriangle className="h-7 w-7 text-jjl-red" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Algo salio mal</h1>
        <p className="text-sm text-jjl-muted mb-6">
          Tuvimos un problema mostrando esta pantalla. Podes reintentar o volver al dashboard.
        </p>
        {error.digest && (
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
