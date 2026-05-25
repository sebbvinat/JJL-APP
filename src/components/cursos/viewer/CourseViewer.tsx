'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { X, ListVideo, Check, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import CustomVideoPlayer from '@/components/video/CustomVideoPlayer';
import CourseLessonNav from './CourseLessonNav';
import MaterialDeEstudio from './MaterialDeEstudio';
import type { CursosCourse } from '@/lib/cursos/types';
import type { ViewerSection } from '@/lib/cursos/queries';

interface CourseViewerProps {
  course: CursosCourse;
  sections: ViewerSection[];
}

export default function CourseViewer({ course, sections }: CourseViewerProps) {
  const allLessons = useMemo(() => sections.flatMap((s) => s.lessons), [sections]);
  const [currentId, setCurrentId] = useState(allLessons[0]?.id ?? '');
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [navOpen, setNavOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    fetch('/api/cursos/progress')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.completedLessonIds) setCompletedIds(new Set(d.completedLessonIds));
      })
      .catch(() => {});
  }, []);

  const current = allLessons.find((l) => l.id === currentId) ?? allLessons[0];
  const currentIndex = allLessons.findIndex((l) => l.id === current?.id);
  const courseDone = allLessons.filter((l) => completedIds.has(l.id)).length;

  const markComplete = useCallback(async (lessonId: string) => {
    setCompletedIds((prev) => new Set(prev).add(lessonId));
    try {
      const res = await fetch('/api/cursos/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, completed: true }),
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(lessonId);
        return next;
      });
    }
  }, []);

  const selectLesson = (id: string) => {
    setCurrentId(id);
    setNavOpen(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  if (!current) {
    return (
      <div className="flex min-h-screen items-center justify-center text-jjl-muted">
        Este curso todavía no tiene lecciones.
      </div>
    );
  }

  const isDone = completedIds.has(current.id);
  const prev = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const next = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-jjl-dark">
      {/* ---------- top bar ---------- */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-jjl-border bg-jjl-gray/95 px-4 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/mis-cursos"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/5 px-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
            aria-label="Volver a Mis cursos"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Mis cursos</span>
          </Link>
          <span className="truncate text-[14px] font-bold text-white">
            {course.titulo}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-[13px] font-semibold text-jjl-muted sm:block">
            {courseDone} de {allLessons.length} completadas
          </span>
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-[13px] font-semibold text-white lg:hidden"
          >
            <ListVideo size={16} />
            Contenido
          </button>
        </div>
      </header>

      {/* ---------- cuerpo ---------- */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? '2fr 1fr' : '1fr',
          gap: '2rem',
          maxWidth: '80rem',
          margin: '0 auto',
          padding: '2rem 1rem',
        }}
      >
        {/* contenido de la lección */}
        <main className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-jjl-red-soft">
            Lección {currentIndex + 1} de {allLessons.length}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
            {current.titulo}
          </h1>

          {current.tipo === 'video' && current.youtube_id ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-jjl-border">
              <CustomVideoPlayer
                key={current.id}
                youtubeId={current.youtube_id}
                title={current.titulo}
                completed={isDone}
                onComplete={() => markComplete(current.id)}
              />
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-jjl-border bg-jjl-gray p-6 sm:p-8">
              {current.contenido ? (
                <MaterialDeEstudio contenido={current.contenido} label="Lectura" />
              ) : (
                <p className="text-jjl-muted">Esta lección no tiene contenido todavía.</p>
              )}
            </div>
          )}

          {/* material de estudio (solo lecciones de video) */}
          {current.tipo === 'video' && current.contenido && (
            <MaterialDeEstudio contenido={current.contenido} />
          )}

          {/* acciones */}
          <div className="mt-8 flex flex-col gap-3 border-t border-jjl-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => markComplete(current.id)}
              disabled={isDone}
              className={clsx(
                'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-colors',
                isDone
                  ? 'cursor-default bg-jjl-red/15 text-jjl-red-soft'
                  : 'bg-jjl-red text-white hover:bg-jjl-red-hover'
              )}
            >
              <Check size={16} strokeWidth={3} />
              {isDone ? 'Lección completada' : 'Marcar como completada'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => prev && selectLesson(prev.id)}
                disabled={!prev}
                className="inline-flex h-11 items-center gap-1 rounded-lg bg-white/5 px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => next && selectLesson(next.id)}
                disabled={!next}
                className="inline-flex h-11 items-center gap-1 rounded-lg bg-white/5 px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                Siguiente
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </main>

        {/* nav — desktop */}
        <aside style={{ display: isDesktop ? 'block' : 'none' }}>
          <div style={{ position: 'sticky', top: 70 }}>
            <CourseLessonNav
              sections={sections}
              currentId={current.id}
              completedIds={completedIds}
              onSelect={selectLesson}
            />
          </div>
        </aside>
      </div>

      {/* nav — drawer mobile */}
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setNavOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-jjl-dark p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-jjl-muted">
                Contenido
              </span>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-jjl-muted"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CourseLessonNav
                sections={sections}
                currentId={current.id}
                completedIds={completedIds}
                onSelect={selectLesson}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
