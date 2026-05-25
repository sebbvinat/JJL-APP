'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { FileText, Check, ChevronDown, Play } from 'lucide-react';
import type { ViewerSection } from '@/lib/cursos/queries';
import type { CursosLesson } from '@/lib/cursos/types';

// Navegación de contenido del curso (visor, tema oscuro).
// Cada lección muestra su thumbnail (de YouTube o un placeholder para
// lecciones de texto) — inspirado en la estructura SYK.

interface CourseLessonNavProps {
  sections: ViewerSection[];
  currentId: string;
  completedIds: Set<string>;
  onSelect: (lessonId: string) => void;
}

function thumbForLesson(lesson: CursosLesson): string | null {
  if (lesson.tipo === 'video' && lesson.youtube_id) {
    return `https://img.youtube.com/vi/${lesson.youtube_id}/mqdefault.jpg`;
  }
  return null;
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
      <div className="max-h-[78vh] overflow-y-auto">
        {sections.map((section) => {
          const done = section.lessons.filter((l) => completedIds.has(l.id)).length;
          const isCollapsed = collapsed.has(section.id);
          return (
            <div key={section.id} className="border-b border-jjl-border last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(section.id)}
                className="flex w-full items-center justify-between gap-3 bg-white/[0.02] px-5 py-3.5 text-left hover:bg-white/[0.04]"
              >
                <span className="flex-1 truncate text-[14px] font-bold leading-tight text-white">
                  {section.titulo}
                </span>
                <span className="flex items-center gap-2 text-[12px] font-semibold text-jjl-muted">
                  <span className="rounded-full bg-white/[0.05] px-2 py-0.5">
                    {done}/{section.lessons.length}
                  </span>
                  <ChevronDown
                    size={14}
                    className={clsx('transition-transform', isCollapsed && '-rotate-90')}
                  />
                </span>
              </button>

              {!isCollapsed && (
                <ul className="px-2 py-2">
                  {section.lessons.map((lesson) => {
                    const isActive = lesson.id === currentId;
                    const isDone = completedIds.has(lesson.id);
                    const thumb = thumbForLesson(lesson);
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(lesson.id)}
                          className={clsx(
                            'group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors',
                            isActive ? 'bg-jjl-red/15' : 'hover:bg-white/[0.04]'
                          )}
                        >
                          {/* thumbnail */}
                          <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-black">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumb}
                                alt=""
                                className={clsx(
                                  'absolute inset-0 h-full w-full object-cover transition-opacity',
                                  isDone && !isActive && 'opacity-40'
                                )}
                                loading="lazy"
                              />
                            ) : (
                              <div
                                className="absolute inset-0 flex items-center justify-center"
                                style={{
                                  background:
                                    'linear-gradient(135deg, #1c1c20, #0a0a0c)',
                                }}
                              >
                                <FileText size={18} className="text-white/40" />
                              </div>
                            )}
                            {isDone && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                                <Check size={16} strokeWidth={3} className="text-jjl-red-soft" />
                              </span>
                            )}
                            {isActive && !isDone && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                                <Play size={16} fill="white" className="text-white" />
                              </span>
                            )}
                          </div>

                          {/* title + meta */}
                          <span className="min-w-0 flex-1">
                            <span
                              className={clsx(
                                'block line-clamp-2 text-[13px] leading-snug',
                                isActive
                                  ? 'font-bold text-white'
                                  : isDone
                                    ? 'text-jjl-muted'
                                    : 'font-medium text-white/90'
                              )}
                            >
                              {lesson.titulo}
                            </span>
                            <span className="mt-1 block text-[11px] font-medium text-jjl-muted">
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
