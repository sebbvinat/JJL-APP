'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { CalendarClock, AtSign, Check, Clock, RotateCcw, AlertTriangle } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { useToast } from '@/components/ui/Toast';
import { APP_TZ } from '@/lib/dates';

interface Item {
  tipo: string;
  usuario: string;
  fecha: string;
  estado: 'pendiente' | 'pospuesto' | 'hecho';
  snooze_until: string | null;
  oculto: boolean;
}

interface EtiquetaResp {
  tipo: string;
  tab: string;
  label: string;
  silenciada: boolean;
  total: number;
  pendientes: number;
}

interface Resp {
  horas: number;
  hoy: string;
  etiquetas: EtiquetaResp[];
  items: Item[];
  resumen: { total: number; pendientes: number; hechos: number; pospuestos: number };
  error?: string;
}

const VENTANAS = [
  { horas: 24, label: '24 h' },
  { horas: 48, label: '48 h' },
  { horas: 168, label: '7 días' },
];

/**
 * ManyChat reporta el nombre visible de Instagram, que no siempre es el @.
 * Si parece un handle vamos derecho al perfil; si tiene espacios o acentos
 * (ej "Clases de ingles online") abrimos la búsqueda, que es lo mejor que se
 * puede hacer sin el usuario real.
 */
function esHandle(usuario: string): boolean {
  const u = usuario.trim().replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(u);
}

function instagramUrl(usuario: string): string {
  const u = usuario.trim().replace(/^@/, '');
  return esHandle(u)
    ? `https://www.instagram.com/${encodeURIComponent(u)}`
    : `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(u)}`;
}

