'use client';

import { useCallback, useEffect, useState } from 'react';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { Calendar, CheckCircle2, Clock, Mail, ChevronDown } from 'lucide-react';

type Health = {
  alerts: { kind: string; severity: 'critical' | 'warn' | 'info'; label: string }[];
  streak: number;
  avgScore7d: number | null;
  trainedDays7d: number;
};

type CrmSummary = {
  profile: {
    id: string;
    nombre: string;
    email: string | null;
    avatar_url: string | null;
    cinturon_actual: string | null;
    rol: string;
    lifecycle_stage: string;
    lifecycle_changed_at: string | null;
    started_at: string | null;
    created_at: string;
    eligible_1on1_at: string | null;
    eligible_days: number | null;
    days_in_program: number | null;
    last_contact_at: string | null;
    program_member: boolean;
    tags: string[];
  };
  month: {
    currentMes: number | null;
    nextMes: number | null;
    currentMesPercent: number;
    isEligibleFor1on1: boolean;
    months: Array<{ mes: number; label: string; moduleIds: string[]; allUnlocked: boolean; totalLessons: number; completedLessons: number; percent: number }>;
  };
  health: Health;
  next_action: {
    title: string;
    detail: string;
    can_schedule_1on1: boolean;
    can_confirm_month: boolean;
  };
};

