import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { commissionFor } from '@/lib/commission';

export const runtime = 'nodejs';

/**
 * GET /api/admin/leads/sales-summary
 *
 * Devuelve un resumen agrupado por lead de las ventas registradas en
 * `lead_sales`. Lo usa el Kanban de /admin/agendas para mostrar el
 * monto y la comisión del setter en las cards de "Convertido".
 *
 * La comisión se calcula con la tasa del setter ASIGNADO a cada lead
 * (`lead_quiz_responses.assigned_to`) — Agustín 8%, default 5%. Ver
 * `@/lib/commission`.
 *
 * Scope: si el caller es un setter (tag='setter'), solo ve las ventas de
 * SUS leads (assigned_to = su id) y nunca el monto bruto — solo su comisión.
 * Un admin/coach ve todo.
 *
 * Response shape:
 *   {
 *     by_lead: Record<lead_id, {
 *       total_monto, total_comision, cuotas, has_fee, moneda, last_sale_at
 *     }>,
 *     totals: { total_monto, total_comision, leads_convertidos }
 *   }
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { user, admin } = ctx;

  const { data: profile } = await admin
    .from('users')
    .select('tags')
    .eq('id', user.id)
    .single();
  const callerTags = (profile?.tags || []) as string[];
  const isSetter = callerTags.includes('setter');
  const hideAmount = isSetter; // al setter le ocultamos el monto bruto

  const { data, error } = await admin
    .from('lead_sales')
    .select('lead_id, monto, moneda, is_fee, fecha_venta')
    .order('fecha_venta', { ascending: false });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({
        by_lead: {},
        totals: { total_monto: 0, total_comision: 0, leads_convertidos: 0 },
        setupRequired: true,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Sale = { lead_id: string; monto: number | null; moneda: string | null; is_fee: boolean; fecha_venta: string };
  let rows = (data || []) as Sale[];

  // Mapa lead_id → setter asignado (para la tasa de comisión y el scope).
  const leadIds = [...new Set(rows.map((r) => r.lead_id))];
  const assignedByLead = new Map<string, string | null>();
  if (leadIds.length > 0) {
    const { data: leads } = await admin
      .from('lead_quiz_responses')
      .select('id, assigned_to')
      .in('id', leadIds);
    (leads || []).forEach((l: { id: string; assigned_to: string | null }) => {
      assignedByLead.set(l.id, l.assigned_to);
    });
  }

  // Scope: el setter solo ve sus propias ventas.
  if (isSetter) {
    rows = rows.filter((r) => assignedByLead.get(r.lead_id) === user.id);
  }

  const by_lead: Record<string, {
    total_monto: number;
    total_comision: number;
    cuotas: number;
    has_fee: boolean;
    moneda: string | null;
    last_sale_at: string | null;
  }> = {};

  for (const row of rows) {
    if (!by_lead[row.lead_id]) {
      by_lead[row.lead_id] = {
        total_monto: 0,
        total_comision: 0,
        cuotas: 0,
        has_fee: false,
        moneda: row.moneda ?? null,
        last_sale_at: row.fecha_venta,
      };
    }
    const summary = by_lead[row.lead_id];
    if (row.is_fee) {
      summary.has_fee = true;
    } else if (typeof row.monto === 'number') {
      summary.total_monto += row.monto;
      summary.total_comision += commissionFor(row.monto, assignedByLead.get(row.lead_id));
      summary.cuotas += 1;
      if (!summary.moneda) summary.moneda = row.moneda ?? null;
    }
    if (!summary.last_sale_at || row.fecha_venta > summary.last_sale_at) {
      summary.last_sale_at = row.fecha_venta;
    }
  }

  let total_monto = 0;
  let total_comision = 0;
  let leads_convertidos = 0;
  for (const k of Object.keys(by_lead)) {
    const s = by_lead[k];
    total_monto += s.total_monto;
    total_comision += s.total_comision;
    if (s.total_monto > 0 || s.has_fee) leads_convertidos += 1;
  }

  if (hideAmount) {
    // Zeroear el monto bruto antes de devolver — el setter solo ve comisión.
    for (const k of Object.keys(by_lead)) {
      by_lead[k] = { ...by_lead[k], total_monto: 0, moneda: null };
    }
    return NextResponse.json({
      by_lead,
      totals: { total_monto: 0, total_comision, leads_convertidos },
    });
  }

  return NextResponse.json({
    by_lead,
    totals: { total_monto, total_comision, leads_convertidos },
  });
}
