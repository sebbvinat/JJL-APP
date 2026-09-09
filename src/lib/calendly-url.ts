/**
 * Arma la URL del Calendly con lo que ya sabemos de la persona.
 *
 * - utm_content: el id de sesion. Calendly lo propaga al webhook
 *   `invitee.created`, y es lo que permite atar la agenda a la fila del lead.
 * - a4: el usuario de Instagram con el que entro. En Calendly esa es la
 *   pregunta "REF (no llenar)", que existe justamente para esto, no es
 *   obligatoria y el que agenda ni la ve.
 *
 * Sin esto la consultoria llega con nombre y mail pero sin forma de saber de
 * que cuenta de Instagram salio, que muchas veces es lo unico que tenemos.
 *
 * Vive aca y no dentro de un componente porque la usan los dos caminos que
 * terminan en el calendario: el formulario largo y la agenda rapida.
 */
export function withSession(url: string, sessionId: string, instagram?: string | null): string {
  const handle = (instagram || '').trim().replace(/^@/, '');
  try {
    const u = new URL(url);
    u.searchParams.set('utm_content', sessionId);
    if (handle) u.searchParams.set('a4', `@${handle}`);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    const extra = handle ? `&a4=${encodeURIComponent('@' + handle)}` : '';
    return `${url}${sep}utm_content=${encodeURIComponent(sessionId)}${extra}`;
  }
}

/** El link del Calendly de la consultoria, con el tema oscuro ya aplicado. */
export const CALENDLY_URL =
  'https://calendly.com/jiujitsulatino/45m?hide_event_type_details=1&hide_gdpr_banner=1&background_color=1a1a1a&text_color=ffffff&primary_color=dc2626';
