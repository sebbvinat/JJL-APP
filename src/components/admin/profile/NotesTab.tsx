'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pin, PinOff, Plus, Trash2, Save } from 'lucide-react';

type Note = {
  id: string;
  texto: string;
  pinned: boolean;
  created_by: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
};

interface Props {
  userId: string;
}

export default function NotesTab({ userId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/students/${userId}/notes`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.setupRequired) { setSetupRequired(true); setLoading(false); return; }
      setNotes(data?.notes || []);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function addNote() {
    const texto = draft.trim();
    if (!texto || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/students/${userId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      if (res.ok) { setDraft(''); await load(); }
    } finally { setSaving(false); }
  }

  async function togglePin(n: Note) {
    await fetch(`/api/admin/students/${userId}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: n.id, pinned: !n.pinned }),
    });
    void load();
  }

  async function saveEdit(id: string) {
    const texto = editingText.trim();
    if (!texto) return;
    await fetch(`/api/admin/students/${userId}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, texto }),
    });
    setEditingId(null);
    setEditingText('');
    void load();
  }

  async function deleteNote(id: string) {
    if (!confirm('¿Borrar esta nota?')) return;
    await fetch(`/api/admin/students/${userId}/notes?id=${id}`, { method: 'DELETE' });
    void load();
  }

  if (setupRequired) {
    return <p className="text-[12px] text-jjl-muted italic p-4 text-center">Falta migración SQL <code className="text-jjl-red">admin_notes</code>.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Add new */}
      <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void addNote(); }}
          placeholder="Escribí una nota interna (no la ve el alumno)… Ctrl+Enter para guardar"
          rows={3}
          maxLength={4000}
          className="w-full bg-transparent text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none resize-none"
        />
        <div className="flex items-center justify-end pt-2 border-t border-jjl-border/40">
          <button onClick={addNote} disabled={!draft.trim() || saving}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-jjl-red text-white text-[12px] font-semibold hover:bg-jjl-red-hover disabled:opacity-40">
            <Plus className="h-3.5 w-3.5" /> {saving ? 'Guardando…' : 'Agregar nota'}
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-[12px] text-jjl-muted italic py-4 text-center">Cargando…</p>
      ) : notes.length === 0 ? (
        <p className="text-[12px] text-jjl-muted italic py-8 text-center">Sin notas todavía.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-xl border p-3 ${n.pinned ? 'bg-jjl-red/5 border-jjl-red/30' : 'bg-white/[0.02] border-jjl-border'}`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="text-[11px] text-jjl-muted">
                  {n.pinned && <span className="text-jjl-red font-bold mr-1">📌</span>}
                  {n.created_by_name || 'Admin'} · {new Date(n.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                  {n.updated_at && n.updated_at !== n.created_at && <span className="ml-1 italic">(editada)</span>}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => togglePin(n)} title={n.pinned ? 'Despinear' : 'Pinear'}
                    className="h-7 w-7 flex items-center justify-center rounded text-jjl-muted hover:text-white hover:bg-white/5">
                    {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => { setEditingId(n.id); setEditingText(n.texto); }} title="Editar"
                    className="h-7 px-2 rounded text-[11px] text-jjl-muted hover:text-white hover:bg-white/5">Editar</button>
                  <button onClick={() => deleteNote(n.id)} title="Eliminar"
                    className="h-7 w-7 flex items-center justify-center rounded text-jjl-muted hover:text-red-400 hover:bg-white/5">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {editingId === n.id ? (
                <>
                  <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={3} autoFocus
                    className="w-full bg-black/30 border border-jjl-border rounded-md px-2 py-1.5 text-[13px] text-white focus:outline-none focus:border-jjl-red resize-none" />
                  <div className="flex items-center justify-end gap-1 mt-1.5">
                    <button onClick={() => { setEditingId(null); setEditingText(''); }} className="h-7 px-2 text-[11px] text-jjl-muted hover:text-white">Cancelar</button>
                    <button onClick={() => saveEdit(n.id)} className="inline-flex items-center gap-1 h-7 px-2 rounded text-[11px] bg-jjl-red text-white hover:bg-jjl-red-hover"><Save className="h-3 w-3" /> Guardar</button>
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-white whitespace-pre-wrap leading-relaxed">{n.texto}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
