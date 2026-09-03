import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireCron } from '@/lib/cron';
import { ventasDelCrm, alumnoDeLaVenta } from '@/lib/crm-ventas';
import { commissionFor } from '@/lib/commission';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/admin/ventas/sync
 *
 * Carga en `lead_sales` las ventas que ya estan en el CRM (pestaña LOOKER).
 *
 * Nadie marcaba las ventas a mano, asi que la tabla estuvo vacia meses y el
 * cash collected y la comision del setter daban cero. El dato existia todo
 * este tiempo en el CRM; esto lo trae.
 *
 * - Idempotente: el indice unico (crm_nombre, fecha_venta, monto) hace que
 *   correrlo dos veces no duplique nada.
 * - Solo ventas de $300 o mas: abajo de eso son cursos sueltos y cuotas, que
 *   no son del programa.
 * - Las que no se pueden atribuir a un alumno NO se cargan y se devuelven
 *   aparte. Adivinar a quien pertenece la plata rompe la comision, y ademas
 *   esa lista es util: casi siempre es gente que pago y todavia no tiene
 *   cuenta.
 *
 * `?dry=1` no escribe nada, solo devuelve lo que haria.
 *
 * Entra por dos puertas: un admin que lo dispara a mano, o el cron de Vercel
 * (que es como corre todos los dias). El setter no: ve la comision pero no
 * decide que ventas existen.
 */
export async function POST(request: NextRequest) {
  // Dos puertas: el cron de Vercel, o un admin que lo dispara a mano.
  const esCron = requireCron(request) === null;
  let admin: ReturnType<typeof createAdminSupabaseClient>;
  if (esCron) {
    admin = createAdminSupabaseClient();
  } else {
    const auth = await requireAdmin(request, { denyTags: ['setter'] });
    if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    admin = auth.admin as ReturnType<typeof createAdminSupabaseClient>;
  }

  const dry = request.nextUrl.searchParams.get('dry') === '1';

  try {
    const [ventas, alumnosRes] = await Promise.all([
      ventasDelCrm(300),
      admin.from('users').select('id, nombre').eq('program_member', true),
    ]);
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
    const { data: yaEstan } = await admin
      .from('lead_sales')
      .select('crm_nombre, fecha_venta, monto')
      .not('crm_nombre', 'is', null);

    const clave = (n: unknown, f: unknown, m: unknown) =>
      `${n}|${new Date(String(f)).toISOString()}|${Number(m)}`;
    const existentes = new Set(
      ((yaEstan as { crm_nombre: string; fecha_venta: string; monto: number }[] | null) || []).map((r) =>
        clave(r.crm_nombre, r.fecha_venta, r.monto),
      ),
    );
    // El CRM repite filas: cuando alguien reagenda queda una consultoria por
    // cada horario y las dos con el mismo cash. Erick Hennings, por ejemplo,
    // aparece el 29/7 y el 30/7 con $900 — es UN pago, no dos. Si no se
    // deduplica, el lote entero falla contra el indice unico.
    const vistas = new Set<string>();
    const nuevas = aCargar.filter((v) => {
      const k = clave(v.crm_nombre, v.fecha_venta, v.monto);
      if (existentes.has(k) || vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });

    let cargadas = 0;
    if (!dry && nuevas.length > 0) {
      const { error } = await admin.from('lead_sales').insert(nuevas);
      if (error) {
        logger.error('ventas.sync.insert.failed', { err: error });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      cargadas = nuevas.length;
    }

    const totalMonto = aCargar.reduce((a, v) => a + Number(v.monto), 0);
    const totalComision = aCargar.reduce((a, v) => a + commissionFor(Number(v.monto), null), 0);

    return NextResponse.json({
      dry,
      encontradas_en_crm: ventas.length,
      con_alumno: aCargar.length,
      ya_estaban: aCargar.length - nuevas.length,
      repetidas_en_crm: aCargar.length - new Set(aCargar.map((v) => clave(v.crm_nombre, v.fecha_venta, v.monto))).size,
      cargadas: dry ? nuevas.length : cargadas,
      sin_dueno: sinDueno,
      totales: { monto: totalMonto, comision: totalComision },
    });
  } catch (err) {
    logger.error('ventas.sync.unhandled', { err });
    return NextResponse.json({ error: 'No se pudo sincronizar con el CRM' }, { status: 502 });
  }
}
