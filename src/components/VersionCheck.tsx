'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

export default function VersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let initialBuildId: string | null = null;
    let cancelled = false;

    async function checkVersion() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (!buildId || cancelled) return;

        if (!initialBuildId) {
          initialBuildId = buildId;
        } else if (buildId !== initialBuildId) {
          // Aviso, NO recarga automática. Antes recargaba sola a los 2s: si el
          // alumno estaba escribiendo el diario o un mensaje justo cuando salía
          // un deploy, perdía lo que había escrito sin poder evitarlo.
          setUpdateAvailable(true);
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
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
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
