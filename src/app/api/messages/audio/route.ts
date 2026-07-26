import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { audioExtFor, randomSuffix } from '@/lib/upload-types';

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const formData = await request.formData();
  const audio = formData.get('audio') as File | null;
  const channelId = formData.get('channelId') as string;

  if (!audio || !channelId) {
    return NextResponse.json({ error: 'Audio y channelId requeridos' }, { status: 400 });
  }

  // SEGURIDAD: el canal del chat es el user_id del alumno. Un alumno solo
  // puede escribir en su propio canal; los admins en cualquiera. Sin este
  // check, un alumno podía POSTear audios al hilo privado de otro pasando
  // su channelId (el endpoint de texto ya validaba esto, el de audio no).
  const { data: senderProfile } = await supabase
    .from('users')
    .select('rol, nombre')
    .eq('id', user.id)
    .single();
  const senderIsAdmin = (senderProfile as { rol?: string } | null)?.rol === 'admin';
  if (!senderIsAdmin && channelId !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Max 5MB audio
  if (audio.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Audio demasiado largo (max 5MB)' }, { status: 400 });
  }

  // Whitelist por MIME (mismo criterio que imágenes: la extensión nunca sale
  // del nombre del archivo, que lo controla el cliente).
  const audioType = (audio.type || '').split(';')[0].trim().toLowerCase();
  const ext = audioExtFor(audioType);
  if (!ext) {
    return NextResponse.json({ error: 'Formato de audio no permitido' }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Upload to storage. Guardamos con la extensión y contentType REALES del
  // archivo (iOS Safari graba audio/mp4, Chrome audio/webm) para que el
  // <audio> lo reproduzca en cualquier dispositivo. Antes se forzaba .webm,
  // que iOS no puede reproducir.
  const fileName = `chat/${channelId}/${Date.now()}-${randomSuffix()}.${ext}`;
  const buffer = Buffer.from(await audio.arrayBuffer());

  const { error: uploadError } = await adminClient.storage
    .from('avatars') // reuse existing bucket
    .upload(fileName, buffer, { contentType: audioType, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = adminClient.storage.from('avatars').getPublicUrl(fileName);
  const audioUrl = urlData.publicUrl;

  // Save message with audio URL prefix
  const { error: msgError } = await adminClient.from('messages').insert({
    from_user_id: user.id,
    to_user_id: channelId,
    contenido: `[audio]${audioUrl}`,
  });

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  // Push notification
  try {
    const { createNotification } = await import('@/lib/notifications');
    const { data: profile } = await supabase.from('users').select('nombre, rol').eq('id', user.id).single();
    const senderName = (profile as any)?.nombre || 'alguien';
    const isAdmin = (profile as any)?.rol === 'admin';

    if (isAdmin) {
      await createNotification(channelId, 'system', `Audio de ${senderName}`, 'Te enviaron un mensaje de voz', '/chat');
    } else {
      const { data: admins } = await adminClient.from('users').select('id').eq('rol', 'admin');
      for (const a of (admins || [])) {
        await createNotification(a.id, 'system', `Audio de ${senderName}`, 'Te enviaron un mensaje de voz', '/chat');
      }
    }
  } catch {}

  return NextResponse.json({ success: true, audioUrl });
}
