'use client';

import { Search } from 'lucide-react';
import type { FilterState } from './types';

interface Props {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  counts: Record<string, number>;  // counts por quick filter para mostrar al lado
  availableTags: string[];
}

const QUICK_FILTERS: { key: FilterState['quick']; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'ready_1on1', label: 'Listos 1-on-1' },
  { key: 'active', label: 'Activos' },
  { key: 'at_risk', label: 'At risk' },
  { key: 'inactive', label: 'Inactivos 7+d' },
];

const LIFECYCLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Activo' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'paused', label: 'Pausado' },
  { value: 'churned', label: 'Churned' },
];

const BELTS: { value: string; label: string }[] = [
  { value: 'white', label: 'Blanco' },
  { value: 'blue', label: 'Azul' },
  { value: 'purple', label: 'Púrpura' },
  { value: 'brown', label: 'Marrón' },
  { value: 'black', label: 'Negro' },
];

export default function StudentFilters({ filters, onChange, counts, availableTags }: Props) {
  function patch(p: Partial<FilterState>) { onChange({ ...filters, ...p }); }

  return (
    <div className="space-y-2.5">
      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-jjl-muted pointer-events-none" />
        <input
          type="search"
          value={filters.q}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder="Buscar nombre o email…"
          className="w-full h-10 pl-10 pr-4 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
        />
      </div>

      {/* Chips rápidos */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {QUICK_FILTERS.map((q) => {
          const active = filters.quick === q.key;
          const n = counts[q.key] || 0;
          return (
            <button key={q.key} onClick={() => patch({ quick: q.key })}
              className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                active ? 'bg-jjl-red text-white' : 'bg-white/[0.03] text-jjl-muted hover:text-white border border-jjl-border'
              }`}>
              {q.label}
              <span className={`text-[10px] ${active ? 'text-white/80' : 'text-jjl-muted/70'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Dropdowns extras */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filters.belt || ''} onChange={(e) => patch({ belt: e.target.value || null })}
          className="h-8 bg-white/[0.03] border border-jjl-border rounded-md px-2 text-[12px] text-white focus:outline-none focus:border-jjl-red">
          <option value="">Cinturón</option>
          {BELTS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        <select value={filters.lifecycle || ''} onChange={(e) => patch({ lifecycle: e.target.value || null })}
          className="h-8 bg-white/[0.03] border border-jjl-border rounded-md px-2 text-[12px] text-white focus:outline-none focus:border-jjl-red">
          <option value="">Lifecycle</option>
          {LIFECYCLE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        {availableTags.length > 0 && (
          <select value={filters.tag || ''} onChange={(e) => patch({ tag: e.target.value || null })}
            className="h-8 bg-white/[0.03] border border-jjl-border rounded-md px-2 text-[12px] text-white focus:outline-none focus:border-jjl-red">
            <option value="">Tag</option>
            {availableTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {(filters.q || filters.quick !== 'all' || filters.belt || filters.lifecycle || filters.tag) && (
          <button onClick={() => onChange({ q: '', quick: 'all', belt: null, lifecycle: null, tag: null })}
            className="h-8 px-2 text-[11px] text-jjl-muted hover:text-white">
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
