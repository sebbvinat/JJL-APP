import { clsx } from 'clsx';
import { Trophy, Flame, Target, Award, Star, Zap, Shield, Crown } from 'lucide-react';

const ICONS: Record<string, typeof Trophy> = {
  trophy: Trophy,
  flame: Flame,
  target: Target,
  award: Award,
  star: Star,
  zap: Zap,
  shield: Shield,
  crown: Crown,
};

interface AchievementBadgeProps {
  title: string;
  description: string;
  icon?: string;
  unlocked?: boolean;
  earnedAt?: string;
}

export default function AchievementBadge({
  title,
  description,
  icon = 'trophy',
  unlocked = false,
  earnedAt,
}: AchievementBadgeProps) {
  const Icon = ICONS[icon] || Trophy;

  return (
    <div
      className={clsx(
        'flex flex-col items-center text-center p-4 rounded-xl border transition-all',
        unlocked
          ? 'bg-jjl-gray border-jjl-red/30 hover:border-jjl-red/60'
          : 'bg-jjl-gray-light/50 border-jjl-border opacity-50'
      )}
    >
      <div
        className={clsx(
          'h-12 w-12 rounded-full flex items-center justify-center mb-2',
          unlocked ? 'bg-jjl-red/20' : 'bg-jjl-gray-light'
        )}
      >
        {unlocked ? (
          <Icon className="h-6 w-6 text-jjl-red" />
        ) : (
          <span className="text-lg text-jjl-muted">?</span>
        )}
      </div>
      <h4 className={clsx('text-sm font-semibold', unlocked ? 'text-white' : 'text-jjl-muted')}>
        {title}
      </h4>
      <p className="text-xs text-jjl-muted mt-0.5">{description}</p>
      {unlocked && earnedAt && (
        <p className="text-[9px] text-jjl-muted/60 mt-1">{earnedAt}</p>
      )}
    </div>
  );
}
