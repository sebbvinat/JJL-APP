'use client';

import useSWR from 'swr';
import { Lock } from 'lucide-react';
import ModuleCard from '@/components/modules/ModuleCard';
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="h-20 w-20 bg-jjl-gray rounded-full flex items-center justify-center">
          <Lock className="h-10 w-10 text-jjl-muted" />
        </div>
        <h2 className="text-xl font-bold">Sin modulos disponibles</h2>
        <p className="text-jjl-muted max-w-sm">
          Tu instructor aun no ha habilitado modulos para tu cuenta. Contactalo
          para comenzar tu entrenamiento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Tu Programa</h1>
        <p className="text-jjl-muted mt-1">
          Construyendo tu juego ideal entrenamiento a entrenamiento
        </p>
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
