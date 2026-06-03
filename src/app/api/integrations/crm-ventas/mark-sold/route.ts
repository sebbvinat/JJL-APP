import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

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

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'email es obligatorio' }, { status: 400 });
  }
  const monto = typeof body.monto === 'number' ? body.monto : null;
  const moneda = typeof body.moneda === 'string' ? body.moneda : null;
  const situacion = typeof body.situacion === 'string' ? body.situacion : null;
  const notas = typeof body.notas === 'string' ? body.notas : null;
  const fecha = typeof body.fecha_venta === 'string' ? body.fecha_venta : new Date().toISOString();

  const admin = createAdminSupabaseClient();

  // Buscar el lead por email (matching case-insensitive — ilike es exact-match
  // con el filtro 'email' bajo). Tomamos el más reciente si hay varios.
  const { data: leads, error: selErr } = await admin
    .from('lead_quiz_responses')
    .select('id, session_id, email, stage, converted_user_id, nombre')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (selErr) {
    logger.error('mark-sold.select.failed', { err: selErr, email });
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  const lead = leads?.[0];
  if (!lead) {
    // No encontrar el lead NO es un error fatal — puede ser que el cliente
    // se haya inscripto sin pasar por el quiz. El CRM lo registra igual.
    logger.warn('mark-sold.lead_not_found', { email });
    return NextResponse.json({ found: false, updated: false, message: 'Lead no encontrado por email' }, { status: 200 });
  }

  // Si ya está convertido, no hacemos nada — pero igual registramos el
  // contacto (puede ser un upgrade / cobro adicional).
  const alreadyConverted = lead.stage === 'convertido';
  if (!alreadyConverted) {
    const { error: updErr } = await admin
      .from('lead_quiz_responses')
      .update({ stage: 'convertido' })
      .eq('id', lead.id);
    if (updErr) {
      logger.error('mark-sold.update_stage.failed', { err: updErr, id: lead.id });
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  }

  // Anotar venta en lead_contacts para que quede en el historial del Drawer.
  // No bloqueamos la respuesta si esto falla — el cambio de stage ya pasó.
  try {
    const montoText = monto != null ? `${monto.toLocaleString('es-AR')}${moneda ? ' ' + moneda : ''}` : null;
    const nota = [
      `💰 Venta registrada en CRM`,
      montoText && `Monto: ${montoText}`,
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
    updated: !alreadyConverted,
    lead_id: lead.id,
    session_id: lead.session_id,
    already_converted: alreadyConverted,
  });
}
