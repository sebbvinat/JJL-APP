import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ userId: string }> };

// GET /api/admin/students/[userId]/notes
export async function GET(request: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { data, error } = await auth.admin
    .from('admin_notes')
    .select('id, texto, pinned, created_by, created_at, updated_at')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ notes: [], setupRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolver nombres de quien escribió (para mostrar en la UI)
  type Row = { id: string; texto: string; pinned: boolean; created_by: string | null; created_at: string; updated_at: string };
  const rows = (data || []) as Row[];
  const creatorIds = [...new Set(rows.map((r) => r.created_by).filter((id): id is string => !!id))];
  let names: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: us } = await auth.admin.from('users').select('id, nombre').in('id', creatorIds);
    (us || []).forEach((u: { id: string; nombre: string }) => { names[u.id] = u.nombre; });
  }

  return NextResponse.json({
    notes: rows.map((r) => ({ ...r, created_by_name: r.created_by ? names[r.created_by] || 'Admin' : null })),
  });
}

// POST /api/admin/students/[userId]/notes — body { texto, pinned? }
export async function POST(request: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const texto = String(body?.texto || '').trim();
  const pinned = !!body?.pinned;
  if (!texto) return NextResponse.json({ error: 'Texto requerido' }, { status: 400 });
  if (texto.length > 4000) return NextResponse.json({ error: 'Texto muy largo' }, { status: 400 });

  const { data, error } = await auth.admin
    .from('admin_notes')
    .insert({ user_id: userId, texto, pinned, created_by: auth.user.id })
    .select('id, texto, pinned, created_by, created_at, updated_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, note: data });
}

// PATCH /api/admin/students/[userId]/notes — body { id, texto?, pinned? }
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const id = String(body?.id || '');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.texto === 'string') patch.texto = body.texto.trim();
  if (typeof body?.pinned === 'boolean') patch.pinned = body.pinned;

  const { error } = await auth.admin
    .from('admin_notes')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/students/[userId]/notes?id=X
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { error } = await auth.admin
    .from('admin_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
