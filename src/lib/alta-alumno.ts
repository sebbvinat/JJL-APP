import 'server-only';
import { MONTH_RANGES } from '@/lib/crm';

/**
 * Alta de un alumno del programa.
 *
 * Vive acá y no dentro de la ruta de convertir un lead porque hay dos
 * caminos que tienen que hacer exactamente lo mismo:
 *
 *   - convertir un lead (se conoce de qué campaña vino)
 *   - crear al alumno desde una consultoría de Calendly, sin lead
 *
 * El segundo existe porque los leads no guardan ni nombre ni email: el quiz
 * solo toma el Instagram. Al cerrar una venta lo único que se tiene de la
 * persona es su mail, y buscar un lead por mail no encontraba nada. Desde
 * Calendly, en cambio, viene con nombre y mail reales.
 *
 * Antes el segundo caso se hacía con "Crear alumno" del panel, que solo abre
 * la cuenta: no asigna planilla ni desbloquea módulos. Por eso aparecían
 * alumnos que ya habían pagado y entraban a una plataforma vacía.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// El cliente con service_role de Supabase. Se tipa flojo a propósito: las
// firmas reales de supabase-js son genéricas sobre el esquema de la base y
// clavarlas acá ataría este archivo a esos tipos sin ganar nada.
type AdminClient = {
  from: (t: string) => any;
  auth: { admin: any };
};

export interface AltaParams {
  nombre: string;
  email: string;
  planilla_id: string;
  meses_iniciales: number[];
  password?: string | null;
}

export interface AltaResultado {
  userId?: string;
  /** true si la cuenta de login ya existía y se reutilizó. */
  reutilizada?: boolean;
  error?: string;
  status?: number;
}

/**
 * Busca una cuenta de login por email.
 *
 * La API admin de Supabase no tiene "traeme el usuario con este email", así
 * que hay que recorrer las páginas. Con ~130 cuentas es una sola vuelta.
 */
async function buscarIdEnAuth(admin: AdminClient, email: string): Promise<string | null> {
  const PER_PAGE = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    const users = data?.users;
    if (error || !users?.length) return null;
    const hit = users.find((u: { id: string; email?: string | null }) => (u.email || '').toLowerCase() === email);
    if (hit) return hit.id;
    if (users.length < PER_PAGE) return null;
  }
  return null;
}

export async function darDeAltaAlumno(admin: AdminClient, p: AltaParams): Promise<AltaResultado> {
  const nombre = p.nombre.trim();
  const email = p.email.trim().toLowerCase();
  if (!nombre || !email) return { error: 'nombre y email requeridos', status: 400 };

  const planilla_id = p.planilla_id || 'livianos';
  const meses = Array.isArray(p.meses_iniciales) ? p.meses_iniciales : [0, 1];
  const password = p.password || null;
  const ahora = new Date().toISOString();

  // 1. ¿Ya existe? Hay que mirar en DOS lados: `users` (el perfil) y auth
  // (la cuenta de login). Pueden estar desincronizados — perfiles viejos
  // quedaron con email en null — y buscar solo en `users` hacía que el
  // código creyera que era gente nueva e intentara crear la cuenta, con
  // Supabase respondiendo "already been registered" y todo trabado.
  const { data: existing } = await admin.from('users').select('id').eq('email', email).maybeSingle();
  let userId: string | null = (existing as { id: string } | null)?.id ?? null;
  if (!userId) userId = await buscarIdEnAuth(admin, email);
  const reutilizada = !!userId;

  const activacion = {
    program_member: true,
    lifecycle_stage: 'onboarding',
    lifecycle_changed_at: ahora,
    started_at: ahora,
    planilla_id,
  };

  if (userId) {
    const { data: perfil } = await admin.from('users').select('id').eq('id', userId).maybeSingle();
    // Si el perfil YA existe no se le toca el `rol`: puede ser un admin o un
    // profe al que también se le da acceso, y pisarlo con 'alumno' le sacaría
    // los permisos.
    const { error } = perfil
      ? await admin.from('users').update({ ...activacion, email }).eq('id', userId)
      : await admin.from('users').insert({ id: userId, nombre, email, rol: 'alumno', ...activacion });
    if (error) return { error: error.message, status: 500 };
  } else {
    const { data: creado, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: password || undefined,
      email_confirm: true,
      user_metadata: { nombre },
    });
    if (authErr) return { error: authErr.message, status: 500 };
    if (!creado?.user?.id) return { error: 'No se pudo crear el usuario', status: 500 };
    userId = creado.user.id;

    // upsert y no insert: la base tiene un trigger que crea el perfil sola
    // apenas se crea la cuenta de login, asi que para cuando llegamos aca la
    // fila YA existe y un insert choca con users_pkey. Con esto se completan
    // los datos que el trigger deja vacios (nombre, email, planilla) en vez
    // de fallar.
    const { error: insErr } = await admin
      .from('users')
      .upsert({ id: userId, nombre, email, rol: 'alumno', ...activacion }, { onConflict: 'id' });
    if (insErr) return { error: insErr.message, status: 500 };

    if (!password) {
      try {
        await admin.auth.admin.generateLink({ type: 'magiclink', email });
      } catch { /* opcional */ }
    }
  }

  // 2. Planilla. Si esto falla el alumno igual queda creado: es preferible
  // una cuenta sin contenido (se recarga desde el panel) a un alta a medias.
  try {
    const { getPlanillaForSave } = await import('@/lib/planillas');
    const modules = getPlanillaForSave(planilla_id);
    if (modules) {
      await admin.from('course_data').upsert(
        modules.map((m) => ({
          user_id: userId,
          module_id: m.module_id,
          semana_numero: m.semana_numero,
          titulo: m.titulo,
          descripcion: m.descripcion,
          lessons: m.lessons,
          updated_at: ahora,
        })),
        { onConflict: 'user_id,module_id' },
      );
    }
  } catch (err) {
    console.error('[alta-alumno] planilla', err);
  }

  // 3. Meses iniciales
  if (meses.length > 0) {
    const semanas = MONTH_RANGES.filter((b) => meses.includes(b.mes)).flatMap((b) => b.semanas);
    const { data: mods } = await admin
      .from('course_data')
      .select('module_id, semana_numero')
      .eq('user_id', userId)
      .in('semana_numero', semanas);
    const ids = ((mods as { module_id: string }[] | null) || []).map((r) => r.module_id);
    if (ids.length > 0) {
      const base = ids.map((module_id) => ({ user_id: userId, module_id, is_unlocked: true }));
      const conTs = base.map((r) => ({ ...r, unlocked_at: ahora }));
      const primero = await admin.from('user_access').upsert(conTs, { onConflict: 'user_id,module_id' });
      // Fallback si la DB de prod no tiene unlocked_at en el schema cache.
      if (primero.error && /unlocked_at.*schema cache|column .* does not exist/i.test(primero.error.message)) {
        await admin.from('user_access').upsert(base, { onConflict: 'user_id,module_id' });
      }
    }
  }

  return { userId: userId as string, reutilizada };
}
