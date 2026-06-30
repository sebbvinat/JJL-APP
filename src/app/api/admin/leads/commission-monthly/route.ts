import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { commissionFor, ratePct } from '@/lib/commission';

export const runtime = 'nodejs';

const MES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * GET /api/admin/leads/commission-monthly
 *
 * Comisión del setter agrupada por mes (a partir de `fecha_venta` de
 * `lead_sales`). Para que cada setter vea cuánto va ganando este mes y
 * en los meses anteriores.
 *
 * Scope:
 *   - Setter (tag='setter'): solo SUS ventas (leads asignados a él) y solo
 *     su comisión — nunca el monto bruto.
 *   - Admin/coach: ve todas las ventas (comisión total de la operación).
 *
 * La comisión usa la tasa del setter asignado a cada lead (ver @/lib/commission).
 *
 * Response:
 *   {
 *     hide_amount: boolean,
 *     rate_pct: number,            // tasa del caller (informativo)
 *     current: { month, label, comision, monto, ventas },
 *     months: [{ month:'YYYY-MM', label, comision, monto, ventas, cuotas, is_current }]
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
  const hideAmount = isSetter;

  const empty = {
    hide_amount: hideAmount,
    rate_pct: ratePct(user.id),
    current: { month: '', label: '', comision: 0, monto: 0, ventas: 0 },
    months: [] as unknown[],
  };

  const { data, error } = await admin
    .from('lead_sales')
    .select('lead_id, monto, is_fee, fecha_venta')
    .order('fecha_venta', { ascending: false });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ ...empty, setupRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Sale = { lead_id: string; monto: number | null; is_fee: boolean; fecha_venta: string };
  let rows = (data || []) as Sale[];

  // Mapa lead_id → setter asignado (tasa + scope).
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

  if (isSetter) {
    rows = rows.filter((r) => assignedByLead.get(r.lead_id) === user.id);
  }

  // Agrupar por mes (YYYY-MM en UTC — suficiente para el reporte).
  const byMonth = new Map<string, { comision: number; monto: number; cuotas: number; leads: Set<string> }>();
  for (const row of rows) {
    if (row.is_fee || typeof row.monto !== 'number') continue;
    const month = (row.fecha_venta || '').slice(0, 7); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    if (!byMonth.has(month)) byMonth.set(month, { comision: 0, monto: 0, cuotas: 0, leads: new Set() });
    const m = byMonth.get(month)!;
    m.comision += commissionFor(row.monto, assignedByLead.get(row.lead_id));
    m.monto += row.monto;
    m.cuotas += 1;
    m.leads.add(row.lead_id);
  }

  function labelFor(month: string): string {
    const [y, mm] = month.split('-');
    const idx = Number(mm) - 1;
    return `${MES_ES[idx] ?? mm} ${y}`;
  }

  // Mes actual — calculado del lado server pero sin Date.now indirecto: usamos
  // el ISO actual una sola vez.
  const nowMonth = new Date().toISOString().slice(0, 7);

  const months = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // desc
    .map(([month, v]) => ({
      month,
      label: labelFor(month),
      comision: v.comision,
      monto: hideAmount ? 0 : v.monto,
      ventas: v.leads.size,
      cuotas: v.cuotas,
      is_current: month === nowMonth,
    }));

  const cur = months.find((m) => m.is_current);
  const current = cur
    ? { month: cur.month, label: cur.label, comision: cur.comision, monto: cur.monto, ventas: cur.ventas }
    : { month: nowMonth, label: labelFor(nowMonth), comision: 0, monto: 0, ventas: 0 };

  return NextResponse.json({
    hide_amount: hideAmount,
    rate_pct: ratePct(user.id),
    current,
    months,
  });
}
