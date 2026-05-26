'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, Activity } from 'lucide-react';
import type { CrmStudent } from './types';

interface Props {
  students: CrmStudent[];
}

export default function ActionRequiredPanel({ students }: Props) {
  const ready1on1 = students.filter((s) => s.is_eligible_1on1);
  const atRisk = students.filter((s) => s.lifecycle_stage === 'at_risk');
  const inactive = students.filter((s) =>
    s.lifecycle_stage !== 'at_risk' &&
    typeof s.days_since_activity === 'number' &&
    s.days_since_activity >= 7
  );

  const total = ready1on1.length + atRisk.length + inactive.length;
  if (total === 0) {
    return (
      <div className="rounded-xl border border-jjl-border bg-white/[0.02] px-4 py-3 text-[12px] text-jjl-muted flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-400" />
        Sin alertas urgentes hoy. ¡Todo en orden!
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-jjl-red/30 bg-jjl-red/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-jjl-red" />
        <h2 className="text-[13px] font-bold text-white uppercase tracking-wider">Acción requerida ({total})</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Bucket title="Listos para 1-on-1" icon={CheckCircle2} tone="green" items={ready1on1.map((s) => ({ id: s.id, label: s.nombre, sub: `${s.current_mes_label || ''} · ${s.current_mes_percent ?? 0}%` }))} />
        <Bucket title="At risk" icon={AlertTriangle} tone="amber" items={atRisk.map((s) => ({ id: s.id, label: s.nombre, sub: typeof s.days_since_activity === 'number' ? `Sin actividad ${s.days_since_activity}d` : 'Marcado at risk' }))} />
        <Bucket title="Inactivos +7d" icon={Clock} tone="blue" items={inactive.map((s) => ({ id: s.id, label: s.nombre, sub: `Sin actividad ${s.days_since_activity}d` }))} />
      </div>
    </div>
  );
}

function Bucket({
  title, icon: Icon, tone, items,
}: {
  title: string;
  icon: typeof Activity;
  tone: 'green' | 'amber' | 'blue';
  items: { id: string; label: string; sub?: string }[];
}) {
  const styles = {
    green: { bg: 'bg-green-500/5', border: 'border-green-500/30', text: 'text-green-300' },
    amber: { bg: 'bg-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-300' },
    blue:  { bg: 'bg-blue-500/5',  border: 'border-blue-500/30',  text: 'text-blue-300' },
  }[tone];
  return (
    <div className={`rounded-lg border ${styles.border} ${styles.bg} p-3`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${styles.text} mb-2`}>
        <Icon className="h-3 w-3" /> {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-jjl-muted/70 italic">— ninguno</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 5).map((it) => (
            <li key={it.id}>
              <Link href={`/admin/${it.id}`} className="block px-2 py-1 rounded hover:bg-white/5 transition-colors">
                <p className="text-[12px] font-semibold text-white truncate">{it.label}</p>
                {it.sub && <p className="text-[10px] text-jjl-muted truncate">{it.sub}</p>}
              </Link>
            </li>
          ))}
          {items.length > 5 && (
            <li className="text-[10px] text-jjl-muted px-2 pt-1">+ {items.length - 5} más</li>
          )}
        </ul>
      )}
    </div>
  );
}
