'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';

// Tracks time spent in the app. Creates a session on mount,
// updates duration every 30s, and on page unload.
export default function SessionTracker() {
  const { authUser } = useUser();
  const sessionIdRef = useRef<string | null>(null);
  const startRef = useRef(Date.now());
  const pagesRef = useRef(1);

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

    startSession();

    // Update duration every 30s
    const interval = setInterval(async () => {
      if (!sessionIdRef.current) return;
      const duration = Math.round((Date.now() - startRef.current) / 1000);
      await (supabase as any)
        .from('user_sessions')
        .update({ duration_seconds: duration, pages_viewed: pagesRef.current })
        .eq('id', sessionIdRef.current);
    }, 30000);

    // Track page views
    const trackPageView = () => { pagesRef.current++; };
    window.addEventListener('popstate', trackPageView);

    // Final update on unload
    const handleUnload = () => {
      if (!sessionIdRef.current) return;
      const duration = Math.round((Date.now() - startRef.current) / 1000);
      navigator.sendBeacon(
        '/api/session/end',
        JSON.stringify({ sessionId: sessionIdRef.current, duration, pages: pagesRef.current })
      );
    };
    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handleUnload();
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('popstate', trackPageView);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [authUser]);

  return null;
}