const LIFECYCLE_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'prospect',   label: 'Prospect',    color: 'bg-jjl-muted/15 text-jjl-muted border-jjl-border' },
  { value: 'onboarding', label: 'Onboarding',  color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { value: 'active',     label: 'Activo',      color: 'bg-green-500/15 text-green-300 border-green-500/30' },
  { value: 'at_risk',    label: 'At risk',     color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { value: 'paused',     label: 'Pausado',     color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  { value: 'churned',    label: 'Churned',     color: 'bg-red-500/15 text-red-300 border-red-500/30' },
];

function timeAgo(iso: string | null): string {
  if (!iso) return 'nunca';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'ahora';
  if (d < 3600) return `hace ${Math.floor(d / 60)}m`;
  if (d < 86400) return `hace ${Math.floor(d / 3600)}h`;
  return `hace ${Math.floor(d / 86400)}d`;
}

interface Props {
  userId: string;
  onScheduleClick: () => void;
  onConfirmMonthClick: () => void;
  /** Bumpea cuando alguna acción externa (modal) actualiza datos para forzar refetch. */
  refreshKey?: number;
}

export default function CrmHeader({ userId, onScheduleClick, onConfirmMonthClick, refreshKey = 0 }: Props) {
  const [data, setData] = useState<CrmSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [savingLifecycle, setSavingLifecycle] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/students/${userId}/crm-summary`, { cache: 'no-store' });
      if (res.status === 500 || res.status === 503) {
        const body = await res.json().catch(() => ({}));
        if (/column .* does not exist|lifecycle_stage column missing/i.test(body?.error || '')) {
          setSetupRequired(true);
          setLoading(false);
          return;
        }
      }
      const body = await res.json();
      setData(body);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  async function changeLifecycle(v: string) {
    if (!data || savingLifecycle) return;
    setSavingLifecycle(true);
    try {
      await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, lifecycle_stage: v }),
      });
      await load();
    } finally { setSavingLifecycle(false); }
  }

  if (setupRequired) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-[13px] text-amber-200">
        Falta correr la migración SQL <code className="font-mono text-amber-100">2026_05_22_crm_foundation.sql</code> en Supabase.
      </div>
    );
  }
  if (loading || !data) {
    return <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-4 animate-pulse h-48" />;
  }

  const { profile, month, next_action } = data;
  const lifecycle = LIFECYCLE_OPTIONS.find((o) => o.value === profile.lifecycle_stage) || LIFECYCLE_OPTIONS[0];
  const isEligible = month.isEligibleFor1on1;
  const startedDate = profile.started_at ? new Date(profile.started_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <div className="rounded-xl border border-jjl-border bg-jjl-gray overflow-hidden">
      {/* Top: avatar + identidad + lifecycle */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar src={profile.avatar_url} name={profile.nombre} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{profile.nombre}</h1>
              {profile.cinturon_actual && <Badge belt={profile.cinturon_actual} />}
              <span className={`inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-bold uppercase tracking-wider ${lifecycle.color}`}>
                ● {lifecycle.label}
              </span>
              {profile.tags && profile.tags.length > 0 && profile.tags.map((t) => (
                <span key={t} className="inline-flex items-center h-5 px-1.5 rounded bg-white/5 text-[10px] uppercase tracking-wider text-jjl-muted font-semibold border border-jjl-border">{t}</span>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-[12px] text-jjl-muted">
              {profile.email && (
                <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {profile.email}</span>
              )}
              {startedDate && (
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Inició {startedDate}{profile.days_in_program != null && ` · ${profile.days_in_program} días`}</span>
              )}
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Último contacto {timeAgo(profile.last_contact_at)}</span>
            </div>
          </div>

          {/* Lifecycle dropdown */}
          <div className="relative shrink-0">
            <select
              value={profile.lifecycle_stage}
              onChange={(e) => changeLifecycle(e.target.value)}
              disabled={savingLifecycle}
              className="appearance-none bg-white/[0.03] border border-jjl-border rounded-lg pl-3 pr-8 py-2 text-[12px] text-white focus:outline-none focus:border-jjl-red disabled:opacity-50 cursor-pointer">
              {LIFECYCLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="h-3.5 w-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-jjl-muted" />
          </div>
        </div>
      </div>

      {/* Próxima acción */}
      <div className={`border-t px-4 sm:px-5 py-3.5 ${isEligible ? 'border-jjl-red/30 bg-jjl-red/5' : 'border-jjl-border/40 bg-black/20'}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold mb-1">🎯 Próxima acción</p>
            <h3 className="text-[14px] font-bold text-white">{next_action.title}</h3>
            <p className="text-[12px] text-jjl-muted mt-0.5">{next_action.detail}</p>
            {isEligible && profile.eligible_days != null && profile.eligible_days > 0 && (
              <p className="text-[11px] text-jjl-red font-semibold mt-1">⚠ Elegible hace {profile.eligible_days} día{profile.eligible_days === 1 ? '' : 's'} sin procesar</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {next_action.can_schedule_1on1 && (
              <button onClick={onScheduleClick}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/[0.06] border border-jjl-border text-white text-[12px] font-semibold hover:bg-white/[0.1] transition-colors">
                <Calendar className="h-3.5 w-3.5" /> Agendar 1-on-1
              </button>
            )}
            {next_action.can_confirm_month && (
              <button onClick={onConfirmMonthClick}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-green-500 text-white text-[12px] font-semibold hover:bg-green-600 transition-colors">
                <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar y desbloquear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mini barra de progreso de meses */}
      <div className="border-t border-jjl-border/40 px-4 sm:px-5 py-3 bg-black/10">
        <p className="text-[11px] uppercase tracking-[0.14em] text-jjl-muted font-semibold mb-1.5">Progreso del programa</p>
        <div className="flex gap-1">
          {month.months.map((m) => (
            <div key={m.mes} className="flex-1 min-w-0" title={`${m.label}: ${m.completedLessons}/${m.totalLessons} (${m.percent}%) · ${m.allUnlocked ? 'desbloqueado' : 'bloqueado'}`}>
              <div className={`h-1.5 rounded ${m.allUnlocked ? 'bg-white/10' : 'bg-white/5'} overflow-hidden`}>
                <div className={`h-full ${m.allUnlocked ? 'bg-jjl-red' : 'bg-jjl-muted/40'}`} style={{ width: `${m.percent}%` }} />
              </div>
              <p className="text-[9px] text-jjl-muted mt-0.5 truncate text-center">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
