'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { format, parseISO, subWeeks, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Target,
  ShieldAlert,
  TrendingUp,
  Sparkles,
  Activity,
  ArrowRight,
  Flame,
  Save,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { fetcher } from '@/lib/fetcher';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

interface DaySnapshot {
  fecha: string;
  entrenado: boolean;
  fatiga: string | null;
  intensidad: string | null;
  puntaje: number | null;
  hasReflection: boolean;
}

interface Summary {
  trained: number;
  avgPuntaje: number | null;
  fatiga: { verde: number; amarillo: number; rojo: number };
  objetivoRatio: { done: number; of: number } | null;
  reglaRatio: { done: number; of: number } | null;
}

interface WeeklyResponse {
  week: { from: string; to: string };
  previousWeek: { from: string; to: string };
  days: DaySnapshot[];
  summary: Summary;
  previousSummary: Summary;
  foco: {
    objetivo: string | null;
    regla: string | null;
    meta_entreno: string | null;
  };
  previousFoco: {
    objetivo: string | null;
    regla: string | null;
    meta_entreno: string | null;
  };
  aprendizajes: Array<{ fecha: string; text: string }>;
}

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const FATIGA_DOT: Record<string, string> = {
  verde: 'bg-green-500',
  amarillo: 'bg-yellow-500',
  rojo: 'bg-red-500',
};

function puntajeTone(value: number | null | undefined) {
  if (value == null) return 'text-jjl-muted';
  if (value >= 7) return 'text-green-400';
  if (value >= 4) return 'text-yellow-400';
  return 'text-red-400';
}

function pctRatio(r: { done: number; of: number } | null): number {
  if (!r || r.of === 0) return 0;
  return Math.round((r.done / r.of) * 100);
}

function deltaLabel(curr: number | null, prev: number | null, unit = '') {
  if (curr == null || prev == null) return null;
  const d = Math.round((curr - prev) * 10) / 10;
  if (d === 0) return { text: `igual a la semana pasada`, tone: 'text-jjl-muted' };
  const up = d > 0;
  return {
    text: `${up ? '+' : ''}${d}${unit} vs semana pasada`,
    tone: up ? 'text-green-400' : 'text-red-400',
  };
}

