'use client';

import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Users, TrendingUp, Clock, Dumbbell, BookOpen, MessageSquare,
  ArrowLeft, ChevronDown, ChevronUp, Activity,
} from 'lucide-react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface Overview {
  totalUsers: number;
  activeUsers: number;
  retentionRate: number;
  avgDurationMin: number;
  totalTimeMin: number;
  totalSessions: number;
}

interface Engagement {
  trainingThisWeek: number;
  uniqueTrainers: number;
  lessonsTotal: number;
  lessonsThisWeek: number;
  postsThisWeek: number;
  commentsThisWeek: number;
}

interface UserDetail {
  id: string;
  nombre: string;
  email: string;
  cinturon: string;
  puntos: number;
  planilla: string | null;
  lessonsCompleted: number;
  trainingDays: number;
  timeInAppMin: number;
  sessionCount: number;
  lastActive: string | null;
  joinedAt: string;
}

interface DailyActive {
  date: string;
  count: number;
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [dailyActive, setDailyActive] = useState<DailyActive[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>('timeInAppMin');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/analytics');
        if (res.ok) {
          const data = await res.json();
          setOverview(data.overview);
          setEngagement(data.engagement);
          setUsers(data.users);
          setDailyActive(data.dailyActive);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sortedUsers = [...users].sort((a: any, b: any) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  function formatMin(min: number) {
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto animate-pulse">
        <div className="h-12 bg-jjl-gray-light/50 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-jjl-gray-light/50 rounded-xl" />)}
        </div>
        <div className="h-64 bg-jjl-gray-light/50 rounded-xl" />
      </div>
    );
  }

  const maxDaily = Math.max(...dailyActive.map((d) => d.count), 1);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin" className="p-2 rounded-lg hover:bg-jjl-gray-light text-jjl-muted hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-jjl-muted text-sm">Metricas de la plataforma (ultimos 7 dias)</p>
        </div>
      </div>

      {/* Overview cards */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Usuarios Activos" value={`${overview.activeUsers}/${overview.totalUsers}`} sub="esta semana" color="text-blue-400" />
          <StatCard icon={TrendingUp} label="Retencion" value={`${overview.retentionRate}%`} sub="semana vs semana" color="text-green-400" />
          <StatCard icon={Clock} label="Tiempo Promedio" value={formatMin(overview.avgDurationMin)} sub="por sesion" color="text-purple-400" />
          <StatCard icon={Activity} label="Tiempo Total" value={formatMin(overview.totalTimeMin)} sub={`${overview.totalSessions} sesiones`} color="text-orange-400" />
        </div>
      )}

      {/* Engagement */}
      {engagement && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Dumbbell} label="Entrenamientos" value={engagement.trainingThisWeek} sub={`${engagement.uniqueTrainers} alumnos`} color="text-green-400" />
          <StatCard icon={BookOpen} label="Lecciones" value={engagement.lessonsThisWeek} sub={`${engagement.lessonsTotal} total`} color="text-blue-400" />
          <StatCard icon={MessageSquare} label="Posts" value={engagement.postsThisWeek} sub="esta semana" color="text-yellow-400" />
          <StatCard icon={MessageSquare} label="Comentarios" value={engagement.commentsThisWeek} sub="esta semana" color="text-pink-400" />
        </div>
      )}

      {/* Daily active chart */}
      <Card>
        <h2 className="text-sm font-semibold text-jjl-red uppercase tracking-wider mb-4">Usuarios Activos por Dia</h2>
        <div className="flex items-end gap-1.5 h-32">
          {dailyActive.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-jjl-muted">{d.count}</span>
              <div
                className="w-full bg-jjl-red/70 rounded-t-sm min-h-[2px] transition-all"
                style={{ height: `${(d.count / maxDaily) * 100}%` }}
              />
              <span className="text-[9px] text-jjl-muted/50">
                {format(new Date(d.date + 'T12:00:00'), 'dd', { locale: es })}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* User details table */}
      <Card>
        <h2 className="text-sm font-semibold text-jjl-red uppercase tracking-wider mb-4">Detalle por Alumno</h2>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-jjl-muted uppercase tracking-wider border-b border-jjl-border">
                <th className="pb-2 pl-4 sm:pl-0">Alumno</th>
                <SortHeader label="Tiempo" field="timeInAppMin" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label="Lecciones" field="lessonsCompleted" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label="Dias" field="trainingDays" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label="Puntos" field="puntos" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <th className="pb-2 hidden lg:table-cell">Ultima vez</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u) => (
                <tr key={u.id} className="border-b border-jjl-border/30 hover:bg-jjl-gray-light/20">
                  <td className="py-2.5 pl-4 sm:pl-0">
                    <Link href={`/admin/${u.id}`} className="hover:text-jjl-red">
                      <p className="font-medium truncate max-w-[120px] sm:max-w-none">{u.nombre}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge belt={u.cinturon} />
                        {u.planilla && <span className="text-[10px] text-jjl-muted">{u.planilla}</span>}
                      </div>
                    </Link>
                  </td>
                  <td className="py-2.5 tabular-nums">{formatMin(u.timeInAppMin)}</td>
                  <td className="py-2.5 tabular-nums">{u.lessonsCompleted}</td>
                  <td className="py-2.5 tabular-nums">{u.trainingDays}</td>
                  <td className="py-2.5 tabular-nums">{u.puntos}</td>
                  <td className="py-2.5 text-jjl-muted text-xs hidden lg:table-cell">
                    {u.lastActive
                      ? formatDistanceToNow(new Date(u.lastActive), { addSuffix: true, locale: es })
                      : 'Nunca'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub: string; color: string;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-white/5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-jjl-muted">{label}</p>
          <p className="text-[10px] text-jjl-muted/60">{sub}</p>
        </div>
      </div>
    </Card>
  );
}

function SortHeader({ label, field, current, asc, onClick }: {
  label: string; field: string; current: string; asc: boolean; onClick: (f: string) => void;
}) {
  const active = current === field;
  return (
    <th className="pb-2 cursor-pointer hover:text-white select-none" onClick={() => onClick(field)}>
      <span className="flex items-center gap-0.5">
        {label}
        {active && (asc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </th>
  );
}
