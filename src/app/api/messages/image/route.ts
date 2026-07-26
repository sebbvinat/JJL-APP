import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { imageExtFor, randomSuffix } from '@/lib/upload-types';

export const runtime = 'nodejs';

/**
 * POST /api/messages/image
 *
 * Sube una foto al chat privado. Espeja el endpoint de audio:
 *  - El canal es el user_id del alumno. Un alumno solo puede escribir en su
 *    propio canal; los admins en cualquiera.
 *  - Se guarda en el bucket `avatars` bajo chat/<channelId>/<ts>.<ext> y el
 *    mensaje queda como `[image]<url>` (mismo esquema que `[audio]<url>`).
 *
 * Body (multipart/form-data): { image: File, channelId: string }
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const formData = await request.formData();
  const image = formData.get('image') as File | null;
  const channelId = formData.get('channelId') as string;

  if (!image || !channelId) {
    return NextResponse.json({ error: 'Imagen y channelId requeridos' }, { status: 400 });
  }

  const { data: senderProfile } = await supabase
    .from('users')
    .select('rol, nombre')
    .eq('id', user.id)
    .single();
  const senderIsAdmin = (senderProfile as { rol?: string } | null)?.rol === 'admin';
  if (!senderIsAdmin && channelId !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Max 10MB — fotos de celular sin comprimir entran holgadas.
  if (image.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Imagen demasiado grande (máx 10MB)' }, { status: 400 });
  }

  // Whitelist por MIME. `startsWith('image/')` dejaba pasar image/svg+xml,
  // que servido desde el bucket ejecuta scripts en el origen del storage.
  const imageType = (image.type || '').split(';')[0].trim().toLowerCase();
  const ext = imageExtFor(imageType);
  if (!ext) {
    return NextResponse.json(
      { error: 'Formato no permitido. Usá JPG, PNG o WEBP.' },
      { status: 400 },
    );
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Sufijo aleatorio: el bucket es público y la URL permanente, así que sin
  // esto la ruta (canal + timestamp) es adivinable por fuerza bruta.
  const fileName = `chat/${channelId}/${Date.now()}-${randomSuffix()}.${ext}`;
  const buffer = Buffer.from(await image.arrayBuffer());

  const { error: uploadError } = await adminClient.storage
    .from('avatars') // reuse existing bucket (igual que audio)
    .upload(fileName, buffer, { contentType: imageType, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = adminClient.storage.from('avatars').getPublicUrl(fileName);
  const imageUrl = urlData.publicUrl;

  const { error: msgError } = await adminClient.from('messages').insert({
    from_user_id: user.id,
    to_user_id: channelId,
    contenido: `[image]${imageUrl}`,
  });

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  // Push notification
  try {
    const { createNotification } = await import('@/lib/notifications');
    const senderName = (senderProfile as { nombre?: string } | null)?.nombre || 'alguien';

    if (senderIsAdmin) {
      await createNotification(channelId, 'system', `Foto de ${senderName}`, 'Te enviaron una foto', '/chat');
    } else {
      const { data: admins } = await adminClient.from('users').select('id').eq('rol', 'admin');
      for (const a of (admins || [])) {
        await createNotification(a.id, 'system', `Foto de ${senderName}`, 'Te enviaron una foto', '/chat');
      }
    }
  } catch { /* best-effort */ }

  return NextResponse.json({ success: true, imageUrl });
}
