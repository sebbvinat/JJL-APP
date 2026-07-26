'use client';

import { Search } from 'lucide-react';
import SemanaCard from './SemanaCard';
import type { Planilla } from '@/lib/planillas';
import { MES_LABELS, groupWeeksByMes, type VideoOverride } from '@/lib/admin-videos';

export interface PlanillaPanelProps {
  planilla: Planilla;
  overrides: Map<string, VideoOverride>;
  searchFilter: string;
  setSearchFilter: (s: string) => void;
  expandedLessonKey: string | null;
  onToggleLesson: (lessonKey: string) => void;
  onLessonSaved: (moduleId: string, savedFromTitulo: string, patch: { youtube_id?: string; titulo?: string; descripcion?: string }) => void;
  mesFilter: number | null;       // null = mostrar todos, sino solo el mes seleccionado
}

const MES_TINTS: Record<number, string> = {
  0: 'from-amber-500/20 to-amber-500/0',
  1: 'from-jjl-red/20 to-jjl-red/0',
  2: 'from-pink-500/20 to-pink-500/0',
  3: 'from-purple-500/20 to-purple-500/0',
  4: 'from-blue-500/20 to-blue-500/0',
  5: 'from-emerald-500/20 to-emerald-500/0',
  6: 'from-orange-500/20 to-orange-500/0',
};

export default function PlanillaPanel({
  planilla,
  overrides,
  searchFilter,
  setSearchFilter,
  expandedLessonKey,
  onToggleLesson,
  onLessonSaved,
  mesFilter,
}: PlanillaPanelProps) {
  const byMes = groupWeeksByMes(planilla.weeks);
  const monthEntries = Array.from(byMes.entries())
    .filter(([mes]) => mesFilter == null || mes === mesFilter)
    .sort((a, b) => a[0] - b[0]);

  const search = searchFilter.trim().toLowerCase();

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-jjl-bg/95 backdrop-blur border-b border-jjl-border">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-jjl-muted">
              {planilla.nombre}
            </p>
            <h2 className="text-lg font-black tracking-tight text-white">
              {mesFilter != null ? MES_LABELS[mesFilter] : 'Programa completo'}
            </h2>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-jjl-muted pointer-events-none" />
          <input
            type="search"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Buscar lección en esta planilla…"
            className="w-full h-9 pl-9 pr-3 bg-white/[0.03] border border-jjl-border rounded-lg text-[12px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
          />
        </div>
      </div>

      {/* Render por mes */}
      {monthEntries.map(([mes, weeks]) => (
        <section key={mes} className="space-y-3" id={`mes-${mes}`}>
          <header className={`relative rounded-lg overflow-hidden border border-jjl-border bg-gradient-to-r ${MES_TINTS[mes] ?? ''} px-4 py-2.5`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-jjl-muted">
              {planilla.nombre}
            </p>
            <h3 className="text-base font-black text-white">{MES_LABELS[mes] ?? `Mes ${mes}`}</h3>
          </header>
          {weeks.map((week) => (
            <SemanaCard
              key={week.semana_numero}
              week={week}
              overrides={overrides}
              expandedLessonKey={expandedLessonKey}
              onToggleLesson={onToggleLesson}
              onLessonSaved={onLessonSaved}
              searchFilter={search}
            />
          ))}
        </section>
      ))}

      {monthEntries.length === 0 && (
        <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-8 text-center">
          <p className="text-[13px] text-jjl-muted">Esta planilla no tiene semanas en el mes seleccionado.</p>
        </div>
      )}
    </div>
  );
}