/** "hace 3 h" lee más rápido que una fecha cuando estás filtrando por ventana. */
function haceCuanto(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `hace ${Math.max(min, 1)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

function cuando(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: APP_TZ,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export default function FollowupsPanel() {
  const [horas, setHoras] = useState(24);
  const [seleccion, setSeleccion] = useState<string[] | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const toast = useToast();

  const { data, isLoading, mutate } = useSWR<Resp>(
    `/api/admin/setter/followups?horas=${horas}`,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 300_000, dedupingInterval: 30_000 },
  );

  const etiquetas = useMemo(() => data?.etiquetas || [], [data]);

  /**
   * Solo mostramos chips de etiquetas con algo en la ventana. Varias están
   * muertas (Outbound, Form, Calificado, No agendó) y `seguidores` guarda la
   * fecha sin el nombre, así que nunca produce un follow-up. Mostrarlas en
   * cero sería ruido; al cambiar de ventana aparecen las que sí tienen.
   */
  const chips = useMemo(
    () => etiquetas.filter((e) => e.total > 0),
    [etiquetas],
  );

  /**
   * Sin elección explícita se muestran todas las etiquetas menos las
   * silenciadas. La selección es sobre `etiquetas`, no sobre `chips`: si una
   * etiqueta no tiene chip por estar vacía tampoco tiene items, así que no
   * cambia nada, pero evita que al cambiar de ventana se "apague" sola.
   */
  const activas = useMemo(() => {
    if (seleccion) return seleccion;
    return etiquetas.filter((e) => !e.silenciada).map((e) => e.tipo);
  }, [seleccion, etiquetas]);

  function toggle(tipo: string) {
    setSeleccion(activas.includes(tipo) ? activas.filter((t) => t !== tipo) : [...activas, tipo]);
  }

  const visibles = useMemo(
    () => (data?.items || []).filter((i) => activas.includes(i.tipo) && !i.oculto),
    [data, activas],
  );

  const pendientes = visibles.filter((i) => i.estado !== 'hecho').length;

  const labelDe = useMemo(() => {
    const m = new Map(etiquetas.map((e) => [e.tipo, e.label]));
    return (t: string) => m.get(t) || t;
  }, [etiquetas]);

  async function accion(item: Item, accion: 'posponer' | 'hecho' | 'reabrir') {
    const key = `${item.tipo}|${item.usuario}|${item.fecha}`;
    setGuardando(key);
    try {
      const res = await fetch('/api/admin/setter/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: item.tipo, usuario: item.usuario, fecha: item.fecha, accion }),
      });
      if (!res.ok) throw new Error('falló');
      await mutate();
    } catch {
      toast.error('No se pudo guardar — probá de nuevo');
    } finally {
      setGuardando(null);
    }
  }

  if (data?.error) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="flex items-center gap-2 text-[13px] text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {data.error}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-jjl-border bg-white/[0.02] overflow-hidden">
      {/* Encabezado + ventana de tiempo */}
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
        <CalendarClock className="h-4 w-4 text-jjl-red shrink-0" />
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-white">Follow-ups pendientes</p>
          <p className="text-[11px] text-jjl-muted">
            {isLoading && !data ? 'Cargando…' : `${pendientes} para seguir a mano`}
          </p>
        </div>

        <div className="ml-auto flex rounded-lg border border-jjl-border overflow-hidden">
          {VENTANAS.map((v) => (
            <button
              key={v.horas}
              type="button"
              onClick={() => setHoras(v.horas)}
              className={`h-8 px-3 text-[11px] font-semibold transition-colors ${
                horas === v.horas
                  ? 'bg-jjl-red text-white'
                  : 'text-jjl-muted hover:text-white hover:bg-white/5'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Etiquetas. El conteo es sobre toda la ventana, no sobre lo filtrado,
          para que se vea dónde hay trabajo aunque estén apagadas. */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {chips.map((e) => {
            const on = activas.includes(e.tipo);
            const vacia = e.pendientes === 0;
            return (
              <button
                key={e.tipo}
                type="button"
                onClick={() => toggle(e.tipo)}
                title={e.tab}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-semibold transition-colors ${
                  on
                    ? 'border-jjl-red/50 bg-jjl-red/15 text-white'
                    : 'border-jjl-border text-jjl-muted hover:text-white hover:border-white/25'
                } ${vacia && !on ? 'opacity-40' : ''}`}
              >
                {e.label}
                <span className={`tabular-nums ${on ? 'text-jjl-red' : 'text-jjl-muted/70'}`}>
                  {e.pendientes}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lista */}
      <div className="border-t border-jjl-border">
        {isLoading && !data ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visibles.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-jjl-muted">
            {activas.length === 0
              ? 'Elegí al menos una etiqueta para ver los follow-ups.'
              : 'Nada pendiente en esta ventana. '}
          </p>
        ) : (
          visibles.map((item) => {
            const key = `${item.tipo}|${item.usuario}|${item.fecha}`;
            const ocupado = guardando === key;
            const hecho = item.estado === 'hecho';
            return (
              <div
                key={key}
                className={`px-4 py-2.5 border-t border-jjl-border/50 first:border-t-0 ${hecho ? 'opacity-50' : ''}`}
              >
                {/* Linea 1: etiqueta + usuario. En celu el nombre se corta. */}
                <div className="flex items-center gap-2">
                  <span className="shrink-0 inline-flex items-center h-5 px-1.5 rounded border border-jjl-border bg-white/[0.04] text-[10px] font-bold uppercase tracking-wider text-jjl-muted">
                    {labelDe(item.tipo)}
                  </span>
                  <a
                    href={instagramUrl(item.usuario)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`truncate text-[13px] font-medium hover:text-jjl-red transition-colors ${hecho ? 'line-through text-jjl-muted' : 'text-white'}`}
                  >
                    {item.usuario}
                  </a>
                  <span className="ml-auto shrink-0 text-[11px] text-jjl-muted tabular-nums" title={cuando(item.fecha)}>
                    {haceCuanto(item.fecha)}
                  </span>
                </div>

                {/* Linea 2: acciones */}
                <div className="mt-1.5 flex items-center gap-2 pl-1">
                  <a
                    href={instagramUrl(item.usuario)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-[11px] font-semibold text-purple-300 hover:bg-purple-500/20"
                  >
                    <AtSign className="h-3 w-3" />
                    Escribirle
                  </a>

                  {item.estado === 'pospuesto' && (
                    <span className="text-[11px] text-jjl-muted">pospuesto</span>
                  )}

                  {hecho ? (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => accion(item, 'reabrir')}
                      className="ml-auto inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-jjl-border text-[11px] font-semibold text-jjl-muted hover:text-white disabled:opacity-40"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reabrir
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => accion(item, 'posponer')}
                        className="ml-auto inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-jjl-border text-[11px] font-semibold text-jjl-muted hover:text-white hover:bg-white/5 disabled:opacity-40"
                      >
                        <Clock className="h-3 w-3" />
                        Mañana
                      </button>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => accion(item, 'hecho')}
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-green-500/40 bg-green-500/10 text-[11px] font-semibold text-green-300 hover:bg-green-500/20 disabled:opacity-40"
                      >
                        <Check className="h-3 w-3" />
                        Hecho
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
