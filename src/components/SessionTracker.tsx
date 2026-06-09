'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';

// Tracks time spent in the app.
//
// Antes hacíamos UPDATE cada 30s a Supabase — eso es 120 escrituras/hora
// por usuario activo. Con varios alumnos online eso quema egress del plan
// Free de Supabase y mete RAM en cliente por un setInterval ocioso.
//
// Ahora: 1 INSERT al montar, y 1 UPDATE solo cuando la pestaña se oculta
// o el alumno cierra la app (Beacon API → fire-and-forget, no bloquea).
// Si la sesión dura 1h sin interactuar nada, se persiste la duración
// final cuando finalmente cambia de tab o cierra.
export default function SessionTracker() {
  const { authUser } = useUser();
  const sessionIdRef = useRef<string | null>(null);
  const startRef = useRef(Date.now());
  const pagesRef = useRef(1);
  const finalizedRef = useRef(false);

  useEffect(() => {
    if (!authUser) return;

    const supabase = createClient();

    // Create session
    async function startSession() {
      const { data } = await (supabase as any)
        .from('user_sessions')
        .insert({ user_id: authUser!.id, pages_viewed: 1 })
        .select('id')
        .single();
      if (data) sessionIdRef.current = data.id;
    }

    void startSession();

    // Track page views via popstate (cuando navegan dentro de la SPA)
    const trackPageView = () => { pagesRef.current++; };
    window.addEventListener('popstate', trackPageView);

    // Finalizar la sesión enviando duración al endpoint Beacon. Idempotente
    // contra dobles disparos (visibilitychange + beforeunload pueden
    // dispararse seguidos).
    const finalize = () => {
      if (!sessionIdRef.current || finalizedRef.current) return;
      finalizedRef.current = true;
      const duration = Math.round((Date.now() - startRef.current) / 1000);
      try {
        navigator.sendBeacon(
          '/api/session/end',
          JSON.stringify({
            sessionId: sessionIdRef.current,
            duration,
            pages: pagesRef.current,
          }),
        );
      } catch { /* sendBeacon puede fallar en privacy modes */ }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') finalize();
    };
    window.addEventListener('beforeunload', finalize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('popstate', trackPageView);
      window.removeEventListener('beforeunload', finalize);
      document.removeEventListener('visibilitychange', onVisibility);
      // Best-effort si el componente se desmonta sin haber finalizado:
      finalize();
    };
  }, [authUser]);

  return null;
}
