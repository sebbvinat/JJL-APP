'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { CalendarDays, Video, Mail, Phone, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
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

/**
 * Todo se agrupa por el día ARGENTINO, no por el del navegador ni el UTC.
 * Una consultoría de las 22:00 es de hoy, no de mañana.
 */
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

const HOY = () => diaDe(new Date().toISOString());

/** "lunes 17 de agosto" — el encabezado del día elegido. */
function tituloLargo(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number);
  const t = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(y, m - 1, d, 12));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function nombreMes(y: number, m: number): string {
  const t = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(
    new Date(y, m, 1, 12),
  );
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Celdas del mes, arrancando el lunes. Las de relleno (del mes anterior y el
 * siguiente) van como null para que la grilla quede pareja.
 */
function celdasDelMes(y: number, m: number): (string | null)[] {
  const primero = new Date(y, m, 1, 12);
  // getDay() da 0=domingo; lo pasamos a 0=lunes.
  const offset = (primero.getDay() + 6) % 7;
  const cantidad = new Date(y, m + 1, 0, 12).getDate();
  const celdas: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= cantidad; d++) {
    celdas.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (celdas.length % 7 !== 0) celdas.push(null);
  return celdas;
}

export default function AgendaCalendly() {
  // Traemos un mes para atrás y tres para adelante de una sola vez: al volumen
  // actual son ~60 consultorías, entra en una request y navegar por los meses
  // no vuelve a pegarle a Calendly.
  const { data, isLoading } = useSWR<Resp>('/api/admin/setter/agenda?atras=31&dias=90', fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 300_000,
    dedupingInterval: 60_000,
  });

  const hoy = HOY();
  const [ancla, setAncla] = useState(() => {
    const [y, m] = hoy.split('-').map(Number);
    return { y, m: m - 1 };
  });
  const [elegido, setElegido] = useState<string | null>(null);

  /** dia (YYYY-MM-DD) → consultorías de ese día, ordenadas por hora. */
  const porDia = useMemo(() => {
    const g = new Map<string, Item[]>();
    for (const it of data?.items || []) {
      const d = diaDe(it.inicio);
      if (!g.has(d)) g.set(d, []);
      g.get(d)!.push(it);
    }
    for (const arr of g.values()) arr.sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    return g;
  }, [data]);

  // Al abrir, pararse en el día útil: hoy si hay algo, si no la próxima fecha
  // con consultorías. Abrir en un día vacío obliga a buscar a mano.
  useEffect(() => {
    if (elegido || !data) return;
    if (porDia.has(hoy)) {
      setElegido(hoy);
      return;
    }
    const proxima = [...porDia.keys()].filter((d) => d >= hoy).sort()[0];
    setElegido(proxima || hoy);
    if (proxima) {
      const [y, m] = proxima.split('-').map(Number);
      setAncla({ y, m: m - 1 });
    }
  }, [data, porDia, hoy, elegido]);

  const celdas = useMemo(() => celdasDelMes(ancla.y, ancla.m), [ancla]);
  const delDia = useMemo(() => (elegido ? porDia.get(elegido) || [] : []), [elegido, porDia]);

  // Nombre, mail y teléfono SOLO del día abierto. Traerlos para todo el mes
  // es una llamada a Calendly por evento y a ese volumen se corta: con 77
  // eventos se perdían 33 nombres. Así son 2 a 7 llamadas y llegan todos.
  const idsDelDia = delDia.map((i) => i.id).join(',');
  const { data: detalle, isLoading: cargandoDetalle } = useSWR<{ invitados: Record<string, Item['invitado']> }>(
    idsDelDia ? `/api/admin/setter/agenda?ids=${idsDelDia}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const invitadoDe = (it: Item) => detalle?.invitados?.[it.id] ?? it.invitado;

  function moverMes(delta: number) {
    setAncla(({ y, m }) => {
      const d = new Date(y, m + delta, 1, 12);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

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
      {/* Barra del mes */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-jjl-border">
        <CalendarDays className="h-4 w-4 text-jjl-red shrink-0" />
        <p className="text-[13px] font-bold text-white">Consultorías</p>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => moverMes(-1)}
            aria-label="Mes anterior"
            className="h-8 w-8 grid place-items-center rounded-lg border border-jjl-border text-jjl-muted hover:text-white hover:bg-white/5"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[8.5rem] text-center text-[13px] font-semibold text-white tabular-nums">
            {nombreMes(ancla.y, ancla.m)}
          </span>
          <button
            type="button"
            onClick={() => moverMes(1)}
            aria-label="Mes siguiente"
            className="h-8 w-8 grid place-items-center rounded-lg border border-jjl-border text-jjl-muted hover:text-white hover:bg-white/5"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Grilla del mes */}
          <div className="px-3 pt-3 pb-1">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DIAS_SEMANA.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-bold uppercase tracking-wider text-jjl-muted/70 py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {celdas.map((dia, i) => {
                if (!dia) return <div key={i} />;
                const items = porDia.get(dia) || [];
                const activas = items.filter((x) => !x.cancelado).length;
                const esHoy = dia === hoy;
                const esElegido = dia === elegido;
                const num = Number(dia.slice(-2));

                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => setElegido(dia)}
                    disabled={items.length === 0}
                    aria-label={`${num}${activas ? `, ${activas} consultorías` : ', sin consultorías'}`}
                    className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-colors ${
                      esElegido
                        ? 'bg-jjl-red text-white font-bold'
                        : items.length > 0
                          ? 'bg-white/[0.06] text-white hover:bg-white/[0.12] cursor-pointer'
                          : 'text-jjl-muted/40 cursor-default'
                    } ${esHoy && !esElegido ? 'ring-1 ring-jjl-red/60' : ''}`}
                  >
                    <span className="text-[13px] tabular-nums leading-none">{num}</span>
                    {/* Un punto por consultoría, hasta 3. Se lee de un vistazo
                        cuáles son los días cargados sin tener que abrirlos. */}
                    {items.length > 0 && (
                      <span className="absolute bottom-1.5 flex gap-0.5">
                        {items.slice(0, 3).map((it, k) => (
                          <span
                            key={k}
                            className={`h-1 w-1 rounded-full ${
                              it.cancelado
                                ? esElegido ? 'bg-white/40' : 'bg-jjl-muted/50'
                                : esElegido ? 'bg-white' : 'bg-jjl-red'
                            }`}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Día elegido */}
          <div className="border-t border-jjl-border mt-2">
            <div className="flex items-baseline gap-2 px-4 py-2.5">
              <p className="text-[13px] font-bold text-white">
                {elegido ? tituloLargo(elegido) : '—'}
              </p>
              <p className="text-[11px] text-jjl-muted">
                {delDia.length === 0
                  ? 'sin consultorías'
                  : `${delDia.length} consultoría${delDia.length === 1 ? '' : 's'}`}
              </p>
            </div>

            {delDia.length === 0 ? (
              <p className="px-4 pb-5 text-[12px] text-jjl-muted/70">
                Tocá un día marcado en el calendario para ver quién viene.
              </p>
            ) : (
              delDia.map((it) => {
                const inv = invitadoDe(it);
                return (
                <div
                  key={it.id}
                  className={`flex gap-3 px-4 py-3 border-t border-jjl-border/50 ${it.cancelado ? 'opacity-50' : ''}`}
                >
                  {/* Horario a la izquierda, como en un calendario de verdad */}
                  <div className="shrink-0 w-12 text-right">
                    <p className={`text-[15px] font-bold tabular-nums leading-tight ${it.cancelado ? 'text-jjl-muted' : 'text-white'}`}>
                      {horaDe(it.inicio)}
                    </p>
                    <p className="text-[10px] text-jjl-muted tabular-nums">{horaDe(it.fin)}</p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-[14px] font-semibold ${it.cancelado ? 'line-through text-jjl-muted' : 'text-white'}`}>
                        {inv?.nombre || (cargandoDetalle ? 'Cargando…' : 'Sin nombre')}
                      </p>
                      {it.cancelado && (
                        <span className="shrink-0 inline-flex items-center gap-1 h-5 px-1.5 rounded border border-red-500/30 bg-red-500/10 text-[10px] font-bold uppercase tracking-wider text-red-300">
                          <XCircle className="h-3 w-3" />
                          Cancelada
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      {inv?.email && (
                        <a
                          href={`mailto:`}
                          className="inline-flex items-center gap-1 text-jjl-muted hover:text-white transition-colors"
                        >
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[14rem]">{inv.email}</span>
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
                    </div>
                  </div>

                  {it.joinUrl && !it.cancelado && (
                    <a
                      href={it.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="self-center shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-jjl-red text-white text-[11px] font-bold hover:bg-jjl-red/85 transition-colors"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Entrar
                    </a>
                  )}
                </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
