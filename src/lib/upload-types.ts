/**
 * Whitelist de tipos de archivo para subidas.
 *
 * La extensión NUNCA sale de `file.name`: ese texto lo controla quien sube y
 * `split('.').pop()` devuelve todo lo que siga al último punto, barras
 * incluidas. Con un nombre como `a.png/../../otro-bucket/victima.jpg` se
 * escribía sobre cualquier objeto del storage, porque las subidas usan
 * service-role con upsert. La extensión sale de este mapa o se rechaza.
 *
 * SVG queda deliberadamente afuera: un .svg servido desde el bucket ejecuta
 * scripts en el origen del storage (XSS almacenado).
 */
const IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heic',
};

const AUDIO_EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
};

/** Extensión segura para una imagen, o null si el tipo no está permitido. */
export function imageExtFor(mime: string | undefined | null): string | null {
  if (!mime) return null;
  return IMAGE_EXT_BY_MIME[mime.split(';')[0].trim().toLowerCase()] ?? null;
}

/** Extensión segura para un audio, o null si el tipo no está permitido. */
export function audioExtFor(mime: string | undefined | null): string | null {
  if (!mime) return null;
  return AUDIO_EXT_BY_MIME[mime.split(';')[0].trim().toLowerCase()] ?? null;
}

/**
 * Sufijo aleatorio para que la ruta del archivo no sea adivinable.
 *
 * La media del chat vive en un bucket público con URL permanente: sin esto la
 * ruta es `chat/<canal>/<timestamp>.jpg` y el timestamp se puede probar por
 * fuerza bruta. Con 8 bytes de entropía deja de ser enumerable.
 */
export function randomSuffix(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}
