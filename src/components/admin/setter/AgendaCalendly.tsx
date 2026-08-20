'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { CalendarDays, Video, Mail, Phone, ChevronDown, ChevronUp, XCircle, UserPlus, Search } from 'lucide-react';
import ConvertToAlumnoModal from './ConvertToAlumnoModal';
import { useToast } from '@/components/ui/Toast';
import { fetcher } from '@/lib/fetcher';
import { APP_TZ } from '@/lib/dates';

interface Item {
  id: string;
  evento: string;
  inicio: string;
  fin: string;
  cancelado: boolean;
  cancelacion: { por: string; motivo: string | null } | null;
  joinUrl: string | null;
  invitado: { nombre: string | null; email: string | null; telefono: string | null } | null;
}

interface Resp {
  items: Item[];
  setupRequired?: boolean;
  error?: string;
}

/** YYYY-MM-DD del evento en horario argentino, que es la clave para agrupar por día. */
function diaDe(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function horaDe(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: APP_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** "Hoy" / "Mañana" leen mucho más rápido que la fecha cuando estás laburando. */
function tituloDia(dia: string): string {
  const hoy = diaDe(new Date().toISOString());
  const manana = diaDe(new Date(Date.now() + 86_400_000).toISOString());
  if (dia === hoy) return 'Hoy';
  if (dia === manana) return 'Mañana';
  const [y, m, d] = dia.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(new Date(y, m - 1, d));
}

/**
 * `puedeCrear`: solo los admin plenos dan de alta alumnos. El setter ve la
 * agenda (le sirve para su trabajo) pero no el boton, porque /api/admin/alumnos
 * no esta en su whitelist y crear una cuenta da acceso al programa. Mostrarle
 * un boton que le va a devolver 403 es peor que no mostrarlo.
 */
export default function AgendaCalendly({ puedeCrear = false }: { puedeCrear?: boolean }) {
  const [abierto, setAbierto] = useState(true);
  const [pasadas, setPasadas] = useState(false);
  const [creando, setCreando] = useState<{ nombre: string | null; email: string | null; telefono: string | null } | null>(null);
  const toast = useToast();

  const [busqueda, setBusqueda] = useState('');
  const emailBuscado = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(busqueda.trim()) ? busqueda.trim().toLowerCase() : '';

  // Buscar por mail va contra Calendly, que filtra del lado del servidor y sin
  // limite de fecha. Es la salida para las ventas cerradas hace mas de dos
  // semanas, que ya no entran en la ventana del listado.
  const { data: encontrado, isLoading: buscando } = useSWR<Resp>(
    emailBuscado ? `/api/admin/setter/agenda?email=${encodeURIComponent(emailBuscado)}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  // "Pasadas" es lo que se mira para dar de alta a los que compraron: en la
  // consultoria la persona figura con nombre y mail reales, que es justo lo
  // que los leads no tienen (el quiz solo guarda el Instagram).
  const url = pasadas
    // 14 dias y no mas: los datos del invitado se piden de a 40 por request
    // y 3 semanas daban 62 consultorias, asi que 22 quedaban sin nombre. Ademas
    // es la ventana real de trabajo: quien compro esta semana.
    ? '/api/admin/setter/agenda?atras=14&dias=1'
    : '/api/admin/setter/agenda';

  const { data, isLoading } = useSWR<Resp>(url, fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 300_000,
    dedupingInterval: 60_000,
  });

  const items = useMemo(
    () => (emailBuscado ? encontrado?.items || [] : data?.items || []),
    [data, encontrado, emailBuscado],
  );

  // Nombre, mail y teléfono van en una request aparte. Son una llamada a
  // Calendly por evento, así que el listado no las incluye: pedirlas todas
  // juntas hacía que Calendly cortara y se perdieran nombres.
  const ids = items.map((i) => i.id).join(',');
  const { data: detalle } = useSWR<{ invitados: Record<string, Item['invitado']> }>(
    ids && !emailBuscado ? `/api/admin/setter/agenda?ids=${ids}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const invitadoDe = (it: Item) => detalle?.invitados?.[it.id] ?? it.invitado;

  // Agrupadas por día. En "pasadas" se invierte: lo primero que se busca es
  // la call de recién, no la de hace tres semanas.
  const porDia = useMemo(() => {
    const g = new Map<string, Item[]>();
    for (const it of items) {
      const d = diaDe(it.inicio);
      if (!g.has(d)) g.set(d, []);
      g.get(d)!.push(it);
    }
    const e = [...g.entries()];
    return pasadas ? e.reverse() : e;
  }, [items, pasadas]);

  const activas = items.filter((i) => !i.cancelado).length;

  // Aviso con los pasos concretos: el que abre este panel es quien puede
  // resolverlo, y "falta CALENDLY_TOKEN" no le dice qué hacer.
  if (data?.setupRequired) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-2">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-200">
          <CalendarDays className="h-4 w-4 shrink-0" />
          Falta conectar Calendly
        </p>
        <ol className="ml-5 list-decimal space-y-1 text-[12px] text-amber-200/80">
          <li>
            En Calendly, entrá a{' '}
            <a
              href="https://calendly.com/integrations/api_webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              Integrations &amp; apps → API &amp; webhooks
            </a>{' '}
            y generá un <em>Personal Access Token</em>.
          </li>
          <li>
            En Vercel → Settings → Environment Variables, agregá{' '}
            <code className="text-[11px]">CALENDLY_TOKEN</code> con ese valor.
          </li>
          <li>Redeploy. Las consultorías aparecen acá solas.</li>
        </ol>
      </div>
    );
  }

  if (data?.error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-300">
        No se pudo leer la agenda de Calendly. Probá recargar en un rato.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-jjl-border bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex items-center gap-2.5 min-w-0 text-left"
        >
          <CalendarDays className="h-4 w-4 text-jjl-red shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-white">Consultorías</p>
            <p className="text-[11px] text-jjl-muted">
              {isLoading && !data
                ? 'Cargando…'
                : activas === 0
                  ? pasadas ? 'Ninguna en las últimas 2 semanas' : 'No hay próximas'
                  : `${activas} ${pasadas ? 'en las últimas 2 semanas' : 'próximas'}`}
            </p>
          </div>
        </button>

        <div className="ml-auto flex rounded-lg border border-jjl-border overflow-hidden shrink-0">
          {[
            { v: false, label: 'Próximas' },
            { v: true, label: 'Pasadas' },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => { setPasadas(o.v); setAbierto(true); }}
              className={`h-8 px-3 text-[11px] font-semibold transition-colors ${
                pasadas === o.v ? 'bg-jjl-red text-white' : 'text-jjl-muted hover:text-white hover:bg-white/5'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-label={abierto ? 'Plegar' : 'Desplegar'}
          className="shrink-0 text-jjl-muted hover:text-white"
        >
          {abierto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Buscar por mail: la lista muestra 2 semanas, pero una venta puede
          haberse cerrado mucho antes. Calendly filtra por invitado sin limite
          de fecha, asi que con el mail se llega a cualquiera. */}
      {abierto && pasadas && (
        <div className="px-4 pb-3 border-t border-jjl-border pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-jjl-muted pointer-events-none" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="¿Es de hace más de 2 semanas? Pegá el mail acá"
              className="w-full h-9 pl-10 pr-3 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red"
            />
          </div>
          {busqueda.trim() && !emailBuscado && (
            <p className="mt-1.5 text-[11px] text-jjl-muted">Escribí el mail completo.</p>
          )}
          {emailBuscado && !buscando && items.length === 0 && (
            <p className="mt-1.5 text-[11px] text-amber-300/80">
              Esa persona no agendó nunca por Calendly. Creale el usuario desde el lead.
            </p>
          )}
        </div>
      )}

      {/* Alto máximo con scroll propio: el panel es lo primero de la página y
          si crece con cada consultoría empuja el Kanban fuera de la pantalla.
          Así ocupa siempre lo mismo y el resto queda a la vista. */}
      {abierto && (
        <div className="border-t border-jjl-border max-h-[22rem] overflow-y-auto">
          {(isLoading && !data) || buscando ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
            </div>
          ) : porDia.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-jjl-muted">
              {pasadas
                ? 'No hubo consultorías en las últimas 2 semanas.'
                : 'No hay consultorías agendadas en los próximos 30 días.'}
            </p>
          ) : (
            porDia.map(([dia, delDia]) => (
              <div key={dia}>
                <p className="px-4 py-1.5 bg-white/[0.03] text-[10px] font-bold uppercase tracking-wider text-jjl-muted">
                  {tituloDia(dia)}
                </p>
                {delDia.map((it) => {
                  const inv = invitadoDe(it);
                  return (
                  <div
                    key={it.id}
                    className={`px-4 py-2.5 border-t border-jjl-border/50 ${it.cancelado ? 'opacity-50' : ''}`}
                  >
                    {/* Linea 1: horario + nombre. En celu el nombre se corta, no rompe el layout. */}
                    <div className="flex items-center gap-2.5">
                      <span className="shrink-0 text-[13px] font-bold tabular-nums text-white">
                        {horaDe(it.inicio)}
                      </span>
                      <span className={`truncate text-[13px] ${it.cancelado ? 'line-through text-jjl-muted' : 'text-white'}`}>
                        {inv?.nombre || 'Sin nombre'}
                      </span>
                      {it.cancelado && (
                        <span className="shrink-0 inline-flex items-center gap-1 h-5 px-1.5 rounded border border-red-500/30 bg-red-500/10 text-[10px] font-bold uppercase tracking-wider text-red-300">
                          <XCircle className="h-3 w-3" />
                          Cancelada
                        </span>
                      )}
                    </div>

                    {/* Linea 2: contacto + link. Todo clickeable para no copiar a mano. */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[3.1rem] text-[11px]">
                      {inv?.email && (
                        <a
                          href={`mailto:`}
                          className="inline-flex items-center gap-1 text-jjl-muted hover:text-white transition-colors"
                        >
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[15rem]">{inv.email}</span>
                        </a>
                      )}
                      {inv?.telefono && (
                        <a
                          href={`https://wa.me/${inv.telefono.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-jjl-muted hover:text-white transition-colors"
                        >
                          <Phone className="h-3 w-3 shrink-0" />
                          {inv.telefono}
                        </a>
                      )}
                      {/* Este es el atajo que evita tener que buscar al lead:
                          la consultoria ya trae nombre y mail reales, asi que
                          el alta arranca con todo cargado. */}
                      {puedeCrear && (pasadas || emailBuscado) && !it.cancelado && inv?.email && (
                        <button
                          type="button"
                          onClick={() => setCreando({ nombre: inv.nombre, email: inv.email, telefono: inv.telefono })}
                          className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-green-500/15 border border-green-500/40 text-[11px] font-bold text-green-300 hover:bg-green-500/25"
                        >
                          <UserPlus className="h-3 w-3" />
                          Crear alumno
                        </button>
                      )}
                      {it.joinUrl && !it.cancelado && (
                        <a
                          href={it.joinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-jjl-red hover:text-white transition-colors"
                        >
                          <Video className="h-3 w-3 shrink-0" />
                          Entrar a la reunión
                        </a>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}

      {creando && (
        <ConvertToAlumnoModal
          prefill={creando}
          onClose={() => setCreando(null)}
          onConverted={({ user_id }) => {
            setCreando(null);
            toast.success('Alumno creado. Redirigiendo…');
            setTimeout(() => { window.location.href = `/admin/${user_id}`; }, 800);
          }}
        />
      )}
    </div>
  );
}