export default function WeeklyPage() {
  const [anchorDate, setAnchorDate] = useState(new Date());
  const weekParam = format(anchorDate, 'yyyy-MM-dd');
  const { data, isLoading } = useSWR<WeeklyResponse>(
    `/api/weekly-summary?week=${weekParam}`,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 30_000 }
  );
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const [reflexion, setReflexion] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const [saving, setSaving] = useState(false);

  const weekStart = data ? parseISO(data.week.from) : null;
  const weekEnd = data ? parseISO(data.week.to) : null;
  const isCurrentWeek =
    weekStart &&
    weekEnd &&
    new Date() >= weekStart &&
    new Date() <= new Date(weekEnd.getTime() + 24 * 3600_000);

  async function saveRetrospective() {
    if (!reflexion.trim() && !nextFocus.trim()) {
      toast.info('Escribi una reflexion o un foco para guardar');
      return;
    }
    setSaving(true);
    try {
      // Save to today's daily_task:
      //   - reflexion -> aprendizajes (append with a weekly header)
      //   - nextFocus -> objetivo (next week's day 1 after this call still uses
      //     the weekly-focus fall-through, so writing it on today carries over
      //     into next week's first days automatically)
      const today = format(new Date(), 'yyyy-MM-dd');
      const existing = await fetch(`/api/daily-task?fecha=${today}`).then((r) =>
        r.ok ? r.json() : { entry: null }
      );
      const curr = existing.entry || {};

      const newAprendizajes = reflexion.trim()
        ? [curr.aprendizajes, `[Semana ${format(parseISO(data!.week.from), 'd MMM', { locale: es })}] ${reflexion.trim()}`]
            .filter(Boolean)
            .join('\n\n')
        : curr.aprendizajes;

      const res = await fetch('/api/daily-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'journal',
          fecha: today,
          entreno_check: curr.entreno_check ?? false,
          fatiga: curr.fatiga ?? null,
          intensidad: curr.intensidad ?? null,
          objetivo: nextFocus.trim() || curr.objetivo || null,
          objetivo_cumplido: curr.objetivo_cumplido ?? null,
          regla: curr.regla ?? null,
          regla_cumplida: curr.regla_cumplida ?? null,
          puntaje: curr.puntaje ?? null,
          observaciones: curr.observaciones ?? null,
          aprendizajes: newAprendizajes,
          notas: curr.notas ?? null,
          meta_entreno: curr.meta_entreno ?? null,
        }),
      });
      if (res.ok) {
        toast.success('Ritual guardado', 'Listo para la proxima semana');
        mutate(`/api/weekly-summary?week=${weekParam}`);
        mutate(`/api/daily-task?fecha=${today}`);
        setReflexion('');
        setNextFocus('');
      } else {
        toast.error('No pudimos guardar');
      }
    } catch (err) {
      logger.error('weekly.save.failed', { err });
      toast.error('Error de conexion');
    }
    setSaving(false);
  }

  if (isLoading && !data) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto animate-pulse">
        <div className="skeleton h-16 rounded-xl" />
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-40 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Sin data"
        description="No pudimos cargar el resumen semanal."
        className="py-16"
      />
    );
  }

  const { summary, previousSummary, days, foco, previousFoco, aprendizajes } = data;
  const avgDelta = deltaLabel(summary.avgPuntaje, previousSummary.avgPuntaje);
  const trainedDelta = deltaLabel(summary.trained, previousSummary.trained, ' dias');

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold mb-1.5">
          Ritual del domingo
        </p>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-black tracking-tight">Tu semana</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAnchorDate(subWeeks(anchorDate, 1))}
              aria-label="Semana anterior"
              className="h-9 w-9 rounded-lg border border-jjl-border bg-white/[0.02] hover:bg-white/[0.05] text-jjl-muted hover:text-white flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center px-3 min-w-[110px]">
              <p className="text-[11px] text-jjl-muted uppercase tracking-wider font-semibold">
                {isCurrentWeek ? 'Esta semana' : 'Pasada'}
              </p>
              <p className="text-[12px] font-bold text-white">
                {format(parseISO(data.week.from), 'd MMM', { locale: es })} —{' '}
                {format(parseISO(data.week.to), 'd MMM', { locale: es })}
              </p>
            </div>
            <button
              onClick={() => setAnchorDate(addWeeks(anchorDate, 1))}
              disabled={isCurrentWeek === true}
              aria-label="Semana siguiente"
              className="h-9 w-9 rounded-lg border border-jjl-border bg-white/[0.02] hover:bg-white/[0.05] text-jjl-muted hover:text-white flex items-center justify-center transition-colors disabled:opacity-20"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-[10px] uppercase tracking-[0.14em] text-jjl-muted font-semibold">
            Entrenos
          </p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-[32px] font-black tabular-nums leading-none text-white">
              {summary.trained}
            </span>
            <span className="text-[11px] text-jjl-muted">/ 7 dias</span>
          </div>
          {trainedDelta && (
            <p className={`text-[11px] mt-1 ${trainedDelta.tone}`}>{trainedDelta.text}</p>
          )}
        </Card>
        <Card>
          <p className="text-[10px] uppercase tracking-[0.14em] text-jjl-muted font-semibold">
            Puntaje promedio
          </p>
          <div className="mt-1 flex items-baseline gap-1">
            <span
              className={`text-[32px] font-black tabular-nums leading-none ${puntajeTone(
                summary.avgPuntaje
              )}`}
            >
              {summary.avgPuntaje != null ? summary.avgPuntaje.toFixed(1) : '--'}
            </span>
            <span className="text-[11px] text-jjl-muted">/10</span>
          </div>
          {avgDelta && <p className={`text-[11px] mt-1 ${avgDelta.tone}`}>{avgDelta.text}</p>}
        </Card>
      </div>

      {/* Day strip */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-bold text-white">Tu semana dia a dia</h3>
          <Link
            href="/journal"
            className="text-[11px] text-jjl-red hover:text-jjl-red-hover font-semibold inline-flex items-center gap-1"
          >
            Abrir diario <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d, i) => {
            const label = DOW[i];
            const dotCls = d.fatiga ? FATIGA_DOT[d.fatiga] : 'bg-white/10';
            return (
              <Link
                key={d.fecha}
                href={`/journal?d=${d.fecha}`}
                className={`group aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${
                  d.entrenado
                    ? 'border-jjl-red/30 bg-jjl-red/5'
                    : 'border-jjl-border bg-white/[0.02]'
                } hover:border-jjl-border-strong`}
              >
                <span className="text-[10px] text-jjl-muted font-bold uppercase">
                  {label}
                </span>
                <span className={`h-2 w-2 rounded-full ${dotCls}`} />
                <span
                  className={`text-[11px] font-bold tabular-nums ${puntajeTone(d.puntaje)}`}
                >
                  {d.puntaje ?? '·'}
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Foco + cumplimiento */}
      {(foco.objetivo || foco.regla || foco.meta_entreno) && (
        <Card>
          <h3 className="text-[13px] font-bold text-white mb-3">Foco de la semana</h3>
          <div className="space-y-3">
            {foco.objetivo && (
              <FocoRow
                icon={Target}
                tone="blue"
                label="Objetivo"
                value={foco.objetivo}
                ratio={summary.objetivoRatio}
                ratioLabel="cumplido"
              />
            )}
            {foco.regla && (
              <FocoRow
                icon={ShieldAlert}
                tone="orange"
                label="Regla"
                value={foco.regla}
                ratio={summary.reglaRatio}
                ratioLabel="respetada"
              />
            )}
            {foco.meta_entreno && (
              <FocoRow
                icon={TrendingUp}
                tone="purple"
                label="Meta de entrenamiento"
                value={foco.meta_entreno}
              />
            )}
          </div>
        </Card>
      )}

      {/* Fatiga breakdown */}
      {summary.trained > 0 && (
        <Card>
          <h3 className="text-[13px] font-bold text-white mb-3">Como te sentiste</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <FatigaStat count={summary.fatiga.verde} tone="green" label="Bien" />
            <FatigaStat count={summary.fatiga.amarillo} tone="amber" label="Normal" />
            <FatigaStat count={summary.fatiga.rojo} tone="red" label="Cansado" />
          </div>
        </Card>
      )}

      {/* Aprendizajes destacados */}
      {aprendizajes.length > 0 && (
        <Card>
          <h3 className="text-[13px] font-bold text-white mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-400" />
            Lo que aprendiste
          </h3>
          <div className="space-y-2.5">
            {aprendizajes.map((a) => (
              <div
                key={a.fecha}
                className="border-l-2 border-yellow-500/40 pl-3 py-1"
              >
                <p className="text-[10px] text-jjl-muted/70 uppercase tracking-wider font-semibold mb-1">
                  {format(parseISO(a.fecha), "EEE d 'de' MMM", { locale: es })}
                </p>
                <p className="text-[13px] text-white leading-relaxed whitespace-pre-wrap">
                  {a.text}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Comparativa con semana pasada */}
      {(previousFoco.objetivo || previousSummary.trained > 0) && (
        <Card tone="glass">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-jjl-muted" />
            <h3 className="text-[13px] font-bold text-white">Semana pasada</h3>
            <span className="text-[10px] text-jjl-muted">
              ({format(parseISO(data.previousWeek.from), 'd MMM', { locale: es })} —{' '}
              {format(parseISO(data.previousWeek.to), 'd MMM', { locale: es })})
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
            <PrevStat label="Entrenos" value={`${previousSummary.trained}/7`} />
            <PrevStat
              label="Promedio"
              value={
                previousSummary.avgPuntaje != null
                  ? previousSummary.avgPuntaje.toFixed(1)
                  : '--'
              }
            />
            <PrevStat
              label="Objetivo"
              value={
                previousSummary.objetivoRatio
                  ? `${pctRatio(previousSummary.objetivoRatio)}%`
                  : '--'
              }
            />
            <PrevStat
              label="Regla"
              value={
                previousSummary.reglaRatio
                  ? `${pctRatio(previousSummary.reglaRatio)}%`
                  : '--'
              }
            />
          </div>
          {previousFoco.objetivo && (
            <p className="text-[12px] text-jjl-muted mt-3 line-clamp-2">
              <span className="uppercase tracking-wider font-semibold text-jjl-muted/60 mr-2">
                Foco anterior:
              </span>
              {previousFoco.objetivo}
            </p>
          )}
        </Card>
      )}

      {/* Retrospective prompt (only current week) */}
      {isCurrentWeek && (
        <Card className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-16 h-52 w-52 rounded-full blur-3xl opacity-25"
            style={{
              background: 'radial-gradient(circle, rgba(220,38,38,0.55), transparent 70%)',
            }}
          />
          <div className="relative">
            <h3 className="text-[15px] font-black text-white">Cerra la semana</h3>
            <p className="text-[12px] text-jjl-muted mt-1 mb-4">
              5 minutos ahora valen 5 horas de entrenamiento la proxima semana.
            </p>

            <label className="block mb-3">
              <span className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-jjl-muted mb-1.5">
                Que aprendi esta semana
              </span>
              <textarea
                value={reflexion}
                onChange={(e) => setReflexion(e.target.value)}
                rows={3}
                placeholder="Patrones que viste, cosas que funcionaron, lecciones del mat..."
                className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
              />
            </label>

            <label className="block mb-4">
              <span className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-jjl-muted mb-1.5">
                Foco para la proxima semana
              </span>
              <textarea
                value={nextFocus}
                onChange={(e) => setNextFocus(e.target.value)}
                rows={2}
                placeholder="Que voy a practicar en las luchas"
                className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
              />
            </label>

            <Button variant="primary" size="md" onClick={saveRetrospective} loading={saving}>
              <Save className="h-4 w-4" />
              Guardar ritual
            </Button>
          </div>
        </Card>
      )}

      {summary.trained === 0 && !aprendizajes.length && (
        <EmptyState
          icon={Flame}
          title="Sin registros esta semana"
          description="Abri el diario y empezá. Cada dia que anotas construye la base del ritual."
          action={{ label: 'Ir al diario', href: '/journal' }}
          className="py-10"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const TONE_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500/10 ring-blue-500/25 text-blue-400',
  orange: 'bg-orange-500/10 ring-orange-500/25 text-orange-400',
  purple: 'bg-purple-500/10 ring-purple-500/25 text-purple-400',
};

function FocoRow({
  icon: Icon,
  tone,
  label,
  value,
  ratio,
  ratioLabel,
}: {
  icon: typeof Target;
  tone: 'blue' | 'orange' | 'purple';
  label: string;
  value: string;
  ratio?: { done: number; of: number } | null;
  ratioLabel?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`h-8 w-8 rounded-lg flex items-center justify-center ring-1 shrink-0 ${TONE_CLASSES[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-jjl-muted mb-0.5">
          {label}
        </p>
        <p className="text-[13px] text-white leading-relaxed">{value}</p>
        {ratio && ratio.of > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="h-1.5 flex-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-jjl-red to-orange-500"
                style={{ width: `${pctRatio(ratio)}%` }}
              />
            </div>
            <span className="text-[10px] text-jjl-muted tabular-nums whitespace-nowrap">
              {ratio.done}/{ratio.of} {ratioLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function FatigaStat({
  count,
  tone,
  label,
}: {
  count: number;
  tone: 'green' | 'amber' | 'red';
  label: string;
}) {
  const dot =
    tone === 'green'
      ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.55)]'
      : tone === 'amber'
        ? 'bg-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.5)]'
        : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]';
  return (
    <div className="rounded-lg border border-jjl-border bg-white/[0.02] py-3">
      <div className="flex justify-center mb-1">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      </div>
      <p className="text-[22px] font-black text-white tabular-nums leading-none">{count}</p>
      <p className="text-[10px] text-jjl-muted uppercase tracking-wider font-semibold mt-1">
        {label}
      </p>
    </div>
  );
}

function PrevStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-jjl-muted/70 uppercase tracking-wider font-semibold">
        {label}
      </p>
      <p className="text-[16px] font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

