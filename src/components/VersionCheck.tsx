'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function VersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let initialBuildId: string | null = null;

    async function checkVersion() {
      try {
        // Next.js exposes build ID in the page source — we check if it changed
        const res = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } });
        const html = await res.text();
        const match = html.match(/"buildId":"([^"]+)"/);
        const buildId = match?.[1] || null;

        if (!buildId) return;

        if (!initialBuildId) {
          initialBuildId = buildId;
        } else if (buildId !== initialBuildId) {
          setUpdateAvailable(true);
        }
      } catch {}
    }

    // Check every 60 seconds
    checkVersion();
    const interval = setInterval(checkVersion, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-jjl-red text-white text-center py-2 px-4 flex items-center justify-center gap-3 text-sm font-medium shadow-lg">
      <span>Nueva version disponible</span>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors text-xs font-bold"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Actualizar
      </button>
    </div>
  );
}
