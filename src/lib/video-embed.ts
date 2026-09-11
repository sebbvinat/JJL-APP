/**
 * Convierte el link de un video en algo que se pueda embeber en un post.
 *
 * Los videos de la comunidad no se suben: se pega el link. Solo aceptamos
 * plataformas conocidas y armamos nosotros la URL del iframe a partir del id,
 * nunca usamos el link crudo como `src`. Si no, cualquiera podria meter un
 * iframe de cualquier sitio en el feed que ven todos los alumnos.
 */

export interface VideoEmbed {
  plataforma: 'youtube' | 'instagram' | 'vimeo';
  /** URL para el iframe, armada por nosotros. */
  embedUrl: string;
  /** Shorts y reels son verticales; el resto 16:9. */
  vertical: boolean;
}

export function videoEmbedDe(link: string | null | undefined): VideoEmbed | null {
  if (!link) return null;
  let u: URL;
  try {
    u = new URL(link.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');

  // YouTube: watch?v=ID, youtu.be/ID, shorts/ID, embed/ID
  const ytId = /^[A-Za-z0-9_-]{11}$/;
  if (host === 'youtube.com' || host === 'youtu.be') {
    let id: string | null = null;
    let vertical = false;
    if (host === 'youtu.be') {
      id = u.pathname.slice(1).split('/')[0];
    } else if (u.pathname === '/watch') {
      id = u.searchParams.get('v');
    } else {
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/);
      if (m) {
        id = m[2];
        vertical = m[1] === 'shorts';
      }
    }
    if (!id || !ytId.test(id)) return null;
    return { plataforma: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}`, vertical };
  }

  // Instagram: /p/CODIGO, /reel/CODIGO, /tv/CODIGO
  if (host === 'instagram.com') {
    const m = u.pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})/);
    if (!m) return null;
    const tipo = m[1] === 'reels' ? 'reel' : m[1];
    return {
      plataforma: 'instagram',
      embedUrl: `https://www.instagram.com/${tipo}/${m[2]}/embed`,
      vertical: true,
    };
  }

  // Vimeo: vimeo.com/NUMERO
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/(\d{5,12})/);
    if (!m) return null;
    return { plataforma: 'vimeo', embedUrl: `https://player.vimeo.com/video/${m[1]}`, vertical: false };
  }

  return null;
}
