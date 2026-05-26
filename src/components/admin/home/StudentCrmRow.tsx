'use client';

import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { ChevronRight, StickyNote, AlertTriangle, Clock } from 'lucide-react';
import type { CrmStudent } from './types';

const LIFECYCLE_BADGE: Record<string, string> = {
  prospect:   'bg-jjl-muted/15 text-jjl-muted border-jjl-border',
  onboarding: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  active:     'bg-green-500/15 text-green-300 border-green-500/30',
  at_risk:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  paused:     'bg-purple-500/15 text-purple-300 border-purple-500/30',
  churned:    'bg-red-500/15 text-red-300 border-red-500/30',
};

const LIFECYCLE_LABEL: Record<string, string> = {
  prospect: 'Prospect', onboarding: 'Onboarding', active: 'Activo',
  at_risk: 'At risk', paused: 'Pausado', churned: 'Churned',
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'sin contacto';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return `hace ${Math.max(1, Math.floor(d / 60))}m`;
  if (d < 86400) return `hace ${Math.floor(d / 3600)}h`;
  return `hace ${Math.floor(d / 86400)}d`;
}

interface Props {
  student: CrmStudent;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
}

export default function StudentCrmRow({ student, selected, onSelect }: Props) {
  const lc = student.lifecycle_stage || 'prospect';
  const isAdmin = student.rol === 'admin';

  return (
    <div className={`group flex items-start gap-2 p-3 rounded-lg border transition-colors ${
      selected ? 'bg-jjl-red/5 border-jjl-red/30' : 'bg-white/[0.02] border-jjl-border hover:border-jjl-border/80 hover:bg-white/[0.03]'
    }`}>
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(student.id, e.target.checked)}
        className="mt-1.5 h-4 w-4 accent-jjl-red shrink-0 cursor-pointer"
        aria-label={`Seleccionar ${student.nombre}`}
      />

      {/* Click area */}
      <Link href={`/admin/${student.id}`} className="flex-1 flex items-start gap-3 min-w-0">
        <Avatar src={student.avatar_url} name={student.nombre} />
        <div className="flex-1 min-w-0">
          {/* Línea 1: nombre + badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[14px] font-semibold text-white truncate">{student.nombre}</span>
            <Badge belt={student.cinturon_actual} />
            {!isAdmin && student.lifecycle_stage && (
              <span className={`inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-bold uppercase tracking-wider ${LIFECYCLE_BADGE[lc] || LIFECYCLE_BADGE.prospect}`}>
                {LIFECYCLE_LABEL[lc]}
              </span>
            )}
            {isAdmin && (
              <span className="inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border-amber-500/30">
                Admin
              </span>
            )}
            {student.is_eligible_1on1 && (
              <span className="inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-bold uppercase tracking-wider bg-green-500/15 text-green-300 border-green-500/30">
                ✓ Listo 1-on-1
              </span>
            )}
            {student.tags && student.tags.map((t) => (
              <span key={t} className="inline-flex items-center h-5 px-1.5 rounded bg-white/5 text-[9px] uppercase tracking-wider text-jjl-muted font-semibold border border-jjl-border">{t}</span>
            ))}
          </div>

          {/* Línea 2: email + días */}
          <p className="text-[12px] text-jjl-muted truncate mt-0.5">
            {student.email || '—'}
            {typeof student.days_in_program === 'number' && <> · {student.days_in_program}d en programa</>}
          </p>

          {/* Línea 3: mes actual + contacto + alertas */}
          <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px]">
            {student.current_mes_label && (
              <span className="inline-flex items-center gap-1 text-jjl-muted">
                {student.current_mes_label}
                <span className={(student.current_mes_percent ?? 0) >= 80 ? 'text-green-400 font-semibold' : 'text-white/70 font-semibold'}>
                  {student.current_mes_percent ?? 0}%
                </span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-jjl-muted">
              <Clock className="h-3 w-3" /> {timeAgo(student.last_contact_at)}
            </span>
            {typeof student.notes_count === 'number' && student.notes_count > 0 && (
              <span className="inline-flex items-center gap-1 text-jjl-muted">
                <StickyNote className="h-3 w-3" /> {student.notes_count}
              </span>
            )}
            {student.alerts && student.alerts.length > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-400">
                <AlertTriangle className="h-3 w-3" /> {student.alerts.map((a) => a.label).join(' · ')}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-jjl-muted/40 shrink-0 mt-2 group-hover:text-jjl-red group-hover:translate-x-0.5 transition-all" />
      </Link>
    </div>
  );
}
