import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { commissionFor, ratePct } from '@/lib/commission';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/leads/[id]/mark-sale
 *
 * El admin/setter marca manualmente una venta sobre un lead. Es el camino
 * "yo lo marco" (no dependemos del webhook del CRM externo).
 *
 * Efectos:
 *   1. Mueve el lead a stage='convertido'.
 *   2. Si el lead estaba SIN asignar, lo asigna al que marca la venta —
 *      así la comisión queda atribuida a quien cerró (con SU tasa).
 *   3. Inserta una fila en `lead_sales` (source='manual'). Cada llamada =
 *      una cuota; varias cuotas se acumulan.
 *   4. Loguea un contacto con el detalle de la venta + comisión.
 *
 * Body:
 *   {
 *     monto?: number,        // monto cobrado (requerido salvo is_fee)
 *     moneda?: string,       // "ARS" | "USD" | ...  (default "ARS")
 *     is_fee?: boolean,      // fee/reserva — NO suma comisión
 *     concepto?: string,     // texto libre (ej "Cuota 1/3", "Reserva")
 *     fecha_venta?: string,  // ISO opcional — default ahora
 *   }
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { user, admin } = auth;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const isFee = body.is_fee === true;
  const monto = typeof body.monto === 'number' && isFinite(body.monto) ? body.monto : null;
  const moneda = typeof body.moneda === 'string' && body.moneda.trim() ? body.moneda.trim() : 'ARS';
  const concepto = typeof body.concepto === 'string' && body.concepto.trim() ? body.concepto.trim() : null;
  const fecha = typeof body.fecha_venta === 'string' && body.fecha_venta.trim()
    ? body.fecha_venta.trim()
    : new Date().toISOString();

  // Para una venta real necesitamos monto > 0. Un fee puede ir sin monto.
  if (!isFee && (monto == null || monto <= 0)) {
    return NextResponse.json({ error: 'monto es requerido y debe ser mayor a 0' }, { status: 400 });
  }

  // Traer el lead para saber su asignación actual.
  const { data: lead, error: selErr } = await admin
    .from('lead_quiz_responses')
    .select('id, stage, assigned_to, nombre, email')
    .eq('id', id)
    .maybeSingle<{ id: string; stage: string | null; assigned_to: string | null; nombre: string | null; email: string | null }>();

  if (selErr) {
    logger.error('admin.mark-sale.select.failed', { err: selErr, id });
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });

  // Si no está asignado, lo asigna a quien marca (atribución de comisión).
  const setterId = lead.assigned_to || user.id;

  // Actualizar lead: stage convertido + (asignación si faltaba).
  const leadPatch: Record<string, unknown> = { stage: 'convertido' };
  if (!lead.assigned_to) leadPatch.assigned_to = setterId;
  const { error: updErr } = await admin
    .from('lead_quiz_responses')
    .update(leadPatch)
    .eq('id', lead.id);
  if (updErr) {
    logger.error('admin.mark-sale.update.failed', { err: updErr, id: lead.id });
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Comisión a la tasa del setter asignado.
  const comision = !isFee && monto != null ? commissionFor(monto, setterId) : 0;

  // Insertar la venta.
  const { error: insErr } = await admin.from('lead_sales').insert({
    lead_id: lead.id,
    monto: isFee ? null : monto,
    moneda: isFee ? null : moneda,
    situacion: isFee ? 'Fee' : 'Manual',
    concepto,
    is_fee: isFee,
    fecha_venta: fecha,
    source: 'manual',
  });
  if (insErr) {
    logger.error('admin.mark-sale.insert.failed', { err: insErr, id: lead.id });
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Loguear contacto para el historial del Drawer.
  //
  // OJO: NO escribimos el monto bruto acá. El historial de contactos lo lee
  // cualquier admin —incluidos los setters— sin filtro, así que poner el
  // ticket en texto plano anulaba el hideAmount de sales-summary y
  // commission-monthly. El monto ya vive estructurado en lead_sales.monto,
  // que sí está controlado; el setter ve su comisión, que es lo que le toca.
  try {
    const nota = [
      `💰 ${isFee ? 'Fee/reserva' : 'Venta'} marcada manualmente`,
      !isFee && monto != null && `Comisión (${ratePct(setterId)}%): $${comision.toLocaleString('es-AR')}`,
      concepto && `Concepto: ${concepto}`,
    ].filter(Boolean).join(' · ');

    await admin.from('lead_contacts').insert({
      lead_id: lead.id,
      canal: 'otro',
      direccion: 'saliente',
      nota,
      hecho_por: user.id,
    });
  } catch (err) {
    logger.warn('admin.mark-sale.log_contact.failed', { err, id: lead.id });
  }

  return NextResponse.json({ ok: true, lead_id: lead.id, comision, is_fee: isFee });
}
