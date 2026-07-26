'use client';

import { useCallback, useEffect, useState } from 'react';
import { Phone, Plus, ExternalLink, Save } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type Llamada = {
  id: string;
  tipo: '1on1' | 'onboarding' | 'setter' | 'reactivacion' | 'otro';
  scheduled_at: string | null;
  completed_at: string | null;
  duration_min: number | null;
  status: 'agendada' | 'completada' | 'no_show' | 'cancelada';
  notes: string | null;
  meet_link: string | null;
  event_id: string | null;
  called_by_name?: string | null;
  created_at: string;
};

const STATUS_META: Record<Llamada['status'], { label: string; tone: string }> = {
  agendada:   { label: 'Agendada', tone: 'bg-blue-500/10 text-blue-300 border-blue-500/30' },
  completada: { label: 'Completada', tone: 'bg-green-500/10 text-green-300 border-green-500/30' },
  no_show:    { label: 'No show', tone: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  cancelada:  { label: 'Cancelada', tone: 'bg-jjl-muted/10 text-jjl-muted border-jjl-border' },
};

interface Props {
  userId: string;
  onScheduleClick: () => void;  // abre Schedule1on1Modal desde el padre
}

export default function LlamadasTab({ userId, onScheduleClick }: Props) {
  const [llamadas, setLlamadas] = useState<Llamada[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const toast = useToast();
  const [draft, setDraft] = useState<{ status: Llamada['status']; notes: string; duration_min: number | null }>({
    status: 'completada', notes: '', duration_min: null,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/students/${userId}/llamadas`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.setupRequired) { setSetupRequired(true); setLoading(false); return; }
      setLlamadas(data?.llamadas || []);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  /**
   * Guarda la edición de una llamada (status, duración y NOTAS PRIVADAS del
   * 1-on-1). Antes no chequeaba res.ok, no tenía guard de doble submit y
   * cerraba el editor igual: si el PATCH fallaba, diez líneas de notas
   * desaparecían sin ningún aviso. Ahora el editor solo se cierra si el
   * guardado confirmó.
   */
  async function saveEdit(l: Llamada) {
    if (savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/students/${userId}/llamadas`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: l.id, ...draft }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudo guardar');
      }
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No pudimos guardar. Tus notas siguen acá.',
      );
    } finally {
      setSavingEdit(false);
    }
  }

  if (setupRequired) {
    return <p className="text-[12px] text-jjl-muted italic p-4 text-center">Falta migración SQL <code className="text-jjl-red">llamadas</code>.</p>;
  }

  const stats = {
    total: llamadas.length,
    completadas: llamadas.filter((l) => l.status === 'completada').length,
    no_shows: llamadas.filter((l) => l.status === 'no_show').length,
    proximas: llamadas.filter((l) => l.status === 'agendada' && l.scheduled_at && new Date(l.scheduled_at) > new Date()).length,
  };

  return (
    <div className="space-y-3">
      {/* Stats + CTA */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 text-[11px] text-jjl-muted">
          <span><b className="text-white">{stats.total}</b> totales</span>
          <span>·</span>
          <span><b className="text-green-400">{stats.completadas}</b> completadas</span>
          <span>·</span>
          <span><b className="text-amber-400">{stats.no_shows}</b> no-shows</span>
          <span>·</span>
          <span><b className="text-blue-400">{stats.proximas}</b> próximas</span>
        </div>
        <button onClick={onScheduleClick}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-jjl-red text-white text-[12px] font-semibold hover:bg-jjl-red-hover">
          <Plus className="h-3.5 w-3.5" /> Agendar 1-on-1
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-[12px] text-jjl-muted italic py-8 text-center">Cargando…</p>
      ) : llamadas.length === 0 ? (
        <p className="text-[12px] text-jjl-muted italic py-8 text-center">Sin llamadas registradas.</p>
      ) : (
        <ul className="space-y-2">
          {llamadas.map((l) => {
            const meta = STATUS_META[l.status];
            const when = l.completed_at || l.scheduled_at;
            return (
              <li key={l.id} className="rounded-xl border border-jjl-border bg-white/[0.02] p-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-white capitalize">{l.tipo === '1on1' ? '1-on-1' : l.tipo}</span>
                      <span className={`inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-bold uppercase tracking-wider ${meta.tone}`}>{meta.label}</span>
                      {l.duration_min && <span className="text-[11px] text-jjl-muted">{l.duration_min} min</span>}
                    </div>
                    <p className="text-[11px] text-jjl-muted mt-0.5">
                      {when ? new Date(when).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : 'sin fecha'}
                      {l.called_by_name && <> · por {l.called_by_name}</>}
                    </p>
                    {editingId === l.id ? (
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2 flex-wrap">
                          <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Llamada['status'] })}
                            className="bg-white/[0.03] border border-jjl-border rounded px-2 py-1 text-[12px] text-white focus:outline-none focus:border-jjl-red">
                            <option value="agendada">Agendada</option>
                            <option value="completada">Completada</option>
                            <option value="no_show">No show</option>
                            <option value="cancelada">Cancelada</option>
                          </select>
                          <input type="number" min={5} step={5} value={draft.duration_min || ''} onChange={(e) => setDraft({ ...draft, duration_min: parseInt(e.target.value, 10) || null })}
                            placeholder="duración (min)"
                            className="w-32 bg-white/[0.03] border border-jjl-border rounded px-2 py-1 text-[12px] text-white focus:outline-none focus:border-jjl-red" />
                        </div>
                        <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3}
                          placeholder="Notas privadas sobre la llamada…"
                          className="w-full bg-white/[0.03] border border-jjl-border rounded-md px-2 py-1.5 text-[12px] text-white focus:outline-none focus:border-jjl-red resize-none" />
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditingId(null)} className="h-7 px-2 text-[11px] text-jjl-muted hover:text-white">Cancelar</button>
                          <button onClick={() => saveEdit(l)} className="inline-flex items-center gap-1 h-7 px-2 rounded text-[11px] bg-jjl-red text-white hover:bg-jjl-red-hover"><Save className="h-3 w-3" /> Guardar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {l.notes && <p className="text-[12px] text-white mt-1.5 whitespace-pre-wrap">{l.notes}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          {l.meet_link && (
                            <a href={l.meet_link} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-jjl-red hover:text-jjl-red-hover">
                              <ExternalLink className="h-3 w-3" /> Abrir link
                            </a>
                          )}
                          <button onClick={() => { setEditingId(l.id); setDraft({ status: l.status, notes: l.notes || '', duration_min: l.duration_min }); }}
                            className="text-[11px] text-jjl-muted hover:text-white">
                            Editar / completar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
