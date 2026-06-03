'use client';

import { useMemo, useState } from 'react';
import { Calendar, AtSign, Phone as PhoneIcon, User as UserIcon, AlertCircle, X } from 'lucide-react';
import { flagFor, type LeadRow } from '@/lib/lead-labels';

type LeadStage = 'nuevo' | 'contactado' | 'agendado' | 'no_show' | 'convertido' | 'descartado';

export type LeadRowExt = LeadRow & {
  stage?: LeadStage;
  assigned_to?: string | null;
  converted_user_id?: string | null;
  last_contact_at?: string | null;
};

// Etiquetas y orden. "Sin agendar (llenó form)" reemplaza "Nuevo" porque
// es lo que el setter espera ver al frente — leads que completaron quiz
// pero todavía no agendaron en Calendly.
const STAGES: { key: LeadStage; label: string; color: string }[] = [
  { key: 'nuevo',       label: 'Sin agendar (llenó form)', color: 'border-blue-500/40 bg-blue-500/5' },
  { key: 'agendado',    label: 'Agendados',                color: 'border-amber-500/40 bg-amber-500/5' },
  { key: 'contactado',  label: 'Contactado',               color: 'border-purple-500/40 bg-purple-500/5' },
  { key: 'no_show',     label: 'No show',                  color: 'border-red-500/40 bg-red-500/5' },
  { key: 'convertido',  label: 'Convertido',               color: 'border-green-500/40 bg-green-500/5' },
  { key: 'descartado',  label: 'Descartado',               color: 'border-jjl-border bg-white/[0.02]' },
];

function stageOf(l: LeadRowExt): LeadStage {
  if (l.stage) return l.stage as LeadStage;
  if (l.disqualified) return 'descartado';
  if (l.booked) return 'agendado';
  return 'nuevo';
}

// ───────────────────────────────────────────────────────────
// Priority flags por respuestas del quiz
// ───────────────────────────────────────────────────────────
// 🟡 Amarillo  → ocupacion='inestable' (puede tener problema de cash flow)
// 🔴 Rojo      → compromiso='viendo' o urgencia='no' (no quiere invertir todavía)
// Si tiene ambos, gana el rojo.
type Priority = 'red' | 'yellow' | null;

function priorityOf(l: LeadRowExt): Priority {
  if (l.compromiso === 'viendo' || l.urgencia === 'no') return 'red';
  if (l.ocupacion === 'inestable') return 'yellow';
  return null;
}

