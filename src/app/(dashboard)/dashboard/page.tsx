'use client';

import { useState, useEffect } from 'react';
import { Flame, BookOpen, Trophy, Calendar } from 'lucide-react';
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
  profile: { cinturon_actual: string; puntos: number; nombre: string };
  trainedDays: string[];
  todayChecked: boolean;
  lessonsCompleted: number;
  unlockedModules: number;
  streak: number;
  totalTrainingDays: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard-stats');
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const profile = data?.profile || { cinturon_actual: 'white', puntos: 0, nombre: 'Guerrero' };
  const trainedDays = data?.trainedDays || [];
  const todayChecked = data?.todayChecked || false;
  const lessonsCompleted = data?.lessonsCompleted || 0;
  const unlockedModules = data?.unlockedModules || 0;
  const streak = data?.streak || 0;
  const totalTrainingDays = data?.totalTrainingDays || 0;

  // Calculate gamification from real data
  const totalModules = MOCK_MODULES.length;
  const gamification = calculateGamification({
    completedWeeks: [], // TODO: track completed weeks when all lessons in a module are done
    totalTrainingDays,
    totalLessonsCompleted: lessonsCompleted,
  });

  // Use profile belt (admin can set it) or calculated belt
  const currentBelt = (profile.cinturon_actual || gamification.newBelt) as BeltLevel;
  const points = profile.puntos || gamification.puntos;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-jjl-red/20 to-transparent border border-jjl-red/20 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Bienvenido, {profile.nombre || 'Guerrero'}</h1>
            <p className="text-jjl-muted mt-1">Tu camino en el Jiu Jitsu continua. Sigue adelante.</p>
          </div>
          <Badge belt={currentBelt} />
        </div>
      </div>

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
        <BeltProgress currentBelt={currentBelt} progressToNext={gamification.progressToNext} />
      </Card>

      {/* Task Dashboard */}
      <TaskDashboard todayChecked={todayChecked} />

      {/* Training Calendar */}
      <TrainingCalendar trainedDays={trainedDays} />

      {/* Quick Actions */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Acciones Rapidas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Ver Modulos', href: '/modules', icon: BookOpen },
            { label: 'Subir Lucha', href: '/upload', icon: Calendar },
            { label: 'Comunidad', href: '/community', icon: Trophy },
            { label: 'Mi Perfil', href: '/profile', icon: Flame },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <a
                key={action.href}
                href={action.href}
                className="flex flex-col items-center gap-2 p-4 rounded-lg bg-jjl-gray-light border border-jjl-border hover:border-jjl-red/40 transition-colors text-center"
              >
                <Icon className="h-6 w-6 text-jjl-red" />
                <span className="text-sm text-jjl-muted">{action.label}</span>
              </a>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
