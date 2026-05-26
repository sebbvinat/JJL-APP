'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Video, Mail, Calendar, Trophy, Phone, Unlock, StickyNote, Bell,
  CheckCircle2, MessageSquare, NotebookPen, FileText,
} from 'lucide-react';

type TimelineItem = {
  id: string;
  type: string;
  at: string;
  titulo: string;
  detalle?: string;
};

const TYPE_META: Record<string, { icon: typeof BookOpen; color: string }> = {
  lesson_completed: { icon: BookOpen, color: 'text-green-400' },
  video_uploaded:   { icon: Video, color: 'text-blue-400' },
  video_reviewed:   { icon: CheckCircle2, color: 'text-green-400' },
  journal_entry:    { icon: NotebookPen, color: 'text-purple-400' },
  daily_task:       { icon: FileText, color: 'text-amber-400' },
  message_in:       { icon: MessageSquare, color: 'text-blue-400' },
  message_out:      { icon: MessageSquare, color: 'text-jjl-muted' },
  support_in:       { icon: Mail, color: 'text-blue-400' },
  support_out:      { icon: Mail, color: 'text-jjl-muted' },
  event_rsvp:       { icon: Calendar, color: 'text-purple-400' },
  competition:      { icon: Trophy, color: 'text-amber-400' },
  llamada:          { icon: Phone, color: 'text-jjl-red' },
  unlock:           { icon: Unlock, color: 'text-green-400' },
  admin_note:       { icon: StickyNote, color: 'text-yellow-400' },
  notif:            { icon: Bell, color: 'text-jjl-muted' },
};

const FILTER_GROUPS: { label: string; types: string[] }[] = [
  { label: 'Todo', types: [] },
  { label: 'Curso', types: ['lesson_completed', 'unlock'] },
  { label: 'Videos', types: ['video_uploaded', 'video_reviewed'] },
  { label: 'Comunicación', types: ['message_in', 'message_out', 'support_in', 'support_out', 'llamada'] },
  { label: 'Diario / Eventos', types: ['journal_entry', 'daily_task', 'event_rsvp', 'competition'] },
  { label: 'Admin', types: ['admin_note', 'notif'] },
];

interface Props { userId: string; }

export default function TimelineTab({ userId }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);
  const [activeFilter, setActiveFilter] = useState<string>('Todo');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/students/${userId}/timeline?limit=${limit}`, { cache: 'no-store' });
      const data = await res.json();
      setItems(data?.items || []);
    } finally { setLoading(false); }
  }, [userId, limit]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const group = FILTER_GROUPS.find((g) => g.label === activeFilter);
    if (!group || group.types.length === 0) return items;
    const set = new Set(group.types);
    return items.filter((i) => set.has(i.type));
  }, [items, activeFilter]);

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {FILTER_GROUPS.map((g) => (
          <button key={g.label} onClick={() => setActiveFilter(g.label)}
            className={`shrink-0 h-7 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
              activeFilter === g.label
                ? 'bg-jjl-red text-white'
                : 'bg-white/[0.03] text-jjl-muted hover:text-white border border-jjl-border'
            }`}>
            {g.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <p className="text-[12px] text-jjl-muted italic py-8 text-center">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-[12px] text-jjl-muted italic py-8 text-center">Sin eventos en este filtro.</p>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((it) => {
            const meta = TYPE_META[it.type] || { icon: Bell, color: 'text-jjl-muted' };
            const Icon = meta.icon;
            const when = new Date(it.at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
            return (
              <li key={it.id} className="flex items-start gap-3 rounded-lg border border-jjl-border bg-white/[0.02] px-3 py-2">
                <div className={`shrink-0 mt-0.5 ${meta.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-semibold text-white truncate">{it.titulo}</p>
                    <span className="text-[10px] text-jjl-muted shrink-0">{when}</span>
                  </div>
                  {it.detalle && <p className="text-[12px] text-jjl-muted mt-0.5 line-clamp-2 whitespace-pre-wrap">{it.detalle}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Cargar más */}
      {!loading && filtered.length >= limit && (
        <div className="text-center pt-1">
          <button onClick={() => setLimit((n) => n + 100)} className="h-8 px-3 rounded-md bg-white/[0.03] border border-jjl-border text-[12px] text-jjl-muted hover:text-white">
            Cargar más
          </button>
        </div>
      )}
    </div>
  );
}
