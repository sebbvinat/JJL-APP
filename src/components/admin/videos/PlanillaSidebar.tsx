'use client';

import { ChevronRight } from 'lucide-react';
import type { Planilla } from '@/lib/planillas';
import { MES_LABELS, type PlanillaStats } from '@/lib/admin-videos';

export interface PlanillaSidebarProps {
  planillas: Planilla[];
  activePlanillaId: string;
  onSelectPlanilla: (id: string) => void;
  statsByPlanilla: Record<string, PlanillaStats>;
  mesFilter: number | null;
  onSelectMes: (mes: number | null) => void;
}

// Colores por planilla — minimal, consistente con la app
const PLANILLA_TINTS: Record<string, { bar: string; ring: string; tag: string }> = {
  livianos:  { bar: 'from-cyan-400 to-blue-500',    ring: 'ring-cyan-500/30',    tag: 'text-cyan-300' },
  medios:    { bar: 'from-amber-400 to-orange-500', ring: 'ring-amber-500/30',   tag: 'text-amber-300' },
  simbio:    { bar: 'from-pink-400 to-fuchsia-500', ring: 'ring-pink-500/30',    tag: 'text-pink-300' },
  atleticos: { bar: 'from-emerald-400 to-teal-500', ring: 'ring-emerald-500/30', tag: 'text-emerald-300' },
};

export default function PlanillaSidebar({
  planillas,
  activePlanillaId,
  onSelectPlanilla,
  statsByPlanilla,
  mesFilter,
  onSelectMes,
}: PlanillaSidebarProps) {
  const activeStats = statsByPlanilla[activePlanillaId];

  return (
    <aside className="w-full lg:w-64 lg:shrink-0 space-y-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      {/* Planillas */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-jjl-muted mb-2 px-1">
          Planillas
        </p>
        <div className="space-y-1.5">
          {planillas.map((p) => {
            const isActive = p.id === activePlanillaId;
            const stats = statsByPlanilla[p.id];
            const tint = PLANILLA_TINTS[p.id] ?? PLANILLA_TINTS.livianos;
            return (
              <button
                key={p.id}
                onClick={() => onSelectPlanilla(p.id)}
                className={`group w-full text-left rounded-xl p-3 border transition-all ${
                  isActive
                    ? 'border-jjl-red bg-jjl-red/[0.06] ring-1 ring-jjl-red/30 shadow-lg shadow-jjl-red/10'
                    : 'border-jjl-border bg-white/[0.015] hover:bg-white/[0.04] hover:border-jjl-border'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className={`text-[13px] font-extrabold tracking-tight ${isActive ? 'text-white' : 'text-white/85 group-hover:text-white'}`}>
                    {p.nombre}
                  </p>
                  <span className={`text-[10px] font-mono tabular-nums shrink-0 ${isActive ? tint.tag : 'text-jjl-muted'}`}>
                    {stats?.percent ?? 0}%
                  </span>
                </div>
                <div className={`h-1.5 rounded-full bg-white/10 overflow-hidden ${isActive ? `ring-1 ${tint.ring}` : ''}`}>
                  <div
                    className={`h-full bg-gradient-to-r ${tint.bar} transition-all`}
                    style={{ width: `${stats?.percent ?? 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-jjl-muted mt-1.5">
                  {stats ? `${stats.filled}/${stats.total} videos` : '— videos'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navegación interna por mes */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-jjl-muted mb-2 px-1">
          Navegación
        </p>
        <div className="space-y-1">
          <NavMesButton
            label="Programa completo"
            active={mesFilter == null}
            onClick={() => onSelectMes(null)}
          />
          {[0, 1, 2, 3, 4, 5, 6].map((m) => {
            const s = activeStats?.byMes[m];
            const has = !!s && s.total > 0;
            if (!has) return null;
            return (
              <NavMesButton
                key={m}
                label={MES_LABELS[m] ?? `Mes ${m}`}
                active={mesFilter === m}
                onClick={() => onSelectMes(m)}
                trailing={s ? `${s.filled}/${s.total}` : undefined}
                complete={s ? s.filled === s.total : false}
              />
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function NavMesButton({
  label,
  active,
  onClick,
  trailing,
  complete,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  trailing?: string;
  complete?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-[12px] transition-colors ${
        active
          ? 'bg-jjl-red/15 text-white font-semibold border border-jjl-red/30'
          : 'text-jjl-muted hover:text-white hover:bg-white/[0.03] border border-transparent'
      }`}
    >
      <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${active ? 'rotate-90 text-jjl-red' : ''}`} />
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {trailing && (
        <span className={`text-[10px] font-mono tabular-nums shrink-0 ${complete ? 'text-green-400' : 'text-jjl-muted/70'}`}>
          {trailing}
        </span>
      )}
    </button>
  );
}
