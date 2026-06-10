'use client';

import useSWR from 'swr';
import { Lock } from 'lucide-react';
import ModuleCard from '@/components/modules/ModuleCard';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { fetcher } from '@/lib/fetcher';

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

interface StudentDashboardResponse {
  modules: ModuleInfo[];
  completedLessonIds: string[];
  unlockedModuleIds: string[];
}

// El fallback a MOCK_MODULES quedó eliminado — bundlear mock-data.ts
// (~15 KB) en el alumno solo para un caso "courseData null" era inútil.
// Si llegáramos a esa rama, el EmptyState ya lo cubre.

export default function ModulesPage() {
  // Un solo endpoint combina lo que antes hacían 2 (course-data + progress).
  // Mismo cache + half the round-trips → carga más rápida en first paint.
  const { data, isLoading: loading } = useSWR<StudentDashboardResponse>(
    '/api/student-dashboard',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const courseData = data;
  const progress = data;
  const courseLoading = loading;
  const progressLoading = loading;

  // Render progresivo: en cuanto llega courseData mostramos las cards aunque
  // progress todavía esté cargando. El alumno ve la lista al instante y el
  // contador "X/Y lecciones" se rellena cuando llega el segundo fetch.
  // Antes se esperaba a AMBOS endpoints — duplicaba el tiempo de espera.
  if (courseLoading && !courseData) {
    return (
      <div className="space-y-6 max-w-4xl lg:max-w-5xl xl:max-w-6xl">
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

  const allModules = courseData?.modules || [];
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

  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;
  // El "próximo" módulo a trabajar = el primero (por semana) con lecciones
  // pendientes. Lo resaltamos para que el alumno sepa dónde seguir.
  const nextModuleId = [...visibleModules]
    .sort((a, b) => a.semana_numero - b.semana_numero)
    .find((m) => m.lessons.some((l) => l.tipo !== 'reflection' && !completedIds.has(l.id)))?.id;

  return (
    <div className="space-y-6 max-w-5xl xl:max-w-6xl">
      {/* Hero con progreso — primer golpe de vista del alumno */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-jjl-red/15 via-jjl-gray/40 to-transparent p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-10 h-56 w-56 rounded-full blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.5), transparent 70%)' }}
        />
        <div className="relative flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold mb-1.5">
              Curriculum
            </p>
            <h1 className="text-3xl font-black text-white tracking-tight">Tu Programa</h1>
            <p className="text-sm text-jjl-muted mt-1.5">
              Construyendo tu juego ideal, entrenamiento a entrenamiento.
            </p>
          </div>
          <div className="text-right">
            <span className="text-4xl font-black text-white tabular-nums leading-none">{overallPct}%</span>
            <p className="text-[11px] uppercase tracking-wider text-jjl-muted font-semibold mt-1">
              {totalCompleted}/{totalLessons} lecciones
            </p>
          </div>
        </div>
        {/* Barra de progreso global */}
        <div className="relative mt-5 h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-jjl-red to-orange-500 transition-all duration-700"
            style={{ width: `${overallPct}%` }}
          />
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
              isNext={mod.id === nextModuleId}
            />
          );
        })}
      </div>
    </div>
  );
}
