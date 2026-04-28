'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Plus,
  ClipboardPaste,
  ExternalLink,
  Trash2,
  Check,
  Loader2,
  X,
  Save,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { fetcher } from '@/lib/fetcher';
import { TOPIC_LABELS, TOPIC_TONE, hostOf, type LibraryTopic } from '@/lib/library-topics';

interface SavedLink {
  id: string;
  url: string;
  source: string | null;
  titulo: string | null;
  notas: string | null;
  thumbnail_url: string | null;
  topic: LibraryTopic;
  status: 'pending' | 'tried';
  created_at: string;
}

const SOURCE_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  other: 'Link',
};

export default function TryLater() {
  const toast = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [url, setUrl] = useState('');
  const [titulo, setTitulo] = useState('');
  const [notas, setNotas] = useState('');
  const [topic, setTopic] = useState<LibraryTopic>('otro');
  const [saving, setSaving] = useState(false);

  const { data, isLoading, mutate } = useSWR<{ links: SavedLink[] }>(
    '/api/saved-links?status=pending',
    fetcher,
    { revalidateOnFocus: false }
  );

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const m = text.match(/https?:\/\/[^\s]+/);
      const candidate = m?.[0] || text;
      setUrl(candidate);
      setShowDialog(true);
    } catch {
      toast.error('No pude leer el portapapeles. Pegalo manualmente.');
      setShowDialog(true);
    }
  }

  async function save() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch('/api/saved-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmed,
          titulo: titulo.trim() || null,
          notas: notas.trim() || null,
          topic,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Guardado');
      setShowDialog(false);
      setUrl('');
      setTitulo('');
      setNotas('');
      setTopic('otro');
      mutate();
    } catch {
      toast.error('No pudimos guardar');
    }
    setSaving(false);
  }

  async function markTried(id: string) {
    try {
      const res = await fetch(`/api/saved-links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'tried' }),
      });
      if (!res.ok) throw new Error();
      toast.success('Marcado como probado');
      mutate();
    } catch {
      toast.error('Error');
    }
  }

  async function remove(id: string) {
    if (!confirm('Eliminar este link?')) return;
    try {
      const res = await fetch(`/api/saved-links/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Eliminado');
      mutate();
    } catch {
      toast.error('Error');
    }
  }

  const links = data?.links || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-jjl-muted">
          Links de Instagram, TikTok, YouTube para probar despues.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={pasteFromClipboard}>
            <ClipboardPaste className="h-4 w-4" />
            Pegar link
          </Button>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </div>
      </div>

      {showDialog && (
        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Nuevo link</h3>
              <button
                onClick={() => setShowDialog(false)}
                className="text-jjl-muted hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-10 px-3 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
            />
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Titulo (opcional)"
              className="w-full h-10 px-3 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
            />
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas (que probar, contra quien...)"
              rows={2}
              className="w-full px-3 py-2.5 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
            />
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value as LibraryTopic)}
              className="w-full h-10 px-3 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white focus:outline-none focus:border-jjl-red"
            >
              {(Object.entries(TOPIC_LABELS) as Array<[LibraryTopic, string]>).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button variant="primary" onClick={save} loading={saving} disabled={!url.trim()}>
                <Save className="h-4 w-4" />
                Guardar
              </Button>
              <Button variant="ghost" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading && !data ? (
        <div className="space-y-2">
          <div className="h-20 bg-white/[0.03] border border-jjl-border rounded-xl animate-pulse" />
          <div className="h-20 bg-white/[0.03] border border-jjl-border rounded-xl animate-pulse" />
        </div>
      ) : links.length === 0 ? (
        <EmptyState
          icon={ClipboardPaste}
          title="Sin links guardados"
          description="Pegá un link de Instagram, TikTok o YouTube para probar despues. En Android podes compartir directo a la app desde el share sheet."
          action={{ label: 'Pegar link', onClick: pasteFromClipboard }}
          className="py-10"
        />
      ) : (
        <div className="space-y-2">
          {links.map((l) => (
            <Card key={l.id}>
              <div className="flex items-start gap-3">
                <div
                  className={`shrink-0 h-9 w-9 rounded-lg border ring-1 flex items-center justify-center ${TOPIC_TONE[l.topic]}`}
                >
                  <ExternalLink className="h-4 w-4" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[14px] font-semibold text-white hover:text-jjl-red truncate inline-flex items-center gap-1.5"
                    >
                      {l.titulo || hostOf(l.url)}
                      <ExternalLink className="h-3.5 w-3.5 opacity-50" />
                    </a>
                    <span
                      className={`inline-flex items-center h-5 px-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${TOPIC_TONE[l.topic]}`}
                    >
                      {TOPIC_LABELS[l.topic]}
                    </span>
                    {l.source && (
                      <span className="text-[10px] uppercase tracking-wider text-jjl-muted/70 font-semibold">
                        {SOURCE_LABEL[l.source] || l.source}
                      </span>
                    )}
                  </div>
                  {l.notas && (
                    <p className="text-[12px] text-jjl-muted mt-1 leading-relaxed">{l.notas}</p>
                  )}
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-jjl-red/80 hover:text-jjl-red mt-1 inline-block break-all"
                  >
                    {l.url}
                  </a>
                  <div className="mt-2 flex gap-3 text-[11px]">
                    <button
                      onClick={() => markTried(l.id)}
                      className="inline-flex items-center gap-1 text-jjl-muted hover:text-green-400 font-semibold"
                    >
                      <Check className="h-3 w-3" />
                      Probado
                    </button>
                    <button
                      onClick={() => remove(l.id)}
                      className="inline-flex items-center gap-1 text-jjl-muted hover:text-red-400 font-semibold"
                    >
                      <Trash2 className="h-3 w-3" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
