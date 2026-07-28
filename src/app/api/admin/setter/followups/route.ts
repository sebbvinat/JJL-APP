import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { fetchCrmLogs, TIPOS_LOG, type TipoLog } from '@/lib/crm-logs';
import { todayInAppTz } from '@/lib/dates';

export const runtime = 'nodejs';

/**
 * GET /api/admin/setter/followups?dia=YYYY-MM-DD
 *
 * Los mensajes que ManyChat mandó ese día (LOG_CALENDARIO / PROBLEMA /
 * TESTIMONIO) para que el setter les haga el seguimiento a mano al día
 * siguiente.
 *
 * Sin `dia` devuelve AYER, que es el caso normal: "a quién le escribí ayer
 * que tengo que seguir hoy".
 *
 * Cada fila trae su estado (pendiente / pospuesto / hecho). Los pospuestos
 * para más adelante se marcan como ocultos para que el setter no los vea hoy,
 * pero el conteo total sigue siendo honesto.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { admin } = ctx;

  const hoy = todayInAppTz();
  const diaParam = request.nextUrl.searchParams.get('dia');
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaParam || '') ? diaParam! : ayerDe(hoy);

  let logs;
  try {
    logs = await fetchCrmLogs();
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

  const delDia = logs.filter((l) => l.dia === dia);

  // Estado guardado de esas filas. Se filtra por tipo+usuario y se cruza en
  // memoria: son pocas filas por día y evita armar un OR gigante.
  const { data: estados } = await admin
    .from('crm_followups')
    .select('tipo_log, usuario, log_fecha, estado, snooze_until')
    .in('tipo_log', Object.keys(TIPOS_LOG))
    .gte('log_fecha', `${dia}T00:00:00-03:00`)
    .lte('log_fecha', `${dia}T23:59:59-03:00`);

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

  const items = delDia.map((l) => {
    const st = porClave.get(`${l.tipo}|${l.usuario}|${l.fecha}`);
    const estado = st?.estado ?? 'pendiente';
    // Pospuesto para una fecha futura → no molesta hoy.
    const oculto = estado === 'pospuesto' && !!st?.snooze_until && st.snooze_until > hoy;
    return {
      tipo: l.tipo,
      usuario: l.usuario,
      fecha: l.fecha,
      estado,
      snooze_until: st?.snooze_until ?? null,
      oculto,
    };
  });

  const pendientes = items.filter((i) => i.estado === 'pendiente' || (i.estado === 'pospuesto' && !i.oculto));

  return NextResponse.json({
    dia,
    hoy,
    items,
    resumen: {
      total: items.length,
      pendientes: pendientes.length,
      hechos: items.filter((i) => i.estado === 'hecho').length,
      pospuestos: items.filter((i) => i.oculto).length,
      porTipo: (Object.keys(TIPOS_LOG) as TipoLog[]).reduce<Record<string, number>>((acc, t) => {
        acc[t] = pendientes.filter((i) => i.tipo === t).length;
        return acc;
      }, {}),
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

  if (!(tipo in TIPOS_LOG)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
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

/** YYYY-MM-DD del día anterior, sin depender de la zona del server. */
function ayerDe(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function manianaDe(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
