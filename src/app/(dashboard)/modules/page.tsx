'use client';

import useSWR from 'swr';
import { Lock } from 'lucide-react';
import ModuleCard from '@/components/modules/ModuleCard';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { fetcher } from '@/lib/fetcher';
import { MOCK_MODULES, MOCK_LESSONS } from '@/lib/mock-data';

interface LessonBasic {
  id: string;
  tipo?: string;
}

interface ModuleInfo {
  id: string;
  semana_numero: number;
  titulo: string;
  descripcion: string;
  lessonCount: number;
  videoCount: number;
  lessons: LessonBasic[];
}

interface CourseDataResponse {
  modules: ModuleInfo[];
}

interface ProgressResponse {
  completedLessonIds: string[];
  unlockedModuleIds: string[];
}

const FALLBACK_MODULES: ModuleInfo[] = MOCK_MODULES.map((mod) => {
  const lessons = MOCK_LESSONS[mod.id] || [];
  return {
    id: mod.id,
    semana_numero: mod.semana_numero,
    titulo: mod.titulo,
    descripcion: mod.descripcion,
    lessonCount: lessons.length,
    videoCount: lessons.filter((l) => l.tipo !== 'reflection').length,
    lessons: lessons.map((l) => ({ id: l.id, tipo: l.tipo })),
  };
});

export default function ModulesPage() {
  const { data: courseData, isLoading: courseLoading } = useSWR<CourseDataResponse>(
    '/api/course-data?all=true',
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 60_000 }
  );

  const { data: progress, isLoading: progressLoading } = useSWR<ProgressResponse>(
    '/api/progress',
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 30_000 }
  );

  const loading = courseLoading || progressLoading;

  if (loading && !courseData && !progress) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="space-y-2">
          <div className="skeleton h-7 w-40 rounded" />
          <div className="skeleton h-4 w-72 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const allModules =
    courseData?.modules && courseData.modules.length > 0
      ? courseData.modules
      : FALLBACK_MODULES;
  const completedIds = new Set(progress?.completedLessonIds || []);
  const unlockedIds = new Set(progress?.unlockedModuleIds || []);

  const visibleModules = allModules.filter((mod) => unlockedIds.has(mod.id));

  if (visibleModules.length === 0) {
    return (
      <EmptyState
        icon={Lock}
        title="Sin modulos disponibles"
        description="Tu instructor aun no habilito modulos para tu cuenta. Contactalo para comenzar tu entrenamiento."
        className="min-h-[60vh]"
      />
    );
  }

  const totalLessons = visibleModules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalCompleted = visibleModules.reduce(
    (sum, m) => sum + m.lessons.filter((l) => completedIds.has(l.id)).length,
    0
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold mb-1.5">
            Curriculum
          </p>
          <h1 className="text-3xl font-black text-white tracking-tight">Tu Programa</h1>
          <p className="text-sm text-jjl-muted mt-1.5">
            Construyendo tu juego ideal, entrenamiento a entrenamiento.
          </p>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-jjl-red tabular-nums leading-none">
            {totalCompleted}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-jjl-muted font-semibold">
            / {totalLessons}<br />lecciones
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleModules.map((mod) => {
          const videoLessons = mod.lessons.filter((l) => l.tipo !== 'reflection');
          const completed = videoLessons.filter((l) => completedIds.has(l.id)).length;
          return (
            <ModuleCard
              key={mod.id}
              id={mod.id}
              semana={mod.semana_numero}
              titulo={mod.titulo}
              descripcion={mod.descripcion}
              totalLessons={videoLessons.length}
              completedLessons={completed}
              unlocked={true}
            />
          );
        })}
      </div>
    </div>
  );
}
