'use client';

import LessonRow from './LessonRow';
import type { PlanillaWeek } from '@/lib/planillas';
import { applyOverride, isSharedSemana, lessonStatus, normTitle, type VideoOverride } from '@/lib/admin-videos';

export interface SemanaCardProps {
  week: PlanillaWeek;
  overrides: Map<string, VideoOverride>;
  expandedLessonKey: string | null;       // lesson_key (normTitle) o null
  onToggleLesson: (lessonKey: string) => void;
  onLessonSaved: (savedFromTitulo: string, patch: { youtube_id?: string; titulo?: string; descripcion?: string }) => void;
  searchFilter: string;                   // ya en lowercase
}

const moduleIdFromSemana = (n: number) => `mod-${n}`;

/**
 * Render de una semana con su lista de lecciones.
 * Si searchFilter tiene texto y ninguna lección matchea, devuelve null.
 */
export default function SemanaCard({
  week,
  overrides,
  expandedLessonKey,
  onToggleLesson,
  onLessonSaved,
  searchFilter,
}: SemanaCardProps) {
  const moduleId = moduleIdFromSemana(week.semana_numero);
  const shared = isSharedSemana(week.semana_numero);

  // Compute lessons (con override aplicado) y dot stats
  const lessonsEffective = week.lessons.map((orig) => {
    const eff = applyOverride(orig, overrides.get(normTitle(orig.titulo)));
    return { orig, eff };
  });

  // Filtro por busqueda
  const matchesFilter = (titulo: string) => !searchFilter || titulo.toLowerCase().includes(searchFilter);
  const filtered = lessonsEffective.filter((l) =>
    matchesFilter(l.eff.titulo) || matchesFilter(l.orig.titulo),
  );
  if (searchFilter && filtered.length === 0) return null;

  // Stats (sobre todas las lecciones de video, no filtradas)
  const videoLessons = lessonsEffective.filter((l) => l.orig.tipo === 'video');
  const totalVideos = videoLessons.length;
  const filledVideos = videoLessons.filter((l) => lessonStatus(l.eff) === 'has_video').length;

  return (
    <section
      id={`sem-${week.semana_numero}`}
      className="scroll-mt-20 rounded-xl border border-jjl-border bg-white/[0.018] overflow-hidden"
    >
      <header className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-white/[0.025] to-transparent border-b border-jjl-border/50">
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex h-7 px-2 items-center rounded-md bg-jjl-red/12 border border-jjl-red/25 text-jjl-red text-[10px] font-bold uppercase tracking-[0.14em]">
            {week.semana_numero === -1 ? 'App' : week.semana_numero === 0 ? 'Intro' : `Sem ${week.semana_numero}`}
          </span>
          {shared && (
            <span className="hidden sm:inline-block text-[9px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded">
              Compartida
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-bold text-white truncate">{week.titulo}</h3>
          <p className="text-[11px] text-jjl-muted">
            {totalVideos === 0
              ? 'Sin videos'
              : `${filledVideos}/${totalVideos} video${totalVideos === 1 ? '' : 's'} asignado${filledVideos === 1 ? '' : 's'}`}
          </p>
        </div>
        {totalVideos > 0 && (
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-jjl-red to-orange-400 transition-all"
                style={{ width: `${(filledVideos / totalVideos) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-jjl-muted tabular-nums">
              {Math.round((filledVideos / totalVideos) * 100)}%
            </span>
          </div>
        )}
      </header>

      <div className="p-2 space-y-1.5">
        {filtered.map(({ orig, eff }, idx) => {
          const key = normTitle(orig.titulo);
          // El indice mostrado es el real en la semana (no el del filtro)
          const realIndex = lessonsEffective.findIndex((l) => l.orig === orig);
          return (
            <LessonRow
              key={key + idx}
              moduleId={moduleId}
              semanaNumero={week.semana_numero}
              index={realIndex}
              lesson={eff}
              originalTitulo={orig.titulo}
              expanded={expandedLessonKey === key}
              onToggle={() => onToggleLesson(key)}
              onSaved={(patch, savedFromTitulo) => onLessonSaved(savedFromTitulo, patch)}
            />
          );
        })}
      </div>
    </section>
  );
}
