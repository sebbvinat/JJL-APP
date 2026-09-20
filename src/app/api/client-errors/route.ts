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

// Tope del pedido entero, antes de parsearlo. Los caps de arriba recortan lo
// que se GUARDA, pero sin esto igual se leía y parseaba un JSON de megas en un
// endpoint público. Un reporte legítimo (stack de 5000 + meta + url) pesa unos
// pocos KB aun con los escapes de JSON; 32 KB deja margen de sobra.
const MAX_BODY_CHARS = 32_000;

const NOTIFY_WINDOW_MS = 6 * 60 * 60 * 1000;
const NOTIFY_TITLE = 'Errores en la app';

/**
 * Errores que se GUARDAN en la tabla pero NO avisan a los admins.
 *
 * Son fallas del teléfono, de la red o del navegador embebido de otra app: no
 * las arregla ningún cambio en nuestro código. Como la alerta sale con el
 * primer error de cada ventana de 6 horas, este ruido la disparaba casi
 * siempre y además "gastaba" la ventana, así que un error real que llegaba
 * después no avisaba. Medido sobre los 407 errores guardados al 19/9: 249
 * caían en los primeros seis patrones y 120 más en el último.
 *
 * Se siguen guardando a propósito: si un día "Load failed" se dispara de
 * golpe, el dato está para verlo.
 *
 * Los de chunk ("Failed to load chunk ...") NO van acá: aparecen cuando hay un
 * deploy en curso y eso sí conviene saberlo.
 */
const RUIDO_CONOCIDO: RegExp[] = [
  // El navegador no pudo bajar o actualizar /sw.js: conexión cortada a mitad.
  /Failed to (update|register) a ServiceWorker/,
  // WebView de Android (navegador de Instagram/Facebook): el puente Java de la
  // app que lo contiene se destruyó mientras la página seguía viva.
  /Java (object is gone|exception was raised)/,
  // fetch cortado por la red. Safari dice "Load failed", Chrome "Failed to
  // fetch", Firefox "NetworkError ...". Anclados con ^$ para no tapar mensajes
  // nuestros que solo contengan esas palabras.
  /^Load failed$/,
  /^Failed to fetch$/,
  /NetworkError/,
  // Error de un script de otro dominio (GA, Calendly, ManyChat): el navegador
  // oculta el mensaje real, no hay nada para diagnosticar.
  /^Script error[.]?$/,
  // Navegador embebido de Instagram/Facebook en iOS: el script que inyecta la
  // app busca window.webkit.messageHandlers y no existe. En nuestro código no
  // hay ninguna referencia a window.webkit, y es el mensaje más repetido de la
  // tabla (120 de 407). No estaba en la lista original del plan: se sumó al
  // ver los datos.
  /window[.]webkit[.]messageHandlers/,
];

function esRuidoConocido(message: string | null): boolean {
  // Sin mensaje no se puede saber qué fue: que avise.
  if (!message) return false;
  return RUIDO_CONOCIDO.some((patron) => patron.test(message));
}

function clip(v: unknown, max: number): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  return v.trim().slice(0, max);
}

export async function POST(request: NextRequest) {
  // Primero el tamaño declarado (barato: ni se lee el cuerpo) y después el
  // real, porque el header puede faltar o mentir.
  const declarado = Number(request.headers.get('content-length') || 0);
  if (declarado > MAX_BODY_CHARS) {
    return NextResponse.json({ error: 'Reporte demasiado grande' }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    const crudo = await request.text();
    if (crudo.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: 'Reporte demasiado grande' }, { status: 413 });
    }
    const parseado: unknown = JSON.parse(crudo);
    // `null`, un número o un array son JSON válido: sin este chequeo,
    // leer `.event` de un null tiraba una excepción y el endpoint daba 500.
    if (!parseado || typeof parseado !== 'object' || Array.isArray(parseado)) {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    body = parseado as Record<string, unknown>;
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

  // El ruido conocido queda guardado (ya se insertó arriba) pero no avisa ni
  // consume la ventana de 6 horas. Ver RUIDO_CONOCIDO.
  if (esRuidoConocido(row.message)) {
    return NextResponse.json({ ok: true });
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
      const admins = (adminRows as { id: string; tags: string[] | null }[] | null) || [];
      // Van solo a quien tenga la marca "errores" (se asigna en Equipo y
      // permisos). Son avisos tecnicos: al profe o al setter no les sirven.
      // Si nadie la tiene todavia, van a todos los admins que no son setter,
      // como antes, para que un error nunca pase sin que nadie se entere.
      const conMarca = admins.filter((a) => (a.tags || []).includes('errores'));
      const adminIds = (conMarca.length > 0
        ? conMarca
        : admins.filter((a) => !(a.tags || []).includes('setter'))
      ).map((a) => a.id);

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
