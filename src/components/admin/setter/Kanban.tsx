'use client';

import { useMemo } from 'react';
import { Calendar, AtSign, Phone as PhoneIcon, User as UserIcon, AlertCircle } from 'lucide-react';
import { flagFor, type LeadRow } from '@/lib/lead-labels';

type LeadStage = 'nuevo' | 'contactado' | 'agendado' | 'no_show' | 'convertido' | 'descartado';

export type LeadRowExt = LeadRow & {
  stage?: LeadStage;
  assigned_to?: string | null;
  converted_user_id?: string | null;
  last_contact_at?: string | null;
};

const STAGES: { key: LeadStage; label: string; color: string }[] = [
  { key: 'nuevo',       label: 'Nuevo',        color: 'border-blue-500/40 bg-blue-500/5' },
  { key: 'contactado',  label: 'Contactado',   color: 'border-purple-500/40 bg-purple-500/5' },
  { key: 'agendado',    label: 'Agendado',     color: 'border-amber-500/40 bg-amber-500/5' },
  { key: 'no_show',     label: 'No show',      color: 'border-red-500/40 bg-red-500/5' },
  { key: 'convertido',  label: 'Convertido',   color: 'border-green-500/40 bg-green-500/5' },
  { key: 'descartado',  label: 'Descartado',   color: 'border-jjl-border bg-white/[0.02]' },
];

function stageOf(l: LeadRowExt): LeadStage {
  if (l.stage) return l.stage as LeadStage;
  if (l.disqualified) return 'descartado';
  if (l.booked) return 'agendado';
  return 'nuevo';
}

interface Props {
  leads: LeadRowExt[];
  admins: { id: string; nombre: string; tags?: string[] | null }[];
  onOpenLead: (lead: LeadRowExt) => void;
}

export default function Kanban({ leads, admins, onOpenLead }: Props) {
  const adminById = useMemo(() => new Map(admins.map((a) => [a.id, a])), [admins]);

  const byStage = useMemo<Record<LeadStage, LeadRowExt[]>>(() => {
    const init: Record<LeadStage, LeadRowExt[]> = {
      nuevo: [], contactado: [], agendado: [], no_show: [], convertido: [], descartado: [],
    };
    for (const l of leads) init[stageOf(l)].push(l);
    return init;
  }, [leads]);

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
                return (
                  <button key={l.id} onClick={() => onOpenLead(l)}
                    className="w-full text-left rounded-lg border border-jjl-border bg-jjl-gray hover:border-white/30 hover:bg-jjl-gray-light transition-colors p-2.5">
                    <div className="flex items-start gap-1 mb-1">
                      <p className="text-[13px] font-semibold text-white flex-1 truncate">{l.nombre || l.email || 'Sin nombre'}</p>
                      {l.pais && <span title={l.pais} className="text-[14px]">{flagFor(l.pais)}</span>}
                    </div>
                    <div className="space-y-0.5 text-[11px] text-jjl-muted">
                      {l.instagram && (
                        <p className="flex items-center gap-1 truncate"><AtSign className="h-3 w-3 shrink-0" /> @{l.instagram}</p>
                      )}
                      {l.ocupacion && (
                        <p className="flex items-center gap-1 truncate"><UserIcon className="h-3 w-3 shrink-0" /> {l.ocupacion}</p>
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
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { STAGES };
export type { LeadStage };
