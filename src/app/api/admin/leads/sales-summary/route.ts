import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/admin/leads/sales-summary
 *
 * Devuelve un resumen agrupado por lead de las ventas registradas en
 * `lead_sales`. Lo usa el Kanban de /admin/agendas para mostrar el
 * monto y la comisión 5% del setter en las cards de "Convertido".
 *
 * Response shape:
 *   {
 *     by_lead: Record<lead_id, {
 *       total_monto: number,         // suma de monto de ventas !is_fee
 *       total_comision: number,      // 5% de total_monto (redondeado)
 *       cuotas: number,              // cantidad de filas !is_fee
 *       has_fee: boolean,            // hay al menos una fila is_fee
 *       moneda: string | null,       // moneda de la última venta (mayoría)
 *       last_sale_at: string | null,
 *     }>,
 *     totals: {
 *       total_monto: number,
 *       total_comision: number,
 *       leads_convertidos: number,
 *     }
 *   }
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { user, admin } = ctx;

  // Si el caller es un setter (tag='setter'), no le devolvemos el monto
  // bruto — solo comisión + cuotas. Para que no aparezca en el network tab.
  const { data: profile } = await admin
    .from('users')
    .select('tags')
    .eq('id', user.id)
    .single();
  const callerTags = (profile?.tags || []) as string[];
  const hideAmount = callerTags.includes('setter');

  const { data, error } = await admin
    .from('lead_sales')
    .select('lead_id, monto, moneda, is_fee, fecha_venta')
    .order('fecha_venta', { ascending: false });

  if (error) {
    // Pre-migración: tabla no existe — devolver vacío en lugar de 500
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
  const rows = (data || []) as Sale[];

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
      summary.cuotas += 1;
      // moneda se setea con la primera no-fee que aparezca; si las cuotas
      // tienen distintas monedas el setter las verá igual abajo en el drawer.
      if (!summary.moneda) summary.moneda = row.moneda ?? null;
    }
    // last_sale_at queda con el más reciente (los rows vienen ordenados desc).
    if (!summary.last_sale_at || row.fecha_venta > summary.last_sale_at) {
      summary.last_sale_at = row.fecha_venta;
    }
  }

  let total_monto = 0;
  let leads_convertidos = 0;
  for (const k of Object.keys(by_lead)) {
    const s = by_lead[k];
    s.total_comision = Math.round(s.total_monto * 0.05);
    total_monto += s.total_monto;
    if (s.total_monto > 0 || s.has_fee) leads_convertidos += 1;
  }

  const totalComision = Math.round(total_monto * 0.05);

  if (hideAmount) {
    // Zeroear todo lo que sea monto bruto antes de devolver — para que en el
    // network tab el setter solo vea su comisión, no el ticket.
    for (const k of Object.keys(by_lead)) {
      by_lead[k] = { ...by_lead[k], total_monto: 0, moneda: null };
    }
    // Cache HTTP removido (defensivo).
    return NextResponse.json({
      by_lead,
      totals: { total_monto: 0, total_comision: totalComision, leads_convertidos },
    });
  }

  return NextResponse.json({
    by_lead,
    totals: { total_monto, total_comision: totalComision, leads_convertidos },
  });
}
