import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { dispatchLeadWebhook } from '@/lib/lead-webhook';
import { permitirRuta } from '@/lib/rate-limit';
import { sessionIdParaBase } from '@/lib/session-id';

export const runtime = 'nodejs';

// Tope por campo de texto. Los valores reales son cortos (opciones del quiz, un
// handle, un mail, un teléfono, la ocupación). Sin tope, un script podía meter
// megas en `nombre` y eso terminaba en la base, en el WhatsApp y en Make.
const MAX_LARGO_CAMPO = 500;
const MAX_LARGO_CABECERA = 2000;

/**
 * POST /api/leads/quiz
 *
 * Public endpoint. Captura las respuestas del quiz de calificación ANTES de
 * que el lead agende en Calendly. La misma ruta también acepta updates
 * parciales por session_id (p. ej. booked=true cuando se confirma la reserva).
 *
 * Body completo (al terminar el quiz):
 *   { session_id, fortaleza, vision, estado, compromiso, urgencia,
 *     disqualified?, nombre?, email? }
 *
 * Body parcial (después de agendar):
 *   { session_id, booked: true }
 *
 * Service-role insert/upsert bypassea RLS — desde el cliente sólo se llega
 * por esta ruta.
 */
export async function POST(request: NextRequest) {
  // Límite por IP ANTES de mirar el body, para que los pedidos basura también
  // cuenten. Falla abierto: si la migración no corrió o la base no contesta,
  // deja pasar (ver src/lib/rate-limit.ts).
  if (!(await permitirRuta(request, 'quiz'))) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const obj = (body as Record<string, unknown>) || {};
  // La columna session_id es `uuid`. Antes cualquier texto llegaba hasta
  // Postgres y volvía como 500 con el mensaje crudo de la base. Ahora se valida
  // acá, y el id de respaldo de los navegadores viejos (que no es UUID) se
  // convierte a uno en vez de perder el lead. Ver src/lib/session-id.ts.
  const session_id = await sessionIdParaBase(obj.session_id);
  if (!session_id) {
    return NextResponse.json({ error: 'session_id inválido' }, { status: 400 });
  }

  // Recortados por lo mismo que los campos del body: los escribe el que llama.
  // El tope es más holgado que el de los campos porque el referrer es el link
  // original con todos sus parámetros (utm, fbclid, ?ig=) y se usa después para
  // recuperar handles (scripts/recuperar-handles.mjs): cortarlo corto lo rompería.
  const userAgent = request.headers.get('user-agent')?.slice(0, MAX_LARGO_CABECERA) || null;
  const referrer = request.headers.get('referer')?.slice(0, MAX_LARGO_CABECERA) || null;

  // Recolectar campos opcionales — si no vienen, no se mandan al insert.
  const update: Record<string, unknown> = { session_id };
  const stringFields = [
    'fortaleza',
    'vision',
    'estado',
    'compromiso',
    'urgencia',
    'limitacion',
    'experiencia',
    'instagram',
    'ocupacion',
    'nombre',
    'email',
    // El formulario pide el WhatsApp despues del Instagram. Mismo formato que
    // guarda /api/leads/phone (telefono "+549...", pais "54"), asi el link de
    // WhatsApp del panel y el chequeo de "ya tiene telefono" funcionan igual.
    'telefono',
    'pais',
  ];
  for (const f of stringFields) {
    const v = obj[f];
    if (typeof v === 'string' && v.trim()) update[f] = v.trim().slice(0, MAX_LARGO_CAMPO);
  }
  if (typeof obj.disqualified === 'boolean') update.disqualified = obj.disqualified;
  if (typeof obj.booked === 'boolean') update.booked = obj.booked;

  // Si trae las respuestas obligatorias del quiz → es el insert inicial:
  // enriquecer con metadata. instagram + ocupacion son opcionales.
  // En sept/2026 el formulario dejo de preguntar fortaleza, estado y vision
  // (las repetia el quiz del luchador). Si las siguieramos exigiendo aca,
  // `isInitial` seria siempre false y con eso se apagaba el webhook de abajo,
  // o sea todas las automatizaciones externas, sin ningun error visible.
  // Tienen que ser campos que existan en LOS DOS caminos que escriben aca:
  // el formulario largo de /consultoria-gratuita y la agenda rapida de
  // /agendar (tres preguntas). `limitacion` la pregunta solo el primero, asi
  // que si la exigieramos, todo lo que entra por /agendar no dispararia el
  // webhook y las automatizaciones externas se perderian la mitad.
  const isInitial =
    typeof update.compromiso === 'string' && typeof update.urgencia === 'string';

  if (isInitial) {
    update.user_agent = userAgent;
    update.referrer = referrer;
  }

  try {
    const admin = createAdminSupabaseClient();
    // Upsert sobre session_id (UNIQUE en la tabla). Permite que el insert
    // inicial llegue y que después varias llamadas (booked / phone) hagan
    // merge sin duplicar filas.
    const { data: row, error } = await admin
      .from('lead_quiz_responses')
      .upsert(update, { onConflict: 'session_id' })
      .select(
        'session_id, instagram, ocupacion, fortaleza, limitacion, estado, vision, compromiso, telefono, pais, nombre, email, scheduled_at, disqualified, booked, created_at',
      )
      .single();
    if (error) {
      // El detalle queda en el log. Al que llama no le devolvemos el mensaje de
      // Postgres: nombra tablas, columnas y constraints, y este endpoint es público.
      logger.error('leads.quiz.upsert.failed', { err: error });
      return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
    }
    // Si es el insert inicial (todas las respuestas), notificar al webhook
    // externo para que dispare automatizaciones de follow-up (Make/Zapier).
    if (isInitial && row) {
      void dispatchLeadWebhook('lead.quiz_completed', row);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('leads.quiz.unhandled', { err });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
