import { NextResponse, type NextRequest } from 'next/server';
import { createRouteSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/** Los grados que puede elegir. Cerrado a estos: es lo que muestra el Badge. */
const CINTURONES = ['white', 'blue', 'purple', 'brown', 'black'] as const;

/**
 * POST /api/profile/cinturon
 * Body: { cinturon: 'white' | 'blue' | 'purple' | 'brown' | 'black' }
 *
 * El alumno declara su propio cinturón. Antes lo calculaba la app por
 * progreso en el programa y pisaba lo que hubiera — el cinturón es un grado
 * que se da en el tatami, no algo que se gane completando videos.
 *
 * Se escribe con service role y no desde el cliente porque
 * `cinturon_confirmado_at` no está en el GRANT de columnas que puede tocar
 * un usuario autenticado (ver el REVOKE/GRANT sobre public.users).
 */
export async function POST(request: NextRequest) {
  const supabase = createRouteSupabaseClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: { cinturon?: unknown };
  try {
    body = (await request.json()) as { cinturon?: unknown };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const cinturon = String(body?.cinturon || '');
  if (!(CINTURONES as readonly string[]).includes(cinturon)) {
    return NextResponse.json({ error: 'Cinturón inválido' }, { status: 400 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from('users')
      .update({ cinturon_actual: cinturon, cinturon_confirmado_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      // Si la migración todavía no corrió, guardamos al menos el cinturón:
      // vale más que quede elegido aunque el cartel vuelva a aparecer.
      if (/cinturon_confirmado_at/.test(error.message || '')) {
        const { error: e2 } = await admin
          .from('users')
          .update({ cinturon_actual: cinturon })
          .eq('id', user.id);
        if (!e2) return NextResponse.json({ ok: true, sinMigracion: true });
      }
      logger.error('profile.cinturon.update.failed', { err: error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('profile.cinturon.unhandled', { err });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
