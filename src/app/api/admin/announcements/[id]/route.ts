import { NextResponse, type NextRequest } from 'next/server';
import { verificarAdmin } from '@/lib/supabase/server';

// La auth va por `verificarAdmin` (central) y no a mano: el chequeo manual
// miraba solo `rol === 'admin'`, que el setter cumple (es rol='admin' + tag), y
// con eso podía editar o borrar anuncios. El helper lo rechaza por defecto y
// conserva los códigos de siempre: 401 sin sesión, 403 sin permiso.

// PATCH /api/admin/announcements/[id] — activar/desactivar.
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await verificarAdmin(request);
  if (!auth.ctx) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if (typeof body?.activa === 'boolean') patch.activa = body.activa;
  if (typeof body?.titulo === 'string') patch.titulo = body.titulo.trim();
  if (typeof body?.mensaje === 'string') patch.mensaje = body.mensaje.trim();
  if (['info', 'warning', 'critical'].includes(body?.importancia)) patch.importancia = body.importancia;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'sin cambios' }, { status: 400 });

  const { error } = await auth.ctx.admin.from('announcements').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/admin/announcements/[id] — eliminar.
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await verificarAdmin(request);
  if (!auth.ctx) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { error } = await auth.ctx.admin.from('announcements').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
