import { Calendar, Trophy, BookOpen, Flame } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/dashboard/StatCard';
import BeltProgress from '@/components/gamification/BeltProgress';
import AchievementBadge from '@/components/gamification/AchievementBadge';
import TrainingCalendar from '@/components/dashboard/TrainingCalendar';
import { format, subDays } from 'date-fns';

const mockTrainedDays = Array.from({ length: 90 }, (_, i) => {
  const date = subDays(new Date(), i);
  return Math.random() > 0.4 ? format(date, 'yyyy-MM-dd') : null;
}).filter(Boolean) as string[];

const achievements = [
  { title: 'Primera Clase', description: 'Asististe a tu primera clase', icon: 'star', unlocked: true, earnedAt: 'Ene 2026' },
  { title: 'Racha de 7', description: '7 dias consecutivos entrenando', icon: 'flame', unlocked: true, earnedAt: 'Feb 2026' },
  { title: 'Primer Modulo', description: 'Completaste tu primer modulo', icon: 'trophy', unlocked: true, earnedAt: 'Feb 2026' },
  { title: 'Guerrero Social', description: 'Publicaste 5 posts en la comunidad', icon: 'shield', unlocked: true, earnedAt: 'Mar 2026' },
  { title: 'Video Subido', description: 'Subiste tu primera lucha', icon: 'target', unlocked: true, earnedAt: 'Mar 2026' },
  { title: '100 Clases', description: 'Asististe a 100 clases', icon: 'crown', unlocked: false },
  { title: 'Racha de 30', description: '30 dias consecutivos', icon: 'zap', unlocked: false },
  { title: 'Cinturon Negro', description: 'Alcanzaste el cinturon negro', icon: 'award', unlocked: false },
];

export default function ProfilePage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Profile Header */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Avatar name="Carlos Martinez" size="lg" />
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-xl font-bold">Carlos Martinez</h1>
            <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
              <Badge belt="blue" />
              <span className="text-sm text-jjl-muted">Miembro desde Ene 2026</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-jjl-red">450</p>
            <p className="text-xs text-jjl-muted">Puntos</p>
          </div>
        </div>
      </Card>

      {/* Belt Progression */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Progresion de Cinturon</h2>
        <BeltProgress currentBelt="blue" progressToNext={35} />
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Lecciones" value={18} icon={BookOpen} color="text-blue-400" />
        <StatCard label="Dias Entrenados" value={45} icon={Calendar} color="text-green-400" />
        <StatCard label="Racha" value={7} icon={Flame} color="text-orange-400" />
        <StatCard label="Posts" value={8} icon={Trophy} color="text-yellow-400" />
      </div>

      {/* Training Calendar */}
      <TrainingCalendar trainedDays={mockTrainedDays} />

      {/* Achievements */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Logros</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {achievements.map((a) => (
            <AchievementBadge key={a.title} {...a} />
          ))}
        </div>
      </Card>
    </div>
  );
}
