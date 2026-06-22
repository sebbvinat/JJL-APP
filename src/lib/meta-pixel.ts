// Helpers para disparar eventos custom del Meta Pixel.
//
// El script base se carga una sola vez en el root layout (MetaPixel.tsx).
// Estas funciones asumen que `window.fbq` ya está definido — pero degradan
// limpio si no (en dev sin pixel cargado, o si el browser bloquea Meta).

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export const META_PIXEL_ID = '1332189821762430';

function track(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq !== 'function') return; // no-op si no cargó
  try {
    if (params) window.fbq('track', eventName, params);
    else window.fbq('track', eventName);
  } catch {
    /* silent */
  }
}

/**
 * Lead: el visitante demuestra interés concreto.
 *  - Completar quiz (consultoria-gratuita o que-luchador-sos)
 *  - Agendar llamada en Calendly
 */
export function trackLead(params?: { content_name?: string; value?: number; currency?: string }) {
  track('Lead', params);
}

/**
 * ViewContent: visitante ve la página de venta del programa.
 * Usalo en la landing de consultoría — sirve para retargeting de "casi-leads".
 */
export function trackViewContent(params: { content_name: string; content_category?: string; value?: number; currency?: string }) {
  track('ViewContent', params);
}

/**
 * Purchase: completó la compra del programa.
 * Solo dispararlo en la página de gracias post-pago.
 */
export function trackPurchase(params: { value: number; currency: string }) {
  track('Purchase', params);
}

/**
 * CompleteRegistration: completó el onboarding del programa
 * (terminó los 5 pasos y entra al dashboard).
 */
export function trackCompleteRegistration() {
  track('CompleteRegistration');
}
