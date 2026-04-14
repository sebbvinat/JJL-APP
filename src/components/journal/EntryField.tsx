'use client';

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { fetcher } from '@/lib/fetcher';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

type Kind = 'aprendizaje' | 'observacion' | 'nota';

interface Entry {
  id: string;
  kind: Kind;
  text: string;
  fecha: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  kind: Kind;
  /** If provided, create entries tied to this fecha. Omit for standalone. */
  fecha?: string;
  label: string;
  placeholder: string;
  iconTone: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Optional wrapper renderer (e.g. to linkify URLs in the value). */
  renderText?: (text: string) => React.ReactNode;
  /** Label for the add button. */
  addLabel?: string;
}

export default function EntryField({
  kind,
  fecha,
  label,
  placeholder,
  iconTone,
  icon: Icon,
  renderText,
  addLabel,
}: Props) {
  const listKey = fecha
    ? `/api/journal-entries?fecha=${fecha}&kind=${kind}`
    : `/api/journal-entries?kind=${kind}`;
  const { data, isLoading, mutate } = useSWR<{ entries: Entry[] }>(listKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });
  const { mutate: globalMutate } = useSWRConfig();
  const toast = useToast();

  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const entries = data?.entries || [];

  async function add() {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    try {
      const res = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, text, fecha: fecha ?? null }),
      });
      if (!res.ok) throw new Error('Save failed');
      setDraft('');
      mutate();
      // library shares this data — invalidate its key too
      globalMutate((k: string) => typeof k === 'string' && k.startsWith('/api/journal-entries'));
      toast.success('Guardado');
    } catch (err) {
      logger.error('entry-field.add.failed', { err, kind });
      toast.error('No pudimos guardar');
    }
    setSaving(false);
  }

  return (
    <div className="rounded-xl border border-jjl-border bg-gradient-to-b from-jjl-gray to-jjl-gray/70 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] space-y-3">
      <div className="flex items-center gap-2.5">
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center ring-1 shrink-0 ${iconTone}`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-jjl-muted">
          {label}
        </span>
        {entries.length > 0 && (
          <span className="text-[10px] text-jjl-muted/60 tabular-nums ml-auto">
            {entries.length}
          </span>
        )}
      </div>

      {/* Existing entries */}
      {isLoading && !data ? (
        <div className="skeleton h-12 rounded-lg" />
      ) : entries.length > 0 ? (
        <div className="space-y-2">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} onChanged={() => mutate()} renderText={renderText} />
          ))}
        </div>
      ) : null}

      {/* Add new entry */}
      <div className="space-y-2 pt-1">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
        />
        <div className="flex items-center justify-end">
          <Button
            size="sm"
            variant="primary"
            onClick={add}
            disabled={!draft.trim()}
            loading={saving}
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel || 'Agregar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  onChanged,
  renderText,
}: {
  entry: Entry;
  onChanged: () => void;
  renderText?: (text: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.text);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/journal-entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Actualizado');
      setEditing(false);
      onChanged();
    } catch (err) {
      logger.error('entry-field.update.failed', { err });
      toast.error('No pudimos guardar');
    }
    setSaving(false);
  }

  async function remove() {
    setSaving(true);
    try {
      const res = await fetch(`/api/journal-entries/${entry.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Eliminado');
      onChanged();
    } catch (err) {
      logger.error('entry-field.delete.failed', { err });
      toast.error('No pudimos eliminar');
    }
    setSaving(false);
  }

  const createdTime = format(parseISO(entry.created_at), 'HH:mm', { locale: es });

  if (editing) {
    return (
      <div className="rounded-lg border border-jjl-red/30 bg-jjl-red/[0.04] p-3 space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.max(3, text.split('\n').length + 1)}
          className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={save} loading={saving}>
            <Save className="h-3.5 w-3.5" />
            Guardar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setText(entry.text);
              setEditing(false);
            }}
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] p-3">
        <p className="text-[12px] text-white mb-2">Eliminar esta entrada?</p>
        <div className="flex gap-2">
          <Button size="sm" variant="danger" onClick={remove} loading={saving}>
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-jjl-border bg-white/[0.02] p-3">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-jjl-muted/60 font-semibold tabular-nums">
          {createdTime}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setText(entry.text);
              setEditing(true);
            }}
            className="text-[11px] text-jjl-muted hover:text-white inline-flex items-center gap-1"
            aria-label="Editar"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-[11px] text-jjl-muted hover:text-red-400 inline-flex items-center gap-1"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <p className="text-[13px] text-white whitespace-pre-wrap leading-relaxed">
        {renderText ? renderText(entry.text) : entry.text}
      </p>
    </div>
  );
}
