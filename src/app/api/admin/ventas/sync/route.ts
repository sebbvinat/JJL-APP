import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireCron } from '@/lib/cron';
import { ventasDelCrm, alumnoDeLaVenta } from '@/lib/crm-ventas';
import { commissionFor } from '@/lib/commission';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ClienteAdmin = ReturnType<typeof createAdminSupabaseClient>;

/**
 * GET y POST /api/admin/ventas/sync
 *
 * Carga en `lead_sales` las ventas que ya estan en el CRM (pestaña LOOKER).
 *
 * Nadie marcaba las ventas a mano, asi que la tabla estuvo vacia meses y el
 * cash collected y la comision del setter daban cero. El dato existia todo
 * este tiempo en el CRM; esto lo trae.
 *
 * - Idempotente: una venta es (crm_nombre, mes). Correrlo dos veces no
 *   duplica nada, y si el acumulado del CRM cambio (cobraron otra cuota) se
 *   corrige el monto de la fila que ya estaba en vez de cargar otra.
 * - Solo ventas de $300 o mas: abajo de eso son cursos sueltos y cuotas, que
 *   no son del programa.
 * - Las que no se pueden atribuir a un alumno NO se cargan y se devuelven
 *   aparte. Adivinar a quien pertenece la plata rompe la comision, y ademas
 *   esa lista es util: casi siempre es gente que pago y todavia no tiene
 *   cuenta.
 *
 * `?dry=1` no escribe nada, solo devuelve lo que haria.
 *
 * Entra por dos puertas: un admin que lo dispara a mano (POST), o un cron
 * (GET o POST con el secreto). El setter no: ve la comision pero no decide
 * que ventas existen.
 */

/**
 * GET: la puerta de los crons, y SOLO de los crons.
 *
 * Existe porque Vercel Cron invoca siempre con GET, y cron-job.org tambien
 * (GET + header `Authorization: Bearer <CRON_SECRET>`). Esta ruta exportaba
 * nada mas que POST, asi que el cron diario recibia 405 y el sync no corrio
 * nunca solo: las ventas se cargaban unicamente cuando alguien lo disparaba a
 * mano (en el panel no hay ningun boton que lo llame).
 *
 * Aca NO se acepta la sesion de un admin a proposito: un GET que escribe en la
 * base y se autoriza por cookie se puede disparar con un link o una imagen
 * (CSRF). Con el secreto en el header eso no pasa. El admin sigue teniendo el
 * POST.
 *
 * Falla cerrado: sin CRON_SECRET configurado `requireCron` devuelve 500, y con
 * un secreto que no coincide, 401. En ningun caso corre el sync.
 */
export async function GET(request: NextRequest) {
  const denegado = requireCron(request);
  if (denegado) return denegado;
  return correrSync(createAdminSupabaseClient(), pideDry(request));
}

export async function POST(request: NextRequest) {
  // Dos puertas: un cron que llame por POST, o un admin que lo dispara a mano.
  const esCron = requireCron(request) === null;
  let admin: ClienteAdmin;
  if (esCron) {
    admin = createAdminSupabaseClient();
  } else {
    const auth = await requireAdmin(request, { denyTags: ['setter'] });
    if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    admin = auth.admin as ClienteAdmin;
  }
  return correrSync(admin, pideDry(request));
}

function pideDry(request: NextRequest): boolean {
  return request.nextUrl.searchParams.get('dry') === '1';
}

/**
 * El sync en si. Esta aparte para que GET y POST hagan exactamente lo mismo:
 * lo unico que cambia entre las dos puertas es como se autoriza.
 */
