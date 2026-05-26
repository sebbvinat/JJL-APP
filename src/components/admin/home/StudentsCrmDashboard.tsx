'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { CheckCircle2, Users, Video, BarChart3, FileSpreadsheet, NotebookPen } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { fetcher } from '@/lib/fetcher';
import ActionRequiredPanel from './ActionRequiredPanel';
import StudentFilters from './StudentFilters';
import StudentCrmRow from './StudentCrmRow';
import BulkActionBar from './BulkActionBar';
import type { CrmStudent, FilterState } from './types';

function matchesFilter(s: CrmStudent, f: FilterState): boolean {
  const q = f.q.toLowerCase().trim();
  if (q && !`${s.nombre} ${s.email || ''}`.toLowerCase().includes(q)) return false;
  if (f.belt && s.cinturon_actual !== f.belt) return false;
  if (f.lifecycle && (s.lifecycle_stage || 'prospect') !== f.lifecycle) return false;
  if (f.tag && !(s.tags || []).includes(f.tag)) return false;

  switch (f.quick) {
    case 'all': return true;
    case 'ready_1on1': return !!s.is_eligible_1on1;
    case 'active': return s.lifecycle_stage === 'active';
    case 'at_risk': return s.lifecycle_stage === 'at_risk';
    case 'inactive':
      return typeof s.days_since_activity === 'number' && s.days_since_activity >= 7;
    case 'no_lifecycle': return !s.lifecycle_stage || s.lifecycle_stage === 'prospect';
  }
}

export default function StudentsCrmDashboard() {
  const { data, isLoading, mutate } = useSWR<{ students: CrmStudent[] }>(
    '/api/admin/students?enrich=1',
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 5 * 60_000 }
  );
  const all = useMemo(() => (data?.students || []).filter((s) => s.rol !== 'admin'), [data]);

  const [filters, setFilters] = useState<FilterState>({ q: '', quick: 'all', belt: null, lifecycle: null, tag: null });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => all.filter((s) => matchesFilter(s, filters)), [all, filters]);

  const counts = useMemo<Record<string, number>>(() => ({
    all: all.length,
    ready_1on1: all.filter((s) => s.is_eligible_1on1).length,
    active: all.filter((s) => s.lifecycle_stage === 'active').length,
    at_risk: all.filter((s) => s.lifecycle_stage === 'at_risk').length,
    inactive: all.filter((s) => typeof s.days_since_activity === 'number' && s.days_since_activity >= 7).length,
  }), [all]);

  const availableTags = useMemo(() => {
    const s = new Set<string>();
    all.forEach((u) => (u.tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [all]);

  function toggleSelect(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected(new Set(filtered.map((s) => s.id)));
  }

  function onBulkDone(msg: string) {
    setToast(msg);
    void mutate(); // refresh data
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <div className="space-y-4">
      {/* Quick links a herramientas del admin (preservamos del flow viejo) */}
      <div className="flex gap-2 flex-wrap text-[12px]">
        <Link href="/admin/analytics" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/15"><BarChart3 className="h-3 w-3" /> Reportes</Link>
        <Link href="/admin/diaries" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-jjl-red/10 border border-jjl-red/30 text-jjl-red hover:bg-jjl-red/15"><NotebookPen className="h-3 w-3" /> Diarios</Link>
        <Link href="/admin/courses" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/15"><FileSpreadsheet className="h-3 w-3" /> Planillas</Link>
        <Link href="/admin/reviews" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/15">🎥 Videos pendientes</Link>
        <Link href="/admin/videos" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/15"><Video className="h-3 w-3" /> YouTube IDs</Link>
      </div>

      {/* Acción requerida pinned */}
      <ActionRequiredPanel students={all} />

      {/* Filtros */}
      <StudentFilters filters={filters} onChange={setFilters} counts={counts} availableTags={availableTags} />

      {/* Header de lista */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[12px] text-jjl-muted">
          <b className="text-white">{filtered.length}</b> de {all.length} alumnos
          {selected.size > 0 && <> · {selected.size} seleccionado{selected.size === 1 ? '' : 's'}</>}
        </div>
        <div className="flex items-center gap-1">
          {filtered.length > 0 && (
            <button onClick={selectAllFiltered}
              className="h-7 px-2.5 rounded text-[11px] text-jjl-muted hover:text-white border border-jjl-border hover:border-white/30">
              Seleccionar visibles
            </button>
          )}
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())}
              className="h-7 px-2.5 rounded text-[11px] text-jjl-muted hover:text-white">
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      {isLoading && !data ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Sin alumnos en este filtro" description="Probá limpiar los filtros o crear uno nuevo." className="py-10" />
      ) : (
        <div className="space-y-1.5">
          {filtered.map((s) => (
            <StudentCrmRow key={s.id} student={s} selected={selected.has(s.id)} onSelect={toggleSelect} />
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      <BulkActionBar selectedIds={[...selected]} onClear={() => setSelected(new Set())} onDone={onBulkDone} />

      {/* Toast simple */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg text-sm font-medium shadow-xl bg-green-900/90 border border-green-500/30 text-green-300">
          <CheckCircle2 className="h-4 w-4 inline mr-1.5" />
          {toast}
        </div>
      )}
    </div>
  );
}
