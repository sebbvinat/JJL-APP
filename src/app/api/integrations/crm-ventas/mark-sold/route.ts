import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { commissionFor, ratePct } from '@/lib/commission';

export const runtime = 'nodejs';

/**
 * POST /api/integrations/crm-ventas/mark-sold
 *
 * Webhook que recibe el script `actualizar_venta.js` del CRM externo
 * (C:\claude-projects\crm-ventas) cuando se registra una venta.
 *
 * Resultado:
 *   - Encuentra el lead en `lead_quiz_responses` por email (normalizado).
 *   - Si está y no está en stage='convertido', lo mueve a 'convertido'.
 *   - Registra una entrada en lead_contacts con la nota de venta para
 *     que quede trazado en el historial del LeadDrawer.
 *   - Devuelve { found, updated, lead_id }.
 *
 * Auth: header `Authorization: Bearer <CRM_VENTAS_WEBHOOK_SECRET>`.
 *   Si la env var no está configurada en Vercel, el endpoint rechaza
 *   TODO. (En el cron leads-followup la falta de CRON_SECRET deja
 *   pasar todo en dev — acá es al revés porque este endpoint corre
 *   en producción contra DB real.)
 *
 * Body esperado:
 *   {
 *     email: string,            // OBLIGATORIO — clave de join con el lead
 *     monto?: number,           // monto cobrado (ARS o USD, no lo parseamos)
 *     moneda?: string,          // "ARS" | "USD" | etc.
 *     fecha_venta?: string,     // ISO opcional
 *     situacion?: string,       // "Adentro en Llamada" | "Adentro en Seguimiento" | ...
 *     notas?: string,           // texto libre extra
 *   }
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRM_VENTAS_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('mark-sold.no_secret');
    return NextResponse.json({ error: 'Endpoint no configurado' }, { status: 503 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // El quiz guarda SOLO el instagram: nombre y email los completa el webhook de
  // Calendly, y si ese webhook no llegó el lead queda sin email. Buscar unicamente
  // por email hacia que ninguna venta se marcara. Ahora aceptamos tres llaves y
  // probamos en orden de precision: evento de Calendly > email > instagram.
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const eventUri = typeof body.calendly_event_uri === 'string' ? body.calendly_event_uri.trim() : '';
  const instagram = typeof body.instagram === 'string'
    ? body.instagram.trim().toLowerCase().replace(/^@+/, '')
    : '';
  if (!email && !eventUri && !instagram) {
    return NextResponse.json(
      { error: 'Hace falta al menos email, calendly_event_uri o instagram' },
      { status: 400 },
    );
  }
  const monto = typeof body.monto === 'number' ? body.monto : null;
  const moneda = typeof body.moneda === 'string' ? body.moneda : null;
  const situacion = typeof body.situacion === 'string' ? body.situacion : null;
  const notas = typeof body.notas === 'string' ? body.notas : null;
  const fecha = typeof body.fecha_venta === 'string' ? body.fecha_venta : new Date().toISOString();

  const admin = createAdminSupabaseClient();

  // Buscar el lead por email (matching case-insensitive — ilike es exact-match
  // con el filtro 'email' bajo). Tomamos el más reciente si hay varios.
  const COLS = 'id, session_id, email, stage, converted_user_id, nombre, assigned_to';
  // Si hay varios leads del mismo lead (llenó el quiz mas de una vez) tomamos el
  // mas reciente, que es el que corresponde a la venta.
  async function buscarPor(columna: string, valor: string) {
    const { data, error } = await admin
      .from('lead_quiz_responses')
      .select(COLS)
      .ilike(columna, valor)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0];
  }

  let lead;
  let matchedBy = '';
  try {
    if (eventUri) { lead = await buscarPor('calendly_event_uri', eventUri); if (lead) matchedBy = 'calendly_event_uri'; }
    if (!lead && email && email.includes('@')) { lead = await buscarPor('email', email); if (lead) matchedBy = 'email'; }
    if (!lead && instagram) { lead = await buscarPor('instagram', instagram); if (lead) matchedBy = 'instagram'; }
  } catch (selErr) {
    logger.error('mark-sold.select.failed', { err: selErr, email, eventUri, instagram });
    return NextResponse.json({ error: (selErr as Error).message }, { status: 500 });
  }
  if (!lead) {
    // No encontrar el lead NO es un error fatal — puede ser que el cliente
    // se haya inscripto sin pasar por el quiz. El CRM lo registra igual.
    logger.warn('mark-sold.lead_not_found', { email, eventUri, instagram });
    return NextResponse.json({ found: false, updated: false, message: 'Lead no encontrado (se probó por evento de Calendly, email e instagram)' }, { status: 200 });
  }

  // Fee/reserva vs venta real. Regla espejada del CRM externo (actualizar_venta.js):
  //   situacion='Fee' OR concepto contiene fee/reserva.
  // Se calcula ANTES de tocar el stage: una seña NO da acceso a la plataforma,
  // así que no puede mover el lead a "convertido". Igual se registra la fila en
  // lead_sales y suma comisión.
  const isFee =
    (situacion ?? '').toLowerCase() === 'fee' ||
    /fee|reserva/i.test(notas ?? '');

  // Solo las ventas reales (1ra cuota / PIF) convierten el lead.
  const alreadyConverted = lead.stage === 'convertido';
  if (!alreadyConverted && !isFee) {
    const { error: updErr } = await admin
      .from('lead_quiz_responses')
      .update({ stage: 'convertido' })
      .eq('id', lead.id);
    if (updErr) {
      logger.error('mark-sold.update_stage.failed', { err: updErr, id: lead.id });
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  }

  // Insertar la venta (cada llamada = una fila — cuotas se acumulan).
  try {
    await admin.from('lead_sales').insert({
      lead_id: lead.id,
      monto,
      moneda,
      situacion,
      concepto: notas,
      is_fee: isFee,
      fecha_venta: fecha,
      source: 'crm_ventas',
    });
  } catch (err) {
    logger.warn('mark-sold.insert_sale.failed', { err, id: lead.id });
  }

  // Anotar también en lead_contacts para que quede en el historial del Drawer.
  try {
    // Sin monto bruto en la nota: el historial de contactos lo leen también
    // los setters (ver mark-sale). El monto queda en lead_sales.
    const assignedSetter = (lead as { assigned_to?: string | null }).assigned_to ?? null;
    // Las señas también suman comisión al setter (decisión del dueño, ago 2026).
    const comision = monto != null ? commissionFor(monto, assignedSetter) : null;
    const nota = [
      `💰 ${isFee ? 'Fee/reserva' : 'Venta'} registrada en CRM`,
      comision != null && `Comisión setter (${ratePct(assignedSetter)}%): $${comision.toLocaleString('es-AR')}`,
      situacion && `Situación: ${situacion}`,
      fecha && `Fecha: ${new Date(fecha).toLocaleString('es-AR')}`,
      notas && `Notas: ${notas}`,
    ].filter(Boolean).join(' · ');

    await admin.from('lead_contacts').insert({
      lead_id: lead.id,
      canal: 'otro',
      direccion: 'saliente',
      nota,
    });
  } catch (err) {
    logger.warn('mark-sold.insert_contact.failed', { err, id: lead.id });
  }

  return NextResponse.json({
    found: true,
    updated: !alreadyConverted && !isFee, // una seña no convierte
    lead_id: lead.id,
    session_id: lead.session_id,
    already_converted: alreadyConverted,
    is_fee: isFee,
    matched_by: matchedBy, // por que llave se encontro el lead (util para diagnosticar)
  });
}
