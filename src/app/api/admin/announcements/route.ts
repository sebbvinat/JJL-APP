import { NextResponse, type NextRequest } from 'next/server';
import { verificarAdmin } from '@/lib/supabase/server';

// La auth va por `verificarAdmin` (central) y no a mano: el chequeo manual
// miraba solo `rol === 'admin'`, y el setter ES rol='admin' + tag, así que podía
// publicar un anuncio con push a TODOS los alumnos. El helper lo rechaza por
// defecto y conserva los códigos de siempre: 401 sin sesión, 403 sin permiso.

// GET /api/admin/announcements — lista todos los anuncios (admin).
export async function GET(request: NextRequest) {
  const auth = await verificarAdmin(request);
  if (!auth.ctx) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.ctx.admin
    .from('announcements')
    .select('id, titulo, mensaje, importancia, url, activa, created_at, expires_at')
    .order('created_at', { ascending: false });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ announcements: [], setupRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ announcements: data || [] });
}

// POST /api/admin/announcements — admin crea uno nuevo + (opcional) notifica.
export async function POST(request: NextRequest) {
  const auth = await verificarAdmin(request);
  if (!auth.ctx) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin, user } = auth.ctx;

  const body = await request.json();
  const titulo = String(body?.titulo || '').trim();
  const mensaje = String(body?.mensaje || '').trim();
  const importancia = ['info', 'warning', 'critical'].includes(body?.importancia) ? body.importancia : 'info';
  const url = body?.url ? String(body.url).trim() : null;
  const expires_at = body?.expires_at || null;

  if (!titulo || !mensaje) return NextResponse.json({ error: 'titulo y mensaje son obligatorios' }, { status: 400 });
  if (titulo.length > 200) return NextResponse.json({ error: 'titulo muy largo' }, { status: 400 });
  if (mensaje.length > 2000) return NextResponse.json({ error: 'mensaje muy largo' }, { status: 400 });

  const { data, error } = await admin
    .from('announcements')
    .insert({ titulo, mensaje, importancia, url, expires_at, created_by: user.id })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Crear notificacion (in-app + push) a todos los usuarios SIEMPRE.
  // El tipo 'anuncio' los hace aparecer con icono Megafono en la campanita.
  if (data?.id) {
    try {
      const { createNotification } = await import('@/lib/notifications');
      const { data: users } = await admin.from('users').select('id');
      for (const u of (users || []) as { id: string }[]) {
        await createNotification(u.id, 'anuncio', titulo, mensaje.slice(0, 140), url || '/dashboard');
      }
    } catch { /* silencioso */ }
  }

  return NextResponse.json({ success: true, id: data?.id });
}
