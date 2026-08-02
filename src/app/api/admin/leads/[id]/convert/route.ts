import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { MONTH_RANGES } from '@/lib/crm';

type Ctx = { params: Promise<{ id: string }> };

type AdminClient = {
  auth: {
    admin: {
      listUsers: (p: { page: number; perPage: number }) => Promise<{
        data: { users: { id: string; email?: string | null }[] } | null;
        error: unknown;
      }>;
    };
  };
};

/**
 * Busca una cuenta de login por email.
 *
 * La API admin de Supabase no tiene "traeme el usuario con este email", así
 * que hay que recorrer las páginas. Con ~130 cuentas es una sola vuelta, y
 * sólo se llama cuando el perfil no apareció por email — o sea, casi nunca.
 */
async function buscarIdEnAuth(admin: AdminClient, email: string): Promise<string | null> {
  const PER_PAGE = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    const users = data?.users;
    if (error || !users?.length) return null;
    const hit = users.find((u) => (u.email || '').toLowerCase() === email);
    if (hit) return hit.id;
    if (users.length < PER_PAGE) return null; // última página
  }
  return null;
}

/**
 * POST /api/admin/leads/[id]/convert
 * Body: {
 *   nombre, email, telefono?,
 *   planilla_id: 'livianos'|'medios'|'simbio'|'atleticos',
 *   meses_iniciales: number[] (ej [0,1] = Fundamentos + Mes 1),
 *   password?: string  // opcional, sino se manda magic link
 * }
 *
 * Acciones:
 *  1. Crea auth.user (con password o invite por email).
 *  2. Crea row en `users` con rol='alumno', program_member=TRUE,
 *     lifecycle_stage='onboarding', started_at=NOW(), planilla_id.
 *  3. Carga planilla via getPlanillaForSave (course_data).
 *  4. Desbloquea módulos de meses_iniciales (user_access).
 *  5. Actualiza lead: stage='convertido', converted_user_id, booked=true,
 *     disqualified=false.
 *  6. Notif al admin que convirtió (in-app).
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id: leadId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const nombre = String(body?.nombre || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const telefono = body?.telefono ? String(body.telefono).trim() : null;
  const planilla_id = String(body?.planilla_id || 'livianos');
  const mesesIniciales: number[] = Array.isArray(body?.meses_iniciales) ? body.meses_iniciales.filter((n: unknown) => typeof n === 'number') : [0, 1];
  const password: string | null = body?.password ? String(body.password) : null;

  if (!nombre || !email) return NextResponse.json({ error: 'nombre y email requeridos' }, { status: 400 });

  // 1. Chequear si ya existe user con ese email.
  //
  // Hay que mirar en DOS lados y no alcanza con uno solo:
  //   - `users`      = el perfil (nombre, rol, programa…)
  //   - auth.users   = la cuenta de login
  // Pueden estar desincronizados: perfiles viejos quedaron con `email` en
  // null, así que buscar sólo en `users` no los encuentra, el código creía
  // que era gente nueva e intentaba crear la cuenta de login → Supabase
  // respondía "A user with this email address has already been registered"
  // y la conversión quedaba trabada sin forma de destrabarla desde la UI.
  const { data: existing } = await auth.admin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let userId: string | null = (existing as { id: string } | null)?.id ?? null;
  if (!userId) userId = await buscarIdEnAuth(auth.admin, email);

  if (userId) {
    // Ya tiene cuenta de login. Activamos el programa sin tocar la contraseña.
    const activacion = {
      program_member: true,
      lifecycle_stage: 'onboarding',
      lifecycle_changed_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      planilla_id,
    };

    const { data: perfil } = await auth.admin
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    // Ojo: si el perfil YA existe no le tocamos el `rol`. Puede ser un admin
    // o un profe al que también se le da acceso al programa; pisarlo con
    // 'alumno' le sacaría los permisos.
    const { error: upErr } = perfil
      ? await auth.admin.from('users').update({ ...activacion, email }).eq('id', userId)
      : await auth.admin.from('users').insert({ id: userId, nombre, email, rol: 'alumno', ...activacion });

    if (upErr) {
      console.error('[convert] users activar failed', upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  } else {
    // 1a. Crear auth.user
    const { data: created, error: authErr } = await auth.admin.auth.admin.createUser({
      email,
      password: password || undefined,
      email_confirm: true,
      user_metadata: { nombre },
    });
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });
    if (!created?.user?.id) return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 });
    userId = created.user.id;

    // 1b. Crear row en users
    const { error: insErr } = await auth.admin.from('users').insert({
      id: userId,
      nombre,
      email,
      rol: 'alumno',
      program_member: true,
      lifecycle_stage: 'onboarding',
      lifecycle_changed_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      planilla_id,
    });
    if (insErr) {
      console.error('[convert] users insert failed', insErr);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // 1c. Mandar magic link / reset password si no se pasó password
    if (!password) {
      try {
        await auth.admin.auth.admin.generateLink({ type: 'magiclink', email });
      } catch { /* opcional */ }
    }
  }

  // 2. Cargar planilla
  try {
    const { getPlanillaForSave } = await import('@/lib/planillas');
    const modules = getPlanillaForSave(planilla_id);
    if (modules) {
      const courseRows = modules.map((m) => ({
        user_id: userId,
        module_id: m.module_id,
        semana_numero: m.semana_numero,
        titulo: m.titulo,
        descripcion: m.descripcion,
        lessons: m.lessons,
        updated_at: new Date().toISOString(),
      }));
      await auth.admin.from('course_data').upsert(courseRows, { onConflict: 'user_id,module_id' });
    }
  } catch (err) {
    console.error('[convert] planilla load failed', err);
  }

  // 3. Desbloquear meses iniciales
  if (mesesIniciales.length > 0) {
    const blocks = MONTH_RANGES.filter((b) => mesesIniciales.includes(b.mes));
    const semanasToUnlock = blocks.flatMap((b) => b.semanas);
    const { data: courseMods } = await auth.admin
      .from('course_data')
      .select('module_id, semana_numero')
      .eq('user_id', userId)
      .in('semana_numero', semanasToUnlock);
    const moduleIds = ((courseMods as { module_id: string }[] | null) || []).map((r) => r.module_id);
    if (moduleIds.length > 0) {
      // Intentamos con unlocked_at; fallback sin esa columna si la DB de
      // prod no la tiene en el schema cache.
      const baseRows = moduleIds.map((module_id) => ({ user_id: userId, module_id, is_unlocked: true }));
      const rowsTs = baseRows.map((r) => ({ ...r, unlocked_at: new Date().toISOString() }));
      const first = await auth.admin.from('user_access').upsert(rowsTs, { onConflict: 'user_id,module_id' });
      if (first.error && /unlocked_at.*schema cache|column .* does not exist/i.test(first.error.message)) {
        await auth.admin.from('user_access').upsert(baseRows, { onConflict: 'user_id,module_id' });
      }
    }
  }

  // 4. Actualizar lead
  const updates: Record<string, unknown> = {
    stage: 'convertido',
    converted_user_id: userId,
    booked: true,
    disqualified: false,
  };
  if (telefono) updates.telefono = telefono;
  await auth.admin.from('lead_quiz_responses').update(updates).eq('id', leadId);

  // 5. Notif al admin que convirtió
  try {
    const { createNotification } = await import('@/lib/notifications');
    await createNotification(auth.user.id, 'achievement', 'Lead convertido', `${nombre} ahora es alumno del programa.`, `/admin/${userId}`);
  } catch { /* silencioso */ }

  return NextResponse.json({ success: true, user_id: userId, lead_id: leadId });
}
