import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser, createAdminSupabaseClient } from '@/lib/supabase/server';
import { imageExtFor, randomSuffix } from '@/lib/upload-types';

export const runtime = 'nodejs';

/**
 * POST /api/community/image
 *
 * Sube la foto de un post de la comunidad y devuelve su URL. El post se crea
 * despues, aparte, con esa URL: asi la foto se ve en la vista previa del
 * formulario antes de publicar, y si falla la subida no se pierde el texto.
 *
 * Mismo esquema que las fotos del chat: bucket `avatars`, tipo validado contra
 * la lista blanca (nunca por el nombre del archivo) y sufijo aleatorio para
 * que la ruta no se pueda adivinar.
 *
 * Body (multipart/form-data): { image: File }
 */
export async function POST(request: NextRequest) {
  const { user } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const formData = await request.formData();
  const image = formData.get('image') as File | null;
  if (!image) return NextResponse.json({ error: 'Falta la imagen' }, { status: 400 });

  // El formulario ya la comprime a ~300 KB. Este tope es para cuando la
  // compresion no se pudo hacer (ej. HEIC en un navegador que no lo lee) y
  // llega el original.
  if (image.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'La foto es muy pesada (máx 10 MB)' }, { status: 400 });
  }

  const tipo = (image.type || '').split(';')[0].trim().toLowerCase();
  const ext = imageExtFor(tipo);
  if (!ext) {
    return NextResponse.json({ error: 'Formato no permitido. Usá JPG, PNG o WEBP.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const ruta = `comunidad/${user.id}/${Date.now()}-${randomSuffix()}.${ext}`;
  const buffer = Buffer.from(await image.arrayBuffer());

  const { error } = await admin.storage
    .from('avatars')
    .upload(ruta, buffer, { contentType: tipo, upsert: false });
  if (error) {
    console.error('[community/image] fallo la subida', error);
    return NextResponse.json({ error: 'No se pudo subir la foto' }, { status: 500 });
  }

  const { data } = admin.storage.from('avatars').getPublicUrl(ruta);
  return NextResponse.json({ url: data.publicUrl });
}
