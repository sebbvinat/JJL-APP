'use client';

import { useState, useEffect } from 'react';
import { Trophy, Flame, BookOpen, Dumbbell, Crown } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Link from 'next/link';

interface RankedUser {
  id: string;
  rank: number;
  nombre: string;
  avatar_url: string | null;
  cinturon: string;
  puntos: number;
  lessons: number;
  trainingDays: number;
  streak: number;
  isMe: boolean;
}

type SortKey = 'puntos' | 'lessons' | 'trainingDays' | 'streak';

const SORT_OPTIONS: { key: SortKey; label: string; icon: any }[] = [
  { key: 'puntos', label: 'Puntos', icon: Trophy },
  { key: 'lessons', label: 'Lecciones', icon: BookOpen },
  { key: 'trainingDays', label: 'Dias', icon: Dumbbell },
  { key: 'streak', label: 'Racha', icon: Flame },
];

export default function LeaderboardPage() {
  const [users, setUsers] = useState<RankedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('puntos');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/leaderboard');
        if (res.ok) {
          const data = await res.json();
          setUsers(data.leaderboard || []);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const sorted = [...users].sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));
  sorted.forEach((u, i) => { u.rank = i + 1; });

  if (loading) {
    return (
      <div className="space-y-4 max-w-lg mx-auto animate-pulse">
        <div className="h-12 bg-jjl-gray-light/50 rounded-xl" />
        {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-jjl-gray-light/50 rounded-xl" />)}
      </div>
    );
  }

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Ranking</h1>
        <p className="text-jjl-muted text-sm mt-1">Los guerreros mas dedicados</p>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-1 bg-jjl-gray-light/50 rounded-xl p-1">
        {SORT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = sortBy === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                active ? 'bg-jjl-red text-white shadow-lg' : 'text-jjl-muted hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Podium - top 3 */}
      {top3.length >= 3 && (
        <div className="flex items-end justify-center gap-3 pt-4">
          {/* 2nd place */}
          <PodiumCard user={top3[1]} place={2} sortKey={sortBy} />
          {/* 1st place */}
          <PodiumCard user={top3[0]} place={1} sortKey={sortBy} />
          {/* 3rd place */}
          <PodiumCard user={top3[2]} place={3} sortKey={sortBy} />
        </div>
      )}

      {/* Rest of ranking */}
      <Card>
        <div className="space-y-1">
          {(top3.length < 3 ? sorted : rest).map((u) => (
            <Link
              key={u.id}
              href={`/members/${u.id}`}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                u.isMe ? 'bg-jjl-red/10 border border-jjl-red/20' : 'hover:bg-jjl-gray-light'
              }`}
            >
              <span className={`w-7 text-center text-sm font-bold tabular-nums ${
                u.rank <= 3 ? 'text-yellow-400' : 'text-jjl-muted'
              }`}>
                {u.rank}
              </span>
              <Avatar src={u.avatar_url} name={u.nombre} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold truncate ${u.isMe ? 'text-jjl-red' : ''}`}>
                    {u.nombre} {u.isMe ? '(vos)' : ''}
                  </span>
                  <Badge belt={u.cinturon} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-bold tabular-nums">{u[sortBy]}</span>
                <span className="text-[10px] text-jjl-muted ml-1">
                  {sortBy === 'puntos' ? 'pts' : sortBy === 'lessons' ? 'lec' : sortBy === 'streak' ? 'dias' : 'dias'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PodiumCard({ user, place, sortKey }: { user: RankedUser; place: 1 | 2 | 3; sortKey: SortKey }) {
  const heights = { 1: 'h-28', 2: 'h-20', 3: 'h-16' };
  const sizes = { 1: 'w-16 h-16', 2: 'w-12 h-12', 3: 'w-12 h-12' };
  const colors = { 1: 'from-yellow-500/30 to-yellow-500/5 border-yellow-500/40', 2: 'from-gray-400/20 to-gray-400/5 border-gray-400/30', 3: 'from-orange-700/20 to-orange-700/5 border-orange-700/30' };
  const medalColors = { 1: 'text-yellow-400', 2: 'text-gray-400', 3: 'text-orange-600' };

  return (
    <Link href={`/members/${user.id}`} className={`flex flex-col items-center gap-1 ${place === 1 ? 'order-2' : place === 2 ? 'order-1' : 'order-3'}`}>
      <div className="relative">
        <div className={`rounded-full overflow-hidden ${sizes[place]} ${user.isMe ? 'ring-2 ring-jjl-red' : ''}`}>
          <Avatar src={user.avatar_url} name={user.nombre} size={place === 1 ? 'lg' : 'md'} />
        </div>
        {place === 1 && <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 h-5 w-5 text-yellow-400" />}
      </div>
      <span className="text-xs font-semibold truncate max-w-[80px] text-center">{user.nombre}</span>
      <span className={`text-sm font-bold ${medalColors[place]}`}>{user[sortKey]}</span>
      <div className={`w-full ${heights[place]} rounded-t-xl bg-gradient-to-t border-t ${colors[place]}`} />
    </Link>
  );
}
