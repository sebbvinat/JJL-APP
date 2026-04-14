'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { format } from 'date-fns';
import { Flame, BookOpen, Trophy, Calendar, Upload, Users, ChevronRight, NotebookPen } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/dashboard/StatCard';
import TaskDashboard from '@/components/dashboard/TaskDashboard';
import TrainingCalendar from '@/components/dashboard/TrainingCalendar';
import BeltProgress from '@/components/gamification/BeltProgress';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { calculateGamification } from '@/lib/gamification';
import { fetcher } from '@/lib/fetcher';
import type { BeltLevel } from '@/lib/supabase/types';

interface DashboardData {
  profile: {
    cinturon_actual: string;
    puntos: number;
    nombre: string;
    rol?: string;
    created_at?: string;
    onboarding_completed_at?: string | null;
  };
  trainedDays: string[];
  todayChecked: boolean;
  lessonsCompleted: number;
  totalLessonsAvailable: number;
  unlockedModules: number;
  completedWeekNumbers: number[];
  completedWeeksCount: number;
  totalWeeks: number;
  overallProgress: number;
  streak: number;
  totalTrainingDays: number;
}

export default function DashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, isLoading: loading } = useSWR<DashboardData>(
    `/api/dashboard-stats?today=${today}`,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateIfStale: true,
      dedupingInterval: 30_000,
    }
  );

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const profile = data?.profile || { cinturon_actual: 'white', puntos: 0, nombre: 'Guerrero', rol: 'alumno' };
  const trainedDays = data?.trainedDays || [];
  const todayChecked = data?.todayChecked || false;
  const lessonsCompleted = data?.lessonsCompleted || 0;
  const unlockedModules = data?.unlockedModules || 0;
  const streak = data?.streak || 0;
  const totalTrainingDays = data?.totalTrainingDays || 0;
  const isAdmin = profile.rol === 'admin';

  // Belt and points come from API (already resolved: max of calculated vs admin-set)
  const currentBelt = (profile.cinturon_actual || 'white') as BeltLevel;
  const points = profile.puntos || 0;
  const totalModules = data?.totalWeeks ?? 0;

  // Calculate progress to next belt from the profile belt
  const completedWeekNumbers = data?.completedWeekNumbers || [];
  const gamification = calculateGamification({
    completedWeeks: completedWeekNumbers,
    totalTrainingDays,
    totalLessonsCompleted: lessonsCompleted,
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-jjl-red/15 via-jjl-gray/40 to-transparent p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-10 h-64 w-64 rounded-full blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.5), transparent 70%)' }}
        />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-jjl-muted font-semibold mb-1.5">
              {isAdmin ? 'Panel de Instructor' : 'Bienvenido'}
            </p>
            <h1 className="text-3xl font-black text-white tracking-tight">
              {profile.nombre || 'Guerrero'}
            </h1>
            <p className="text-jjl-muted text-sm mt-2 max-w-md">
              {(() => {
                if (!profile.created_at) return 'Tu camino en el Jiu Jitsu continua. Un dia mas de trabajo.';
                const start = new Date(profile.created_at);
                const dayNumber = Math.max(
                  1,
                  Math.floor((Date.now() - start.getTime()) / (24 * 3600 * 1000)) + 1
                );
                const dateLabel = start.toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'long',
                });
                return dayNumber <= 180
                  ? `Dia ${dayNumber} de 180 — empezaste el ${dateLabel}.`
                  : 'Tu camino en el Jiu Jitsu continua. Un dia mas de trabajo.';
              })()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <span className="px-2.5 py-1 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold uppercase tracking-[0.15em]">
                Admin
              </span>
            )}
            <Badge belt={currentBelt} />
          </div>
        </div>
      </div>

      {/* Task Dashboard — elevated as the #1 daily action */}
      <TaskDashboard todayChecked={todayChecked} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Dias Entrenados"
          value={totalTrainingDays}
          icon={Calendar}
          color="text-green-400"
        />
        <StatCard
          label="Racha Actual"
          value={streak > 0 ? `${streak} dia${streak !== 1 ? 's' : ''}` : '0'}
          icon={Flame}
          color="text-orange-400"
        />
        <StatCard
          label="Modulos Activos"
          value={totalModules > 0 ? `${unlockedModules}/${totalModules}` : `${unlockedModules}`}
          icon={BookOpen}
          color="text-blue-400"
        />
        <StatCard
          label="Puntos"
          value={points}
          icon={Trophy}
          color="text-yellow-400"
        />
      </div>

      {/* Belt Progress */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Progresion de Cinturon</h2>
        <BeltProgress currentBelt={currentBelt} progressToNext={currentBelt === 'black' ? 100 : gamification.progressToNext} />
        {/* Overall lesson progress */}
        {(data?.totalLessonsAvailable ?? 0) > 0 && (
          <div className="mt-4 pt-4 border-t border-jjl-border/30">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-jjl-muted">Progreso general</span>
              <span className="text-white font-medium">
                {lessonsCompleted}/{data?.totalLessonsAvailable} lecciones · {data?.overallProgress}%
              </span>
            </div>
            <div className="w-full bg-jjl-gray-light rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-jjl-red to-orange-500 h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${data?.overallProgress || 0}%` }}
              />
            </div>
            {(data?.completedWeeksCount ?? 0) > 0 && (
              <p className="text-[11px] text-jjl-muted mt-1.5">
                {data?.completedWeeksCount} semana{data?.completedWeeksCount !== 1 ? 's' : ''} completada{data?.completedWeeksCount !== 1 ? 's' : ''} de {data?.totalWeeks}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Training Calendar */}
      <TrainingCalendar trainedDays={trainedDays} />

      {/* Quick Actions */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Acciones Rapidas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Diario', href: '/journal', icon: NotebookPen },
            { label: 'Ver Modulos', href: '/modules', icon: BookOpen },
            { label: 'Subir Lucha', href: '/upload', icon: Upload },
            { label: 'Comunidad', href: '/community', icon: Users },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group relative flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white/[0.03] border border-jjl-border hover:border-jjl-red/40 hover:bg-white/[0.05] transition-all duration-200 text-center"
              >
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/15 text-jjl-red group-hover:bg-jjl-red group-hover:text-white group-hover:ring-jjl-red transition-all">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                </div>
                <span className="text-[13px] text-white font-semibold">{action.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-jjl-muted/30 absolute top-2 right-2 group-hover:text-jjl-red/60 group-hover:translate-x-0.5 transition-all" />
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
