'use client';

import { useEffect, useRef } from 'react';

interface CalendlyEmbedProps {
  url: string;
  /**
   * Si viene, trackeamos la carga del widget contra el lead: cuando Calendly
   * emite `event_type_viewed` (cargó y se vio) y `date_and_time_selected`
   * (eligió día/hora) posteamos a /api/leads/calendly-event. Sirve para
   * medir si el delay de carga del iframe nos hace perder leads.
   * `event_scheduled` NO se manda: ya lo cubre el webhook de Calendly.
   */
  sessionId?: string;
}

export default function CalendlyEmbed({ url, sessionId }: CalendlyEmbedProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://assets.calendly.com/assets/external/widget.js"]'
    );
    if (existing) return;
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Fire-and-forget, una sola vez por evento (los refs sobreviven re-renders).
  const sentLoadedRef = useRef(false);
  const sentSelectedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    function track(event: 'loaded' | 'datetime_selected') {
      void fetch('/api/leads/calendly-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, event }),
        keepalive: true,
      }).catch(() => undefined);
    }

    function handler(e: MessageEvent) {
      // Solo mensajes del iframe de Calendly.
      if (!/^https:\/\/([a-z0-9-]+\.)*calendly\.com$/i.test(e.origin)) return;
      const data = e.data as { event?: unknown } | null;
      if (!data || typeof data.event !== 'string') return;

      if (data.event === 'calendly.event_type_viewed' && !sentLoadedRef.current) {
        sentLoadedRef.current = true;
        track('loaded');
      }
      if (data.event === 'calendly.date_and_time_selected' && !sentSelectedRef.current) {
        sentSelectedRef.current = true;
        track('datetime_selected');
      }
    }

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sessionId]);

  return (
    <div
      className="calendly-inline-widget"
      data-url={url}
      style={{ height: '640px', width: '100%', maxWidth: '100%' }}
    />
  );
}
