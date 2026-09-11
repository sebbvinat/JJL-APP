/**
 * Achica una foto en el navegador antes de subirla.
 *
 * Una foto de celular pesa 3 a 5 MB y el feed de la comunidad la muestra a
 * todos los alumnos. El plan de Supabase tiene un limite de trafico mensual
 * compartido con avatares y chat, asi que subir fotos crudas lo agotaba.
 * Lado mayor 1600px en JPEG al 82% alcanza para verla nitida en cualquier
 * pantalla y queda en ~200-400 KB.
 *
 * Si el navegador no puede leer la imagen (tipico: HEIC fuera de Safari),
 * devuelve el archivo original y que el servidor decida.
 */
const LADO_MAX = 1600;
const CALIDAD = 0.82;

export async function comprimirImagen(archivo: File): Promise<File> {
  // GIF animado: comprimirlo con canvas lo deja congelado en el primer cuadro.
  if (archivo.type === 'image/gif') return archivo;

  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return archivo;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', CALIDAD));
    if (!blob) return archivo;
    // Si por algun motivo quedo mas pesada (PNG chiquito, por ejemplo), va el original.
    if (blob.size >= archivo.size) return archivo;

    const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg' });
  } catch {
    return archivo;
  }
}
