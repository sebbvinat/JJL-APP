import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { fetchCrmLogs, ETIQUETAS_SILENCIADAS } from '@/lib/crm-logs';
import { todayInAppTz } from '@/lib/dates';

export const runtime = 'nodejs';

/** Ventanas que ofrece el panel. Cerrado a estas tres para no aceptar cualquier cosa. */
const VENTANAS = [24, 48, 168] as const;
const VENTANA_DEFECTO = 24;

/**
 * GET /api/admin/setter/followups?horas=24|48|168&tipos=a,b,c
 *
 * A quién le mandó un mensaje el bot dentro de la ventana pedida, para que el
 * setter le haga el seguimiento a mano.
 *
 * Cada pestaña LOG_ del CRM es una etiqueta y se descubren solas, así que la
 * lista de etiquetas viene en la respuesta junto con cuántos pendientes tiene
 * cada una — el panel arma los filtros con eso.
 *
 * Cada fila trae su estado (pendiente / pospuesto / hecho). Los pospuestos
 * para más adelante se marcan como ocultos para que no molesten hoy, pero el
 * conteo total sigue siendo honesto.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { admin } = ctx;

  const hoy = todayInAppTz();
  const horasParam = Number(request.nextUrl.searchParams.get('horas'));
  const horas = (VENTANAS as readonly number[]).includes(horasParam) ? horasParam : VENTANA_DEFECTO;

  const tiposParam = (request.nextUrl.searchParams.get('tipos') || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  let logs, etiquetas;
  try {
    ({ entries: logs, etiquetas } = await fetchCrmLogs());
  } catch (err) {
    logger.error('setter.followups.sheets.failed', { err });
    return NextResponse.json(
      {
        error:
          'No pudimos leer los logs del CRM. Revisá que la planilla siga compartida con el service account.',
      },
      { status: 502 },
    );
  }

  const desdeMs = Date.now() - horas * 3_600_000;
  const desdeIso = new Date(desdeMs).toISOString();
  const enVentana = logs.filter((l) => new Date(l.fecha).getTime() >= desdeMs);

  // Estado guardado de esas filas. Se cruza en memoria: son pocas y evita
  // armar un OR gigante.
  const { data: estados } = await admin
    .from('crm_followups')
    .select('tipo_log, usuario, log_fecha, estado, snooze_until')
    .gte('log_fecha', desdeIso);

  const porClave = new Map<string, { estado: string; snooze_until: string | null }>();
  for (const e of (estados || []) as {
    tipo_log: string; usuario: string; log_fecha: string;
    estado: string; snooze_until: string | null;
  }[]) {
    porClave.set(`${e.tipo_log}|${e.usuario}|${new Date(e.log_fecha).toISOString()}`, {
      estado: e.estado,
      snooze_until: e.snooze_until,
    });
  }

  const todos = enVentana.map((l) => {
    const st = porClave.get(`${l.tipo}|${l.usuario}|${l.fecha}`);
    const estado = st?.estado ?? 'pendiente';
    // Pospuesto para una fecha futura → no molesta hoy.
    const oculto = estado === 'pospuesto' && !!st?.snooze_until && st.snooze_until > hoy;
    return {
      tipo: l.tipo,
      usuario: l.usuario,
      handle: l.handle,
      fecha: l.fecha,
      estado,
      snooze_until: st?.snooze_until ?? null,
      oculto,
    };
  });

  const esPendiente = (i: { estado: string; oculto: boolean }) =>
    i.estado === 'pendiente' || (i.estado === 'pospuesto' && !i.oculto);

  // Los conteos por etiqueta se calculan sobre TODO lo de la ventana, no sobre
  // lo filtrado: si no, al elegir una etiqueta las demás mostrarían 0 y no se
  // podría ver dónde hay trabajo.
  const conConteo = etiquetas.map((e) => ({
    ...e,
    silenciada: ETIQUETAS_SILENCIADAS.includes(e.tipo),
    total: todos.filter((i) => i.tipo === e.tipo).length,
    pendientes: todos.filter((i) => i.tipo === e.tipo && esPendiente(i)).length,
  }));

  const items = tiposParam.length > 0 ? todos.filter((i) => tiposParam.includes(i.tipo)) : todos;
  const pendientes = items.filter(esPendiente);

  return NextResponse.json({
    horas,
    hoy,
    etiquetas: conConteo,
    items,
    resumen: {
      total: items.length,
      pendientes: pendientes.length,
      hechos: items.filter((i) => i.estado === 'hecho').length,
      pospuestos: items.filter((i) => i.oculto).length,
    },
  });
}

/**
 * POST /api/admin/setter/followups
 * Body: { tipo, usuario, fecha, accion: 'posponer' | 'hecho' | 'reabrir' }
 *
 * `posponer` lo manda a mañana; al día siguiente vuelve a aparecer.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { admin, user } = ctx;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const tipo = String(body.tipo || '');
  const usuario = String(body.usuario || '').trim();
  const fecha = String(body.fecha || '');
  const accion = String(body.accion || '');

  // El tipo se valida contra las etiquetas que existen de verdad en el CRM,
  // no contra una lista fija: así no hay que tocar esto cada vez que agregan
  // una pestaña nueva, y sigue sin aceptar cualquier string.
  try {
    const { etiquetas } = await fetchCrmLogs();
    if (!etiquetas.some((e) => e.tipo === tipo)) {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'No pudimos validar la etiqueta contra el CRM' }, { status: 502 });
  }
  if (!usuario) return NextResponse.json({ error: 'usuario requerido' }, { status: 400 });
  if (Number.isNaN(new Date(fecha).getTime())) {
    return NextResponse.json({ error: 'fecha inválida' }, { status: 400 });
  }
  if (!['posponer', 'hecho', 'reabrir'].includes(accion)) {
    return NextResponse.json({ error: 'acción inválida' }, { status: 400 });
  }

  const estado = accion === 'posponer' ? 'pospuesto' : accion === 'hecho' ? 'hecho' : 'pendiente';
  const snooze_until = accion === 'posponer' ? manianaDe(todayInAppTz()) : null;

  const { error } = await admin
    .from('crm_followups')
    .upsert(
      {
        tipo_log: tipo,
        usuario,
        log_fecha: new Date(fecha).toISOString(),
        estado,
        snooze_until,
        hecho_por: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tipo_log,usuario,log_fecha' },
    );

  if (error) {
    logger.error('setter.followups.upsert.failed', { err: error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, estado, snooze_until });
}

/** YYYY-MM-DD del día siguiente, sin depender de la zona del server. */
function manianaDe(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
