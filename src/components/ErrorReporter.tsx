'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * Captura global de errores del browser. Cualquier excepción no manejada o
 * promesa rechazada sin catch pasa por logger.error → en producción se
 * reporta a /api/client-errors y queda en Supabase con aviso a admins.
 *
 * Montado una sola vez en el root layout: cubre alumno, admin, cursos,
 * login y landing.
 */
export default function ErrorReporter() {
  useEffect(() => {
    function onError(e: ErrorEvent) {
      logger.error('window.onerror', {
        err: e.error instanceof Error ? e.error : new Error(e.message || 'unknown'),
      });
    }
    function onRejection(e: PromiseRejectionEvent) {
      logger.error('window.unhandledrejection', {
        err: e.reason instanceof Error ? e.reason : new Error(String(e.reason ?? 'unknown')),
      });
    }
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
