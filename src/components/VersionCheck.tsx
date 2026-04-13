'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function VersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let initialBuildId: string | null = null;

    async function checkVersion() {
      try {
        const res = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } });
        const html = await res.text();
        const match = html.match(/"buildId":"([^"]+)"/);
        const buildId = match?.[1] || null;

        if (!buildId) return;

        if (!initialBuildId) {
          initialBuildId = buildId;
        } else if (buildId !== initialBuildId) {
          // Auto-reload after 2 seconds (gives SW time to activate)
          setUpdateAvailable(true);
          setTimeout(() => window.location.reload(), 2000);
        }
      } catch {}
    }

    checkVersion();
    const interval = setInterval(checkVersion, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-jjl-red text-white text-center py-2.5 px-4 flex items-center justify-center gap-3 text-sm font-medium shadow-lg">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span>Actualizando...</span>
    </div>
  );
}
