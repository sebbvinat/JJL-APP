import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

function getSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
}
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function ensureAdmin(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { admin: null, error: 'No autenticado', status: 401 } as const;
  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as { rol?: string } | null)?.rol !== 'admin') {
    return { admin: null, error: 'No autorizado', status: 403 } as const;
  }
  return { admin: getAdminClient(), error: null, status: 200 } as const;
}

// PATCH /api/admin/announcements/[id] — activar/desactivar.
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await ensureAdmin(request);
  if (!auth.admin) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if (typeof body?.activa === 'boolean') patch.activa = body.activa;
  if (typeof body?.titulo === 'string') patch.titulo = body.titulo.trim();
  if (typeof body?.mensaje === 'string') patch.mensaje = body.mensaje.trim();
  if (['info', 'warning', 'critical'].includes(body?.importancia)) patch.importancia = body.importancia;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'sin cambios' }, { status: 400 });

  const { error } = await auth.admin.from('announcements').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/admin/announcements/[id] — eliminar.
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await ensureAdmin(request);
  if (!auth.admin) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { error } = await auth.admin.from('announcements').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
