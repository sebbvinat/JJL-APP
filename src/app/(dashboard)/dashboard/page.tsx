'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Flame, BookOpen, Trophy, Calendar, Upload, Users, User, ChevronRight, NotebookPen } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/dashboard/StatCard';
import TaskDashboard from '@/components/dashboard/TaskDashboard';
import TrainingCalendar from '@/components/dashboard/TrainingCalendar';
import BeltProgress from '@/components/gamification/BeltProgress';
import { calculateGamification } from '@/lib/gamification';
import { MOCK_MODULES } from '@/lib/mock-data';
import type { BeltLevel } from '@/lib/supabase/types';

interface DashboardData {
  profile: { cinturon_actual: string; puntos: number; nombre: string; rol?: string };
  trainedDays: string[];
  todayChecked: boolean;
  lessonsCompleted: number;
  unlockedModules: number;
  completedWeekNumbers: number[];
  streak: number;
  totalTrainingDays: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const res = await fetch(`/api/dashboard-stats?today=${today}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl animate-pulse">
        {/* Welcome skeleton */}
        <div className="bg-jjl-gray-light/50 border border-jjl-border rounded-xl p-6 h-24" />
        {/* Task skeleton */}
        <div className="bg-jjl-gray-light/50 border border-jjl-border rounded-xl p-6 h-20" />
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-jjl-gray-light/50 border border-jjl-border rounded-xl p-4 h-24" />
          ))}
        </div>
        {/* Belt skeleton */}
        <div className="bg-jjl-gray-light/50 border border-jjl-border rounded-xl p-6 h-32" />
      </div>
    );
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
  const totalModules = MOCK_MODULES.length;

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
      <div className="bg-gradient-to-r from-jjl-red/20 to-transparent border border-jjl-red/20 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Bienvenido, {profile.nombre || 'Guerrero'}</h1>
            <p className="text-jjl-muted mt-1">Tu camino en el Jiu Jitsu continua. Sigue adelante.</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <span className="px-2.5 py-1 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-bold uppercase tracking-wider">
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
          value={`${unlockedModules}/${totalModules}`}
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
              <a
                key={action.href}
                href={action.href}
                className="group flex flex-col items-center gap-2 p-4 rounded-lg bg-jjl-gray-light border border-jjl-border hover:border-jjl-red/40 transition-all duration-200 text-center relative"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-jjl-red/10">
                  <Icon className="h-5 w-5 text-jjl-red" />
                </div>
                <span className="text-sm text-white font-medium">{action.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-jjl-muted/40 absolute top-2 right-2 group-hover:text-jjl-red/60 transition-colors" />
              </a>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
