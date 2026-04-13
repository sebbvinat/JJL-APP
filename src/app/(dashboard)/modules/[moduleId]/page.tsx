'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Lock, BookOpen } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import CustomVideoPlayer from '@/components/video/CustomVideoPlayer';
import LessonList from '@/components/modules/LessonList';
import WeeklyReflection from '@/components/modules/WeeklyReflection';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { MOCK_MODULES, MOCK_LESSONS } from '@/lib/mock-data';
import { type LessonData } from '@/lib/course-data';

interface ModuleInfo {
  id: string;
  semana_numero: number;
  titulo: string;
  descripcion: string;
}

export default function ModuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.moduleId as string;
  const { authUser, loading: userLoading } = useUser();

  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const [lessons, setLessons] = useState<LessonData[]>([]);
  const [lessonsLoaded, setLessonsLoaded] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);

  const [activeLessonId, setActiveLessonId] = useState('');

  // Load module + lessons: check Supabase first, fall back to mock
  useEffect(() => {
    async function loadLessons() {
      try {
        const res = await fetch(`/api/course-data?moduleId=${moduleId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.module?.lessons?.length > 0) {
            setModuleInfo({
              id: data.module.id,
              semana_numero: data.moduleInfo.semana_numero,
              titulo: data.moduleInfo.titulo,
              descripcion: data.moduleInfo.descripcion || '',
            });
            setLessons(data.module.lessons);
            setActiveLessonId(data.module.lessons[0]?.id || '');
            setLessonsLoaded(true);
            return;
          }
        }
      } catch { /* fall through */ }

      // Fall back to mock data
      const mockMod = MOCK_MODULES.find((m) => m.id === moduleId);
      if (mockMod) {
        setModuleInfo({
          id: mockMod.id,
          semana_numero: mockMod.semana_numero,
          titulo: mockMod.titulo,
          descripcion: mockMod.descripcion,
        });
      }
      const mockLessons = (MOCK_LESSONS[moduleId] || []).map((l) => ({
        id: l.id,
        titulo: l.titulo,
        youtube_id: l.youtube_id,
        descripcion: l.descripcion,
        orden: l.orden,
        duracion: l.duracion,
        tipo: l.tipo as 'video' | 'reflection',
      }));
      setLessons(mockLessons);
      setActiveLessonId(mockLessons[0]?.id || '');
      setLessonsLoaded(true);
    }

    loadLessons();
  }, [moduleId]);

  // Load user progress for this module's lessons
  useEffect(() => {
    if (!authUser) return;
    async function loadProgress() {
      try {
        const res = await fetch('/api/progress');
        if (res.ok) {
          const data = await res.json();
          setCompletedIds(new Set(data.completedLessonIds || []));
        }
      } catch {}
    }
    loadProgress();
  }, [authUser]);

  // Check access from Supabase
  useEffect(() => {
    if (userLoading) return;
    if (!authUser) {
      setIsUnlocked(false);
      return;
    }

    async function checkAccess() {
      const supabase = createClient();
      const { data } = await supabase
        .from('user_access')
        .select('is_unlocked')
        .eq('user_id', authUser!.id)
        .eq('module_id', moduleId)
        .single();

      setIsUnlocked((data as { is_unlocked: boolean } | null)?.is_unlocked ?? false);
    }

    checkAccess();
  }, [authUser, userLoading, moduleId]);

  const handleComplete = useCallback(async (lessonId: string) => {
    // Optimistic update
    setCompletedIds((prev) => new Set([...prev, lessonId]));
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, completed: true }),
      });
    } catch {
      // Revert on error
      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(lessonId);
        return next;
      });
    }
  }, []);

  const activeLesson = lessons.find((l) => l.id === activeLessonId);

  if (lessonsLoaded && !moduleInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-jjl-muted">Modulo no encontrado</p>
        <Button variant="secondary" onClick={() => router.push('/modules')}>
          Volver a Modulos
        </Button>
      </div>
    );
  }

  if (userLoading || isUnlocked === null || !lessonsLoaded || !moduleInfo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-20 w-20 bg-jjl-gray rounded-full flex items-center justify-center">
          <Lock className="h-10 w-10 text-jjl-muted" />
        </div>
        <h2 className="text-xl font-bold">Modulo Bloqueado</h2>
        <p className="text-jjl-muted text-center max-w-sm">
          Este modulo aun no ha sido desbloqueado por tu instructor.
        </p>
        <Button variant="secondary" onClick={() => router.push('/modules')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Modulos
        </Button>
      </div>
    );
  }

  const videoLessons = lessons.filter((l) => l.tipo !== 'reflection');
  const completedCount = videoLessons.filter((l) => completedIds.has(l.id)).length;
  const progress = videoLessons.length > 0 ? Math.round((completedCount / videoLessons.length) * 100) : 0;
  const isReflection = activeLesson?.tipo === 'reflection';

  const monthLabel = moduleInfo.semana_numero === 0 ? 'Intro' :
    moduleInfo.semana_numero <= 4 ? 'Mes 1' :
    moduleInfo.semana_numero <= 8 ? 'Mes 2' :
    moduleInfo.semana_numero <= 12 ? 'Mes 3' :
    moduleInfo.semana_numero <= 16 ? 'Mes 4' :
    moduleInfo.semana_numero <= 20 ? 'Mes 5' : 'Mes 6';

  // Convert LessonData to format LessonList expects
  const lessonListItems = lessons.map((l) => ({
    id: l.id,
    titulo: l.titulo,
    youtube_id: l.youtube_id,
    descripcion: l.descripcion,
    orden: l.orden,
    duracion: '', // Don't show mock durations — real duration shows in player
    completed: completedIds.has(l.id),
    tipo: l.tipo,
  }));

  const isActiveLessonCompleted = activeLessonId ? completedIds.has(activeLessonId) : false;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/modules')}
          className="p-2 rounded-lg hover:bg-jjl-gray-light transition-colors text-jjl-muted hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-jjl-red font-semibold uppercase tracking-wider">
              {moduleInfo.semana_numero === 0 ? 'Fundamentos' : `Semana ${moduleInfo.semana_numero}`}
            </span>
            <span className="text-xs text-jjl-muted">— {monthLabel}</span>
          </div>
          <h1 className="text-2xl font-bold">{moduleInfo.titulo}</h1>
          {moduleInfo.descripcion && (
            <p className="text-sm text-jjl-muted mt-1">{moduleInfo.descripcion}</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-jjl-muted">{completedCount} de {videoLessons.length} lecciones completadas</span>
          <span className="text-jjl-red font-medium">{progress}%</span>
        </div>
        <div className="w-full bg-jjl-gray-light rounded-full h-2">
          <div
            className="bg-jjl-red h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Video/Reflection + Lessons layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Content area — left 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          {isReflection ? (
            <WeeklyReflection weekNumber={moduleInfo.semana_numero} />
          ) : activeLesson ? (
            <>
              <CustomVideoPlayer
                youtubeId={activeLesson.youtube_id}
                title={activeLesson.titulo}
                completed={isActiveLessonCompleted}
                onComplete={() => handleComplete(activeLessonId)}
              />
              {activeLesson.descripcion && (
                <Card>
                  <h3 className="font-semibold">{activeLesson.titulo}</h3>
                  <p className="text-sm text-jjl-muted mt-2 whitespace-pre-line">{activeLesson.descripcion}</p>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 text-jjl-muted">
                <BookOpen className="h-12 w-12 mb-4" />
                <p>Selecciona una leccion para comenzar</p>
              </div>
            </Card>
          )}
        </div>

        {/* Lesson list — right 1/3 */}
        <div>
          <Card className="p-3">
            <h3 className="font-semibold px-3 py-2 text-sm">
              Lecciones ({videoLessons.length})
            </h3>
            <LessonList
              lessons={lessonListItems}
              activeId={activeLessonId}
              onSelect={setActiveLessonId}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