const PRIORITY_STYLES: Record<NonNullable<Priority>, { border: string; bg: string; badge: string; label: string }> = {
  red:    { border: 'border-red-500/60',    bg: 'bg-red-500/[0.06]',    badge: 'bg-red-500/20 text-red-300 border-red-500/40',     label: 'No quiere invertir' },
  yellow: { border: 'border-amber-500/60',  bg: 'bg-amber-500/[0.06]',  badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', label: 'Trabajo inestable' },
};

interface Props {
  leads: LeadRowExt[];
  admins: { id: string; nombre: string; tags?: string[] | null }[];
  onOpenLead: (lead: LeadRowExt) => void;
  /** Cuando el setter clickea el X de descarte rápido. Si no se pasa, el botón no aparece. */
  onQuickDiscard?: (lead: LeadRowExt) => void | Promise<void>;
}

export default function Kanban({ leads, admins, onOpenLead, onQuickDiscard }: Props) {
  const adminById = useMemo(() => new Map(admins.map((a) => [a.id, a])), [admins]);
  const [discardingId, setDiscardingId] = useState<string | null>(null);

  const byStage = useMemo<Record<LeadStage, LeadRowExt[]>>(() => {
    const init: Record<LeadStage, LeadRowExt[]> = {
      nuevo: [], contactado: [], agendado: [], no_show: [], convertido: [], descartado: [],
    };
    for (const l of leads) init[stageOf(l)].push(l);
    return init;
  }, [leads]);

  async function handleQuickDiscard(e: React.MouseEvent, lead: LeadRowExt) {
    e.stopPropagation();
    if (!onQuickDiscard || discardingId) return;
    setDiscardingId(lead.id);
    try {
      await onQuickDiscard(lead);
    } finally {
      setDiscardingId(null);
    }
  }

  return (
    <div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-3 overflow-x-auto pb-2">
      {STAGES.map((s) => {
        const list = byStage[s.key];
        return (
          <div key={s.key} className={`rounded-xl border ${s.color} p-2.5 min-w-0`}>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-white">{s.label}</h3>
              <span className="text-[10px] text-jjl-muted font-semibold">{list.length}</span>
            </div>
            <div className="space-y-1.5 min-h-[60px]">
              {list.length === 0 ? (
                <p className="text-[11px] text-jjl-muted/60 italic px-1 py-3 text-center">—</p>
              ) : list.map((l) => {
                const adm = l.assigned_to ? adminById.get(l.assigned_to) : null;
                const prio = priorityOf(l);
                const prioStyles = prio ? PRIORITY_STYLES[prio] : null;
                const cardBorder = prioStyles?.border ?? 'border-jjl-border';
                const cardBg = prioStyles?.bg ?? 'bg-jjl-gray';
                // Discard solo aplica en columnas que no son 'descartado'/'convertido'
                const canQuickDiscard = !!onQuickDiscard && s.key !== 'descartado' && s.key !== 'convertido';
                return (
                  <div key={l.id} className="relative group">
                    <button
                      onClick={() => onOpenLead(l)}
                      className={`w-full text-left rounded-lg border ${cardBorder} ${cardBg} hover:border-white/40 hover:bg-jjl-gray-light transition-colors p-2.5`}
                    >
                      <div className="flex items-start gap-1 mb-1">
                        <p className="text-[13px] font-semibold text-white flex-1 truncate">{l.nombre || l.email || 'Sin nombre'}</p>
                        {l.pais && <span title={l.pais} className="text-[14px]">{flagFor(l.pais)}</span>}
                      </div>
                      {prioStyles && (
                        <span className={`inline-flex items-center h-4 px-1.5 mb-1 rounded border text-[9px] font-bold uppercase tracking-wider ${prioStyles.badge}`}>
                          {prioStyles.label}
                        </span>
                      )}
                      <div className="space-y-0.5 text-[11px] text-jjl-muted">
                        {l.instagram && (
                          <p className="flex items-center gap-1 truncate"><AtSign className="h-3 w-3 shrink-0" /> @{l.instagram}</p>
                        )}
                        {l.ocupacion && (
                          <p className={`flex items-center gap-1 truncate ${l.ocupacion === 'inestable' ? 'text-amber-300' : ''}`}>
                            <UserIcon className="h-3 w-3 shrink-0" /> {l.ocupacion}
                          </p>
                        )}
                        {l.telefono && (
                          <p className="flex items-center gap-1 truncate"><PhoneIcon className="h-3 w-3 shrink-0" /> {l.telefono}</p>
                        )}
                        {l.scheduled_at && (
                          <p className="flex items-center gap-1 truncate text-amber-300"><Calendar className="h-3 w-3 shrink-0" /> {new Date(l.scheduled_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-jjl-border/40">
                        <span className="text-[10px] text-jjl-muted">{new Date(l.created_at).toLocaleDateString('es-AR')}</span>
                        {adm ? (
                          <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-jjl-muted font-semibold">+{adm.nombre.split(' ')[0]}</span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400/80"><AlertCircle className="h-2.5 w-2.5" /> sin asignar</span>
                        )}
                      </div>
                    </button>
                    {canQuickDiscard && (
                      <button
                        onClick={(e) => handleQuickDiscard(e, l)}
                        disabled={discardingId === l.id}
                        title="Descartar (1-click)"
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full bg-black/60 hover:bg-red-500/80 text-white flex items-center justify-center disabled:opacity-30"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { STAGES, priorityOf };
export type { LeadStage, Priority };
