'use client';
import { useEffect } from 'react';
import { trackViewContent } from '@/lib/meta-pixel';

/**
 * Track de visitas a /ads. Misma estructura que /consultoria-gratuita pero
 * con source distinto para diferenciar en analytics interno + UTMs de Meta.
 */
export default function TrackAdsView() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('src') ?? params.get('utm_source') ?? 'ads';
    const body = JSON.stringify({ slug: 'ads', source });
    try {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon?.('/api/track-click', blob)) return;
    } catch {}
    fetch('/api/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }, []);

  // Meta Pixel ViewContent: el lead vio la landing MOFU. Sirve para audiencias
  // de retargeting + lookalikes en Meta.
  useEffect(() => {
    trackViewContent({
      content_name: 'Programa JJL Completo',
      content_category: 'mofu-ads',
      value: 900,
      currency: 'USD',
    });
  }, []);

  return null;
}
