'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  CalendarClock, AtSign, Check, Clock, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { useToast } from '@/components/ui/Toast';

type Tipo = 'calendario' | 'problema' | 'testimonio';

interface Item {
  tipo: Tipo;
  usuario: string;
  fecha: string;
  estado: 'pendiente' | 'pospuesto' | 'hecho';
  snooze_until: string | null;
  oculto: boolean;
}

interface Resp {
  dia: string;
  hoy: string;
  items: Item[];
  resumen: {
    total: number;
    pendientes: number;
    hechos: number;
    pospuestos: number;
    porTipo: Record<string, number>;
  };
  error?: string;
}

const TIPO_LABEL: Record<Tipo, string> = {
  calendario: 'Calendario',
  problema: 'Problema',
  testimonio: 'Testimonio',
};

const TIPO_STYLE: Record<Tipo, string> = {
  calendario: 'bg-blue-500/12 text-blue-300 border-blue-500/30',
  problema: 'bg-amber-500/12 text-amber-300 border-amber-500/30',
  testimonio: 'bg-purple-500/12 text-purple-300 border-purple-500/30',
};

function shiftDay(dia: string, delta: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function labelDia(dia: string, hoy: string): string {
  if (dia === hoy) return 'Hoy';
  if (dia === shiftDay(hoy, -1)) return 'Ayer';
  const [y, m, d] = dia.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

/**
 * Follow-ups que el setter tiene que hacer a mano.
 *
 * ManyChat manda los logs (calendario / problema / testimonio) y los registra
 * en la planilla del CRM. Acá se ven los del día anterior, que es cuando toca
 * seguirlos, con opción de posponer al día siguiente.
 */
export default function FollowupsPanel() {
  const toast = useToast();
  const [dia, setDia] = useState<string | null>(null); // null = ayer (default del server)
  const [filtro, setFiltro] = useState<Tipo | 'todos'>('todos');
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const key = dia ? `/api/admin/setter/followups?dia=${dia}` : '/api/admin/setter/followups';
  const { data, isLoading, mutate } = useSWR<Resp>(key, fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 300_000,
  });

  const hoy = data?.hoy ?? '';
  const diaActual = data?.dia ?? '';

  const visibles = (data?.items ?? [])
    .filter((i) => !i.oculto)
    .filter((i) => filtro === 'todos' || i.tipo === filtro);

  async function accion(item: Item, accion: 'posponer' | 'hecho' | 'reabrir') {
    const id = `${item.tipo}|${item.usuario}|${item.fecha}`;
    if (trabajando) return;
    setTrabajando(id);
    try {
      const res = await fetch('/api/admin/setter/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: item.tipo, usuario: item.usuario, fecha: item.fecha, accion }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'No se pudo guardar');
      await mutate();
      if (accion === 'posponer') toast.success(`${item.usuario} vuelve mañana`);
      if (accion === 'hecho') toast.success(`${item.usuario} marcado como contactado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setTrabajando(null);
    }
  }

  if (data?.error) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-200">
          <AlertTriangle className="h-4 w-4" /> No se pudieron leer los logs del CRM
        </p>
        <p className="mt-1 text-[12px] text-jjl-muted">{data.error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-jjl-border bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-jjl-border/60 bg-gradient-to-r from-white/[0.03] to-transparent">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-jjl-red/12 border border-jjl-red/25">
            <CalendarClock className="h-4 w-4 text-jjl-red" />
          </span>
          <div>
            <h3 className="text-[13px] font-bold text-white leading-tight">Follow-ups pendientes</h3>
            <p className="text-[11px] text-jjl-muted">Mensajes que mandó el bot — seguilos a mano</p>
          </div>
        </div>

        {/* Navegación de día */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setDia(shiftDay(diaActual || hoy, -1))}
            className="h-8 w-8 grid place-items-center rounded-lg border border-jjl-border text-jjl-muted hover:text-white hover:bg-white/5"
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[92px] text-center text-[12px] font-semibold text-white tabular-nums">
            {diaActual ? labelDia(diaActual, hoy) : '—'}
          </span>
          <button
            onClick={() => setDia(shiftDay(diaActual || hoy, 1))}
            disabled={!diaActual || diaActual >= hoy}
            className="h-8 w-8 grid place-items-center rounded-lg border border-jjl-border text-jjl-muted hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filtros por tipo */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-jjl-border/40">
        <Chip active={filtro === 'todos'} onClick={() => setFiltro('todos')}>
          Todos <span className="tabular-nums opacity-70">{data?.resumen.pendientes ?? 0}</span>
        </Chip>
        {(Object.keys(TIPO_LABEL) as Tipo[]).map((t) => (
          <Chip key={t} active={filtro === t} onClick={() => setFiltro(t)} tone={t}>
            {TIPO_LABEL[t]} <span className="tabular-nums opacity-70">{data?.resumen.porTipo?.[t] ?? 0}</span>
          </Chip>
        ))}
        {(data?.resumen.hechos ?? 0) > 0 && (
          <span className="ml-auto text-[11px] text-green-400/80">
            {data!.resumen.hechos} contactado{data!.resumen.hechos === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Lista */}
      <div className="divide-y divide-jjl-border/40 max-h-[420px] overflow-y-auto">
        {isLoading && !data ? (
          <div className="py-10 grid place-items-center">
            <div className="w-5 h-5 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visibles.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <p className="text-[13px] text-jjl-muted">
              {(data?.resumen.total ?? 0) === 0
                ? 'No se mandaron logs ese día.'
                : 'Todo al día — no queda nadie por seguir.'}
            </p>
            {(data?.resumen.pospuestos ?? 0) > 0 && (
              <p className="mt-1 text-[11px] text-jjl-muted/70">
                {data!.resumen.pospuestos} pospuesto{data!.resumen.pospuestos === 1 ? '' : 's'} para más adelante
              </p>
            )}
          </div>
        ) : (
          visibles.map((item) => {
            const id = `${item.tipo}|${item.usuario}|${item.fecha}`;
            const hecho = item.estado === 'hecho';
            const busy = trabajando === id;
            return (
              <div
                key={id}
                className={`flex items-center gap-2.5 px-4 py-2.5 ${hecho ? 'opacity-45' : 'hover:bg-white/[0.02]'}`}
              >
                <span
                  className={`shrink-0 inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-bold uppercase tracking-wider ${TIPO_STYLE[item.tipo]}`}
                >
                  {TIPO_LABEL[item.tipo]}
                </span>

                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-semibold text-white truncate ${hecho ? 'line-through' : ''}`}>
                    {item.usuario}
                  </p>
                  <p className="text-[11px] text-jjl-muted tabular-nums">
                    {new Date(item.fecha).toLocaleTimeString('es-AR', {
                      hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
                    })}
                    {item.estado === 'pospuesto' && item.snooze_until && ' · pospuesto'}
                  </p>
                </div>

                <a
                  href={`https://www.instagram.com/${encodeURIComponent(item.usuario.replace(/^@/, ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buscar en Instagram"
                  className="shrink-0 h-8 w-8 grid place-items-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
                >
                  <AtSign className="h-3.5 w-3.5" />
                </a>

                {hecho ? (
                  <button
                    onClick={() => accion(item, 'reabrir')}
                    disabled={busy}
                    title="Volver a pendiente"
                    className="shrink-0 h-8 w-8 grid place-items-center rounded-lg border border-jjl-border text-jjl-muted hover:text-white disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => accion(item, 'posponer')}
                      disabled={busy}
                      title="Posponer — vuelve mañana"
                      className="shrink-0 inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-jjl-border text-[11px] font-semibold text-jjl-muted hover:text-white hover:bg-white/5 disabled:opacity-40"
                    >
                      <Clock className="h-3.5 w-3.5" /> Mañana
                    </button>
                    <button
                      onClick={() => accion(item, 'hecho')}
                      disabled={busy}
                      title="Ya le hablé"
                      className="shrink-0 inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-green-500/40 bg-green-500/10 text-[11px] font-semibold text-green-300 hover:bg-green-500/20 disabled:opacity-40"
                    >
                      <Check className="h-3.5 w-3.5" /> Ya le hablé
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Chip({
  children, active, onClick, tone,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tone?: Tipo;
}) {
  const activeCls = tone ? TIPO_STYLE[tone] : 'bg-white/10 text-white border-white/25';
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border text-[11px] font-semibold transition-colors ${
        active ? activeCls : 'border-jjl-border text-jjl-muted hover:text-white hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}
