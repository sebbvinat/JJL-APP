import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/leads/[id]/contacts → historial
export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireAdmin(_request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { data, error } = await auth.admin
    .from('lead_contacts')
    .select('id, canal, direccion, nota, hecho_por, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ contacts: [], setupRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = { id: string; hecho_por: string | null };
  const rows = (data || []) as (Row & Record<string, unknown>)[];
  const callerIds = [...new Set(rows.map((r) => r.hecho_por).filter((x): x is string => !!x))];
  let names: Record<string, string> = {};
  if (callerIds.length > 0) {
    const { data: us } = await auth.admin.from('users').select('id, nombre').in('id', callerIds);
    (us || []).forEach((u: { id: string; nombre: string }) => { names[u.id] = u.nombre; });
  }

  return NextResponse.json({
    contacts: rows.map((r) => ({ ...r, hecho_por_name: r.hecho_por ? names[r.hecho_por] || 'Admin' : null })),
  });
}

// POST /api/admin/leads/[id]/contacts
// Body: { canal: 'whatsapp'|'instagram'|'email'|'telefono'|'otro', direccion: 'saliente'|'entrante', nota? }
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const canal = String(body?.canal || '');
  const direccion = body?.direccion === 'entrante' ? 'entrante' : 'saliente';
  const nota = typeof body?.nota === 'string' ? body.nota.trim() : null;

  const validCanal = new Set(['whatsapp', 'instagram', 'email', 'telefono', 'otro']);
  if (!validCanal.has(canal)) return NextResponse.json({ error: 'canal invalido' }, { status: 400 });

  const { data, error } = await auth.admin
    .from('lead_contacts')
    .insert({ lead_id: id, canal, direccion, nota, hecho_por: auth.user.id })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update last_contact_at en el lead
  await auth.admin.from('lead_quiz_responses').update({ last_contact_at: new Date().toISOString() }).eq('id', id);

  return NextResponse.json({ success: true, id: (data as { id: string }).id });
}
