import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/messages/[id]
 *
 * Borra un mensaje del chat privado. Solo admins — pueden borrar CUALQUIER
 * mensaje del hilo (propio o del alumno). Es un hard-delete: se borra la fila
 * y, si el mensaje era una foto/audio, también el archivo del storage para no
 * dejar huérfanos en el bucket.
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as { rol?: string } | null)?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Traer el mensaje para saber si tiene archivo asociado.
  const { data: msg } = await admin
    .from('messages')
    .select('id, contenido')
    .eq('id', id)
    .maybeSingle<{ id: string; contenido: string | null }>();

  if (!msg) return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });

  // Borrar la fila.
  const { error: delErr } = await admin.from('messages').delete().eq('id', id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // Best-effort: borrar el archivo del bucket si era audio/imagen. El path
  // dentro del bucket es lo que sigue a "/avatars/" en la URL pública.
  const contenido = msg.contenido || '';
  const isFile = contenido.startsWith('[audio]') || contenido.startsWith('[image]');
  if (isFile) {
    const url = contenido.replace(/^\[(audio|image)\]/, '');
    const marker = '/avatars/';
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const path = url.slice(idx + marker.length);
      try {
        await admin.storage.from('avatars').remove([path]);
      } catch { /* best-effort — la fila ya se borró, eso es lo importante */ }
    }
  }

  return NextResponse.json({ success: true });
}
