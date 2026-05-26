import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/leads/[id]
// Body: { stage?, assigned_to?, disqualified? }
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if (typeof body?.stage === 'string') {
    const allowed = new Set(['nuevo', 'contactado', 'agendado', 'no_show', 'convertido', 'descartado']);
    if (!allowed.has(body.stage)) return NextResponse.json({ error: 'stage invalido' }, { status: 400 });
    patch.stage = body.stage;
    // si pasa a 'descartado', set disqualified=true para compat con UI vieja
    if (body.stage === 'descartado') patch.disqualified = true;
  }
  if (body?.assigned_to === null || typeof body?.assigned_to === 'string') patch.assigned_to = body.assigned_to;
  if (typeof body?.disqualified === 'boolean') patch.disqualified = body.disqualified;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'sin cambios' }, { status: 400 });

  const { error } = await auth.admin.from('lead_quiz_responses').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
