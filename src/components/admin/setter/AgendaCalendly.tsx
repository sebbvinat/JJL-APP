'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { CalendarDays, Video, Mail, Phone, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
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

export default function AgendaCalendly() {
  const [abierto, setAbierto] = useState(true);

  const { data, isLoading } = useSWR<Resp>('/api/admin/setter/agenda', fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 300_000,
    dedupingInterval: 60_000,
  });

  const items = useMemo(() => data?.items || [], [data]);

  // Agrupadas por día, respetando el orden que ya viene del server.
  const porDia = useMemo(() => {
    const g = new Map<string, Item[]>();
    for (const it of items) {
      const d = diaDe(it.inicio);
      if (!g.has(d)) g.set(d, []);
      g.get(d)!.push(it);
    }
    return [...g.entries()];
  }, [items]);

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
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <CalendarDays className="h-4 w-4 text-jjl-red shrink-0" />
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-white">Consultorías agendadas</p>
          <p className="text-[11px] text-jjl-muted">
            {isLoading && !data
              ? 'Cargando…'
              : activas === 0
                ? 'No hay consultorías próximas'
                : `${activas} próxima${activas === 1 ? '' : 's'} · directo de Calendly`}
          </p>
        </div>
        {abierto
          ? <ChevronUp className="ml-auto h-4 w-4 text-jjl-muted shrink-0" />
          : <ChevronDown className="ml-auto h-4 w-4 text-jjl-muted shrink-0" />}
      </button>

      {abierto && (
        <div className="border-t border-jjl-border">
          {isLoading && !data ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
            </div>
          ) : porDia.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-jjl-muted">
              No hay consultorías agendadas en los próximos 30 días.
            </p>
          ) : (
            porDia.map(([dia, delDia]) => (
              <div key={dia}>
                <p className="px-4 py-1.5 bg-white/[0.03] text-[10px] font-bold uppercase tracking-wider text-jjl-muted">
                  {tituloDia(dia)}
                </p>
                {delDia.map((it) => (
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
                        {it.invitado?.nombre || 'Sin nombre'}
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
                      {it.invitado?.email && (
                        <a
                          href={`mailto:${it.invitado.email}`}
                          className="inline-flex items-center gap-1 text-jjl-muted hover:text-white transition-colors"
                        >
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[15rem]">{it.invitado.email}</span>
                        </a>
                      )}
                      {it.invitado?.telefono && (
                        <a
                          href={`https://wa.me/${it.invitado.telefono.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-jjl-muted hover:text-white transition-colors"
                        >
                          <Phone className="h-3 w-3 shrink-0" />
                          {it.invitado.telefono}
                        </a>
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
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
