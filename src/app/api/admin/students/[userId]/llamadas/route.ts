import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ userId: string }> };

// GET /api/admin/students/[userId]/llamadas
export async function GET(request: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { data, error } = await auth.admin
    .from('llamadas')
    .select('id, tipo, scheduled_at, completed_at, duration_min, status, notes, meet_link, event_id, called_by, created_at, updated_at')
    .eq('user_id', userId)
    .order('scheduled_at', { ascending: false, nullsFirst: false });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ llamadas: [], setupRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolver nombre del admin que llamó
  type Row = { id: string; called_by: string | null };
  const rows = (data || []) as (Row & Record<string, unknown>)[];
  const callerIds = [...new Set(rows.map((r) => r.called_by).filter((id): id is string => !!id))];
  let names: Record<string, string> = {};
  if (callerIds.length > 0) {
    const { data: us } = await auth.admin.from('users').select('id, nombre').in('id', callerIds);
    (us || []).forEach((u: { id: string; nombre: string }) => { names[u.id] = u.nombre; });
  }

  return NextResponse.json({
    llamadas: rows.map((r) => ({ ...r, called_by_name: r.called_by ? names[r.called_by] || 'Admin' : null })),
  });
}

// POST /api/admin/students/[userId]/llamadas — body { tipo, scheduled_at?, duration_min?, notes?, meet_link? }
// (sin agendar evento — para agendar 1-on-1 completo usar /schedule-1on1)
export async function POST(request: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const tipo = String(body?.tipo || '1on1');
  const allowedTipos = new Set(['1on1', 'onboarding', 'setter', 'reactivacion', 'otro']);
  if (!allowedTipos.has(tipo)) return NextResponse.json({ error: 'tipo invalido' }, { status: 400 });

  const row: Record<string, unknown> = {
    user_id: userId,
    tipo,
    called_by: auth.user.id,
    status: body?.status || 'agendada',
  };
  if (body?.scheduled_at) row.scheduled_at = body.scheduled_at;
  if (typeof body?.duration_min === 'number') row.duration_min = body.duration_min;
  if (typeof body?.notes === 'string') row.notes = body.notes;
  if (typeof body?.meet_link === 'string') row.meet_link = body.meet_link;

  const { data, error } = await auth.admin
    .from('llamadas')
    .insert(row)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, llamada: data });
}

// PATCH /api/admin/students/[userId]/llamadas — body { id, status?, completed_at?, duration_min?, notes? }
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const id = String(body?.id || '');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.status === 'string') {
    const allowed = new Set(['agendada', 'completada', 'no_show', 'cancelada']);
    if (!allowed.has(body.status)) return NextResponse.json({ error: 'status invalido' }, { status: 400 });
    patch.status = body.status;
    if (body.status === 'completada' && !body?.completed_at) patch.completed_at = new Date().toISOString();
  }
  if (typeof body?.completed_at === 'string' || body?.completed_at === null) patch.completed_at = body.completed_at;
  if (typeof body?.duration_min === 'number') patch.duration_min = body.duration_min;
  if (typeof body?.notes === 'string') patch.notes = body.notes;
  if (typeof body?.meet_link === 'string') patch.meet_link = body.meet_link;

  const { error } = await auth.admin
    .from('llamadas')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
