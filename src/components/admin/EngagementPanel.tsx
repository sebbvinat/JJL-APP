'use client';

import useSWR from 'swr';
import Link from 'next/link';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Flame,
  NotebookPen,
  TrendingDown,
  ChevronRight,
  Activity,
  Users,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { fetcher } from '@/lib/fetcher';

type AlertKind =
  | 'no_journal_7d'
  | 'fatiga_rojo_streak'
  | 'objetivo_fails'
  | 'puntaje_bajo'
  | 'sin_reflexion';
type AlertSeverity = 'info' | 'warn' | 'critical';

interface AlertItem {
  kind: AlertKind;
  severity: AlertSeverity;
  detail: string;
}

interface EngagementRow {
  userId: string;
  nombre: string;
  email: string | null;
  avatarUrl: string | null;
  belt: string;
  trained7: number;
  trained30: number;
  avg7: number | null;
  avg30: number | null;
  lastJournalDate: string | null;
  daysSinceLastJournal: number | null;
  rojoStreak: number;
  objetivoFails7: number;
  alerts: AlertItem[];
  topSeverity: number;
  currentObjetivo: string | null;
}

interface Response {
  students: EngagementRow[];
  as_of: string;
}

const ALERT_ICON: Record<AlertKind, typeof AlertTriangle> = {
  no_journal_7d: NotebookPen,
  fatiga_rojo_streak: Flame,
  objetivo_fails: TrendingDown,
  puntaje_bajo: TrendingDown,
  sin_reflexion: Info,
};

const SEVERITY_STYLE: Record<AlertSeverity, string> = {
  critical: 'bg-red-500/10 border-red-500/30 text-red-400',
  warn: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
};

const SEVERITY_ICON: Record<AlertSeverity, typeof AlertTriangle> = {
  critical: AlertCircle,
  warn: AlertTriangle,
  info: Info,
};

function puntajeTone(value: number | null) {
  if (value == null) return 'text-jjl-muted';
  if (value >= 7) return 'text-green-400';
  if (value >= 4) return 'text-yellow-400';
  return 'text-red-400';
}

export default function EngagementPanel() {
  const { data, isLoading } = useSWR<Response>('/api/admin/engagement', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 60_000,
  });

  const students = data?.students || [];
  const needAttention = students.filter((s) => s.alerts.length > 0);
  const healthy = students.filter((s) => s.alerts.length === 0);

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat
          label="Alumnos"
          value={students.length}
          icon={Users}
          tone="text-white"
        />
        <SummaryStat
          label="Necesitan atencion"
          value={needAttention.length}
          icon={AlertTriangle}
          tone="text-amber-400"
        />
        <SummaryStat
          label="Entrenando ok"
          value={healthy.length}
          icon={Activity}
          tone="text-green-400"
        />
        <SummaryStat
          label="Sin registrar 7d+"
          value={students.filter((s) => (s.daysSinceLastJournal ?? 0) >= 7).length}
          icon={NotebookPen}
          tone="text-red-400"
        />
      </div>

      {/* Need attention */}
      {needAttention.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            Necesitan atencion ({needAttention.length})
          </h3>
          <div className="space-y-2">
            {needAttention.map((s) => (
              <StudentRow key={s.userId} row={s} />
            ))}
          </div>
        </section>
      )}

      {/* Healthy */}
      {healthy.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-400" />
            Entrenando bien ({healthy.length})
          </h3>
          <div className="space-y-2">
            {healthy.map((s) => (
              <StudentRow key={s.userId} row={s} />
            ))}
          </div>
        </section>
      )}

      {students.length === 0 && (
        <EmptyState
          icon={Users}
          title="Sin alumnos"
          description="Crea un alumno desde la pestana de gestion para empezar a ver datos."
          className="py-8"
        />
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof AlertTriangle;
  tone: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg bg-current/10 ring-1 ring-current/15 flex items-center justify-center ${tone}`}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </div>
        <div>
          <p className={`text-[22px] font-black tabular-nums leading-none ${tone}`}>
            {value}
          </p>
          <p className="text-[10px] text-jjl-muted mt-1 uppercase tracking-wider font-semibold">
            {label}
          </p>
        </div>
      </div>
    </Card>
  );
}

function StudentRow({ row }: { row: EngagementRow }) {
  const topSeverityKind: AlertSeverity =
    row.topSeverity === 3 ? 'critical' : row.topSeverity === 2 ? 'warn' : 'info';
  const SevIcon = SEVERITY_ICON[topSeverityKind];

  return (
    <Link
      href={`/admin/${row.userId}`}
      className="group block rounded-xl border border-jjl-border bg-white/[0.02] hover:bg-white/[0.04] hover:border-jjl-border-strong transition-colors"
    >
      <div className="p-3.5 space-y-3">
        <div className="flex items-center gap-3">
          {row.alerts.length > 0 && (
            <span
              className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center border ${SEVERITY_STYLE[topSeverityKind]}`}
            >
              <SevIcon className="h-4 w-4" />
            </span>
          )}
          <Avatar src={row.avatarUrl} name={row.nombre} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold text-white truncate">
                {row.nombre}
              </span>
              <Badge belt={row.belt} />
            </div>
            <p className="text-[11px] text-jjl-muted truncate">{row.email}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-jjl-muted/50 shrink-0 group-hover:text-jjl-red group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* Metrics strip */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <MetricPill
            label="7d"
            value={`${row.trained7}`}
            sub="entrenos"
            tone="text-white"
          />
          <MetricPill
            label="30d"
            value={`${row.trained30}`}
            sub="entrenos"
            tone="text-white"
          />
          <MetricPill
            label="Avg 7d"
            value={row.avg7 != null ? row.avg7.toFixed(1) : '--'}
            sub="/10"
            tone={puntajeTone(row.avg7)}
          />
          <MetricPill
            label="Avg 30d"
            value={row.avg30 != null ? row.avg30.toFixed(1) : '--'}
            sub="/10"
            tone={puntajeTone(row.avg30)}
          />
        </div>

        {/* Alerts */}
        {row.alerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {row.alerts.map((a, i) => {
              const Icon = ALERT_ICON[a.kind];
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border ${SEVERITY_STYLE[a.severity]}`}
                >
                  <Icon className="h-3 w-3" />
                  {a.detail}
                </span>
              );
            })}
          </div>
        )}

        {/* Current objetivo */}
        {row.currentObjetivo && (
          <p className="text-[11px] text-jjl-muted line-clamp-1">
            <span className="text-jjl-muted/60 uppercase tracking-wider font-semibold mr-1.5">
              Foco:
            </span>
            <span className="text-white/80">{row.currentObjetivo}</span>
          </p>
        )}
      </div>
    </Link>
  );
}

function MetricPill({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="rounded-md bg-white/[0.02] border border-jjl-border/50 py-1.5 px-2">
      <p className="text-[9px] uppercase tracking-wider text-jjl-muted/70 font-semibold">
        {label}
      </p>
      <p className={`text-[14px] font-bold tabular-nums ${tone} leading-tight`}>
        {value}
        {sub && <span className="text-[10px] text-jjl-muted ml-0.5">{sub}</span>}
      </p>
    </div>
  );
}