async function correrSync(admin: ClienteAdmin, dry: boolean): Promise<NextResponse> {
  try {
    const [ventas, alumnosRes] = await Promise.all([
      ventasDelCrm(300),
      admin.from('users').select('id, nombre').eq('program_member', true),
    ]);
    // Ahora que esto corre solo, una lectura fallida no puede pasar callada:
    // sin alumnos, TODAS las ventas caerian en "sin dueño" y la corrida
    // pareceria sana (200, cero cargadas) cuando en realidad no hizo nada.
    if (alumnosRes.error) {
      logger.error('ventas.sync.alumnos.failed', { err: alumnosRes.error.message });
      return NextResponse.json({ error: 'No se pudieron leer los alumnos' }, { status: 502 });
    }
    const alumnos = (alumnosRes.data as { id: string; nombre: string | null }[] | null) || [];

    const aCargar: Record<string, unknown>[] = [];
    const sinDueno: { nombre: string; monto: number; fecha: string }[] = [];

    for (const v of ventas) {
      const userId = alumnoDeLaVenta(v.nombre, alumnos);
      if (!userId) {
        sinDueno.push({ nombre: v.nombre, monto: v.monto, fecha: v.fecha.slice(0, 10) });
        continue;
      }
      aCargar.push({
        user_id: userId,
        lead_id: null,
        monto: v.monto,
        moneda: 'USD',
        is_fee: false,
        fecha_venta: v.fecha,
        source: 'crm',
        crm_nombre: v.nombre,
      });
    }

    // Se descarta lo que ya esta cargado leyendo las claves existentes, en
    // vez de dejarselo a ON CONFLICT: el indice unico es PARCIAL (solo aplica
    // cuando crm_nombre no es null) y Postgres no acepta un indice parcial
    // como destino de ON CONFLICT. El indice igual queda como red de
    // seguridad ante dos corridas simultaneas.
    const { data: yaEstan, error: yaEstanError } = await admin
      .from('lead_sales')
      .select('id, crm_nombre, fecha_venta, monto')
      .not('crm_nombre', 'is', null);
    // Si no se sabe que hay cargado, no se inserta: se intentaria cargar todo
    // de nuevo y el lote entero rebotaria contra el indice unico.
    if (yaEstanError) {
      logger.error('ventas.sync.existentes.failed', { err: yaEstanError.message });
      return NextResponse.json({ error: 'No se pudieron leer las ventas ya cargadas' }, { status: 502 });
    }

    // La clave es (nombre, mes) SIN el monto, a proposito. El monto del CRM es
    // `Cash Total (pagos)`, un ACUMULADO: cuando el alumno paga otra cuota, la
    // misma fila del CRM cambia de 900 a 1500. Con el monto adentro de la
    // clave esa fila dejaba de coincidir con la ya cargada y se insertaba una
    // SEGUNDA venta (900 + 1500 para una venta de 1500), inflando el cash
    // collected y la comision del setter. Corriendo a mano no se noto; con el
    // cron diario pasaria al dia siguiente de cada cuota cobrada.
    const clave = (n: unknown, f: unknown) => `${n}|${new Date(String(f)).toISOString()}`;
    const centavos = (m: unknown) => Math.round(Number(m) * 100);

    const existentes = new Map<string, { id: string; monto: number }[]>();
    for (const r of (yaEstan as { id: string; crm_nombre: string; fecha_venta: string; monto: number }[] | null) || []) {
      const k = clave(r.crm_nombre, r.fecha_venta);
      const lista = existentes.get(k);
      if (lista) lista.push({ id: r.id, monto: Number(r.monto) });
      else existentes.set(k, [{ id: r.id, monto: Number(r.monto) }]);
    }

    // El CRM repite filas: cuando alguien reagenda queda una consultoria por
    // cada horario y las dos con el mismo cash. Erick Hennings, por ejemplo,
    // aparece el 29/7 y el 30/7 con $900 — es UN pago, no dos. Se deja una
    // sola fila por (nombre, mes). Si los montos difieren se toma el mayor:
    // al ser un acumulado, el mayor es el mas al dia, y elegir siempre el
    // mismo evita que el monto vaya y venga entre una corrida y la otra.
    const porClave = new Map<string, Record<string, unknown>>();
    for (const v of aCargar) {
      const k = clave(v.crm_nombre, v.fecha_venta);
      const previa = porClave.get(k);
      if (!previa || Number(v.monto) > Number(previa.monto)) porClave.set(k, v);
    }

    const nuevas: Record<string, unknown>[] = [];
    const montoCambiado: { id: string; nombre: string; antes: number; ahora: number }[] = [];
    let ambiguas = 0;
    for (const [k, v] of porClave) {
      const filas = existentes.get(k);
      if (!filas) {
        nuevas.push(v);
        continue;
      }
      // Mas de una fila cargada para el mismo (nombre, mes): no se sabe cual
      // corregir, asi que no se toca ninguna. Hoy no hay ningun caso; si
      // aparece queda contado en el log para mirarlo a mano.
      if (filas.length > 1) {
        if (!filas.some((f) => centavos(f.monto) === centavos(v.monto))) ambiguas++;
        continue;
      }
      if (centavos(filas[0].monto) !== centavos(v.monto)) {
        montoCambiado.push({
          id: filas[0].id,
          nombre: String(v.crm_nombre),
          antes: filas[0].monto,
          ahora: Number(v.monto),
        });
      }
    }

    // Ya esta cargada pero el acumulado del CRM cambio: se corrige el monto de
    // ESA fila en vez de insertar otra. El CRM es la fuente de verdad, asi que
    // vale tambien si el monto baja (una correccion del closer).
    let actualizadas = 0;
    if (!dry) {
      for (const c of montoCambiado) {
        const { error } = await admin.from('lead_sales').update({ monto: c.ahora }).eq('id', c.id);
        if (error) {
          // Una que falle no frena al resto: la proxima corrida la reintenta,
          // porque el monto va a seguir sin coincidir.
          logger.error('ventas.sync.update.failed', { err: error.message });
          continue;
        }
        actualizadas++;
      }
    }

    let cargadas = 0;
    if (!dry && nuevas.length > 0) {
      const { error } = await admin.from('lead_sales').insert(nuevas);
      if (error) {
        logger.error('ventas.sync.insert.failed', { err: error });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      cargadas = nuevas.length;
    }

    // Los totales van sobre las ventas ya deduplicadas: sumar `aCargar` contaba
    // dos veces a los que reagendaron.
    const unicas = [...porClave.values()];
    const totalMonto = unicas.reduce((a, v) => a + Number(v.monto), 0);
    const totalComision = unicas.reduce((a, v) => a + commissionFor(Number(v.monto), null), 0);

    // La respuesta de un cron no la lee nadie: lo que queda es esta linea en
    // los logs. Sin nombres ni montos, solo cantidades.
    logger.info('ventas.sync.done', {
      dry,
      encontradas_en_crm: ventas.length,
      con_alumno: aCargar.length,
      cargadas: dry ? 0 : cargadas,
      sin_dueno: sinDueno.length,
      monto_cambiado: montoCambiado.length,
      monto_actualizado: actualizadas,
      ambiguas,
    });

    return NextResponse.json({
      dry,
      encontradas_en_crm: ventas.length,
      con_alumno: aCargar.length,
      ya_estaban: unicas.length - nuevas.length,
      repetidas_en_crm: aCargar.length - unicas.length,
      cargadas: dry ? nuevas.length : cargadas,
      // Ventas ya cargadas cuyo acumulado cambio en el CRM (cuota nueva). En
      // dry es lo que se corregiria; si no, `monto_actualizado` dice cuantas
      // se corrigieron de verdad.
      monto_cambiado: montoCambiado.map((c) => ({ nombre: c.nombre, antes: c.antes, ahora: c.ahora })),
      monto_actualizado: actualizadas,
      ambiguas,
      sin_dueno: sinDueno,
      totales: { monto: totalMonto, comision: totalComision },
    });
  } catch (err) {
    logger.error('ventas.sync.unhandled', { err });
    return NextResponse.json({ error: 'No se pudo sincronizar con el CRM' }, { status: 502 });
  }
}
