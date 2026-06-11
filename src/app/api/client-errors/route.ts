import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Error-tracking interno. El browser reporta acá los errores de los alumnos
 * (via logger.error + listeners globales) y quedan en la tabla
 * `client_errors` para diagnosticar sin esperar la queja.
 *
 * Además, el PRIMER error de cada ventana de 6 horas dispara una
 * notificación a los admins (sin setter) — enterarse al toque, sin spam.
 */

export const runtime = 'nodejs';

// Caps defensivos: nadie necesita más que esto para diagnosticar, y evita
// que un cliente malicioso infle la tabla con payloads gigantes.
const MAX = { event: 200, message: 600, stack: 5000, url: 600, ua: 300 } as const;

const NOTIFY_WINDOW_MS = 6 * 60 * 60 * 1000;
const NOTIFY_TITLE = 'Errores en la app';

function clip(v: unknown, max: number): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  return v.trim().slice(0, max);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const event = clip(body.event, MAX.event);
  if (!event) return NextResponse.json({ error: 'event requerido' }, { status: 400 });

  // Usuario opcional: errores del login/landing también valen.
  let userId: string | null = null;
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {}

  const admin = createAdminSupabaseClient();
  const row = {
    user_id: userId,
    event,
    message: clip(body.message, MAX.message),
    stack: clip(body.stack, MAX.stack),
    url: clip(body.url, MAX.url),
    user_agent: clip(request.headers.get('user-agent'), MAX.ua),
  };

  const { error: insertError } = await admin.from('client_errors').insert(row);
  if (insertError) {
    // Tabla sin crear (migración pendiente) u otro problema: lo dejamos en
    // los logs del server y respondemos 200 — el reporte de errores jamás
    // debe romper nada en el cliente.
    logger.error('client-errors.insert.failed', { err: insertError.message, event });
    return NextResponse.json({ ok: false });
  }

  // ── Aviso a admins, con throttle de 6h para no spamear ──
  try {
    const since = new Date(Date.now() - NOTIFY_WINDOW_MS).toISOString();
    const { data: recent } = await admin
      .from('notifications')
      .select('id')
      .eq('titulo', NOTIFY_TITLE)
      .gte('created_at', since)
      .limit(1);

    if (!recent || recent.length === 0) {
      const { createNotification } = await import('@/lib/notifications');
      const { data: adminRows } = await admin
        .from('users')
        .select('id, tags')
        .eq('rol', 'admin');
      const adminIds = ((adminRows as { id: string; tags: string[] | null }[] | null) || [])
        .filter((a) => !(a.tags || []).includes('setter'))
        .map((a) => a.id);

      for (const id of adminIds) {
        await createNotification(
          id,
          'system',
          NOTIFY_TITLE,
          `Un usuario tuvo un error en la app (${event}). Detalle en Supabase → client_errors.`,
          '/admin'
        );
      }
    }
  } catch (err) {
    logger.error('client-errors.notify.failed', { err });
  }

  return NextResponse.json({ ok: true });
}
