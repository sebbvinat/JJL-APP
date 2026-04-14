'use client';

import useSWR from 'swr';
import { BookOpen, Lock } from 'lucide-react';
import Shell from './Shell';
import { fetcher } from '@/lib/fetcher';

interface ModuleInfo {
  id: string;
  semana_numero: number;
  titulo: string;
  descripcion?: string;
  lessonCount: number;
}

interface CourseData {
  modules: ModuleInfo[];
}

interface Props {
  isAdmin: boolean;
  onNext: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export default function Step2Program({ isAdmin, onNext, onSkip }: Props) {
  const { data, isLoading } = useSWR<CourseData>(
    isAdmin ? null : '/api/course-data?all=true',
    fetcher
  );

  const modules = data?.modules ?? [];

  const title = isAdmin ? 'Tu panel de instructor' : 'Tu programa';
  const subtitle = isAdmin
    ? 'Desde aca tus alumnos van a ver su curriculum — semanas, lecciones, foco por bloque. Vos los asignas desde la pestana Admin.'
    : 'Este es el camino que armamos para vos. 180 dias, por semanas. No tenes que recordarlo de memoria — esta siempre aca.';

  return (
    <Shell
      step={2}
      total={5}
      title={title}
      subtitle={subtitle}
      primaryLabel="Siguiente"
      onPrimary={onNext}
      onSkip={onSkip}
    >
      {isAdmin ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-5 text-[13px] text-jjl-muted leading-relaxed">
          <p className="text-amber-400 font-semibold mb-1.5">Vista preview</p>
          Este paso muestra los modulos asignados al alumno. Como vos sos el admin, lo vas a ver con
          la data real cuando abras el perfil de cada estudiante.
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          <div className="skeleton h-14 rounded-lg" />
          <div className="skeleton h-14 rounded-lg" />
          <div className="skeleton h-14 rounded-lg" />
        </div>
      ) : modules.length === 0 ? (
        <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-5 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
            <Lock className="h-5 w-5 text-jjl-muted" />
          </div>
          <p className="text-[14px] font-semibold text-white">Tu instructor esta armando tu programa</p>
          <p className="text-[12px] text-jjl-muted mt-1.5">
            Te avisamos por notificacion cuando este listo. Mientras, seguimos con el tour.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
          {modules.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-jjl-border bg-white/[0.02] p-3"
            >
              <span className="inline-flex h-8 px-2 items-center rounded-md bg-jjl-red/10 border border-jjl-red/20 text-jjl-red text-[10px] font-bold uppercase tracking-[0.14em]">
                {m.semana_numero === 0 ? 'Intro' : `S${m.semana_numero}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{m.titulo}</p>
                <p className="text-[11px] text-jjl-muted flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3" />
                  {m.lessonCount} lecciones
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
