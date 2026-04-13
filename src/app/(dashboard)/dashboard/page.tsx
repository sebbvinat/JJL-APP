import { Flame, BookOpen, Trophy, Calendar } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/dashboard/StatCard';
import TaskDashboard from '@/components/dashboard/TaskDashboard';
import TrainingCalendar from '@/components/dashboard/TrainingCalendar';
import BeltProgress from '@/components/gamification/BeltProgress';
import { format, subDays } from 'date-fns';

// Mock training days for demo
const mockTrainedDays = Array.from({ length: 90 }, (_, i) => {
  const date = subDays(new Date(), i);
  return Math.random() > 0.4 ? format(date, 'yyyy-MM-dd') : null;
}).filter(Boolean) as string[];

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-jjl-red/20 to-transparent border border-jjl-red/20 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Bienvenido, Guerrero</h1>
            <p className="text-jjl-muted mt-1">Tu camino en el Jiu Jitsu continua. Sigue adelante.</p>
          </div>
          <Badge belt="blue" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Clases Asistidas" value={24} icon={Calendar} color="text-green-400" />
        <StatCard label="Racha Actual" value="7 dias" icon={Flame} color="text-orange-400" />
        <StatCard label="Modulos Completados" value="3/24" icon={BookOpen} color="text-blue-400" />
        <StatCard label="Puntos" value={450} icon={Trophy} color="text-yellow-400" />
      </div>

      {/* Belt Progress */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Progresion de Cinturon</h2>
        <BeltProgress currentBelt="blue" progressToNext={35} />
      </Card>

      {/* Task Dashboard */}
      <TaskDashboard />

      {/* Training Calendar */}
      <TrainingCalendar trainedDays={mockTrainedDays} />

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
