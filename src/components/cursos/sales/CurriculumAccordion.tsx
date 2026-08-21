'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import type { CurriculumPreviewSection } from '@/lib/cursos/types';
import { cleanLessonTitle } from '@/lib/cursos/format';

// Acordeón del currículum en la página de venta. Muestra los módulos
// reales del curso con sus clases (títulos only — sin youtube_id).
// Primer módulo abierto por default: el comprador ve contenido real
// sin hacer nada.
export default function CurriculumAccordion({
  sections,
  maxInitiallyVisible = 12,
  unitLabel = 'clase',
}: {
  sections: CurriculumPreviewSection[];
  maxInitiallyVisible?: number;
  /** Sustantivo del item listado: 'clase' (curso) o 'módulo' (pack). */
  unitLabel?: 'clase' | 'módulo';
}) {
  const [open, setOpen] = useState<number | null>(0);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? sections : sections.slice(0, maxInitiallyVisible);
  const hidden = sections.length - visible.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-cursos-line bg-cursos-surface">
      {visible.map((section, i) => {
        const isOpen = open === i;
        return (
          <div key={`${section.titulo}-${i}`} className={clsx(i > 0 && 'border-t border-cursos-line')}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-black/[0.02] sm:px-6"
            >
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="shrink-0 font-display text-[13px] font-extrabold tabular-nums text-cursos-red">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="truncate text-[15px] font-bold tracking-[-0.01em] text-cursos-ink">
                  {section.titulo}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="hidden text-[12px] font-medium text-cursos-muted sm:inline">
                  {section.lecciones.length}{' '}
                  {section.lecciones.length === 1 ? unitLabel : `${unitLabel}s`}
                </span>
                <span
                  className={clsx(
                    'flex h-6 w-6 items-center justify-center rounded-full border border-cursos-line-strong text-[13px] text-cursos-ink transition-transform duration-200',
                    isOpen && 'rotate-45'
                  )}
                  aria-hidden
                >
                  +
                </span>
              </span>
            </button>
            {isOpen && (
              <ul className="border-t border-cursos-line bg-cursos-paper px-5 py-3 sm:px-6">
                {section.lecciones.map((leccion, j) => {
                  const { titulo, material } = cleanLessonTitle(leccion);
                  return (
                    <li
                      key={`${titulo}-${j}`}
                      className="flex items-start justify-between gap-3 py-2 text-[13.5px] leading-snug text-cursos-ink-soft"
                    >
                      <span className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-cursos-line-strong" />
                        <span>{titulo}</span>
                      </span>
                      {material && (
                        <span className="mt-0.5 shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-cursos-muted">
                          + material
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full border-t border-cursos-line px-5 py-3.5 text-center text-[13.5px] font-semibold text-cursos-red transition-colors hover:bg-black/[0.02]"
        >
          Ver los {hidden} módulos restantes ↓
        </button>
      )}
    </div>
  );
}
