'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Play, FileText, Check, ChevronDown } from 'lucide-react';
import type { ViewerSection } from '@/lib/cursos/queries';

// Navegación de contenido del curso (visor, tema oscuro).
interface CourseLessonNavProps {
  sections: ViewerSection[];
  currentId: string;
  completedIds: Set<string>;
  onSelect: (lessonId: string) => void;
}

export default function CourseLessonNav({
  sections,
  currentId,
  completedIds,
  onSelect,
}: CourseLessonNavProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <nav className="overflow-hidden rounded-2xl border border-jjl-border bg-jjl-gray">
      <p className="border-b border-jjl-border px-5 py-4 text-[12px] font-bold uppercase tracking-[0.14em] text-jjl-muted">
        Contenido del curso
      </p>
      <div className="max-h-[70vh] overflow-y-auto">
        {sections.map((section) => {
          const done = section.lessons.filter((l) => completedIds.has(l.id)).length;
          const isCollapsed = collapsed.has(section.id);
          return (
            <div key={section.id} className="border-b border-jjl-border last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(section.id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
              >
                <span className="text-[13.5px] font-bold text-white">
                  {section.titulo}
                </span>
                <span className="flex items-center gap-2 text-[11px] font-semibold text-jjl-muted">
                  {done}/{section.lessons.length}
                  <ChevronDown
                    size={14}
                    className={clsx('transition-transform', isCollapsed && '-rotate-90')}
                  />
                </span>
              </button>

              {!isCollapsed && (
                <ul className="pb-2">
                  {section.lessons.map((lesson) => {
                    const isActive = lesson.id === currentId;
                    const isDone = completedIds.has(lesson.id);
                    const Icon = lesson.tipo === 'texto' ? FileText : Play;
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(lesson.id)}
                          className={clsx(
                            'flex w-full items-start gap-3 border-l-2 py-2.5 pl-[18px] pr-4 text-left transition-colors',
                            isActive
                              ? 'border-jjl-red bg-white/[0.04]'
                              : 'border-transparent hover:bg-white/[0.02]'
                          )}
                        >
                          <span
                            className={clsx(
                              'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full',
                              isDone
                                ? 'bg-jjl-red text-white'
                                : 'border border-jjl-border-strong text-jjl-muted'
                            )}
                          >
                            {isDone ? <Check size={11} strokeWidth={3} /> : <Icon size={10} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={clsx(
                                'block text-[13px] leading-snug',
                                isActive ? 'font-semibold text-jjl-red-soft' : 'text-white/85'
                              )}
                            >
                              {lesson.titulo}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-jjl-muted">
                              {lesson.tipo === 'texto'
                                ? 'Lectura'
                                : `Video${lesson.duracion ? ` · ${lesson.duracion}` : ''}`}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
