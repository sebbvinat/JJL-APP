'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Library as LibraryIcon,
  Link as LinkIcon,
  NotebookPen,
  Search,
  Sparkles,
  ExternalLink,
  Eye,
  Filter,
  Download,
  Pencil,
  Trash2,
  Save,
  X,
  Plus,
  Camera,
  ClipboardPaste,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { fetcher } from '@/lib/fetcher';
import { logger } from '@/lib/logger';
import { TOPIC_LABELS, TOPIC_TONE, type LibraryTopic } from '@/lib/library-topics';
import MyMoves from '@/components/library/MyMoves';
import TryLater from '@/components/library/TryLater';

type EntryKind = 'aprendizaje' | 'observacion' | 'nota';

interface Entry {
  id: string;
  fecha: string;
  kind: EntryKind;
  text: string;
  topic: LibraryTopic;
}

interface LinkItem {
  id: string;
  fecha: string;
  url: string;
  host: string;
  context: string;
  topic: LibraryTopic;
}

interface Response {
  months: number;
  from: string;
  counts: { entries: number; links: number };
  byTopic: Record<LibraryTopic, number>;
  entries: Entry[];
  links: LinkItem[];
}

type Tab = 'movimientos' | 'probar' | 'entries' | 'links';

const KIND_META: Record<EntryKind, { label: string; icon: typeof NotebookPen; tone: string }> = {
  aprendizaje: {
    label: 'Aprendizaje',
    icon: Sparkles,
    tone: 'text-yellow-400',
  },
  observacion: {
    label: 'Observacion',
    icon: Eye,
    tone: 'text-jjl-muted',
  },
  nota: {
    label: 'Nota',
    icon: NotebookPen,
    tone: 'text-jjl-red',
  },
};

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderLinkified(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((chunk, i) =>
    URL_REGEX.test(chunk) ? (
      <a
        key={i}
        href={chunk}
        target="_blank"
        rel="noopener noreferrer"
        className="text-jjl-red hover:underline break-all"
      >
        {chunk}
      </a>
    ) : (
      <span key={i}>{chunk}</span>
    )
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryPageInner />
    </Suspense>
  );
}

function LibraryPageInner() {
  const searchParams = useSearchParams();
  const initialTab: Tab = (() => {
    const t = searchParams.get('tab');
    if (t === 'probar' || t === 'entries' || t === 'links' || t === 'movimientos') return t;
    return 'movimientos';
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [months, setMonths] = useState(6);

  // Sync from URL when changed externally (e.g. after share-target redirect)
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'probar' || t === 'entries' || t === 'links' || t === 'movimientos') {
      setTab(t);
    }
  }, [searchParams]);
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState<LibraryTopic | 'all'>('all');
  const [quickKind, setQuickKind] = useState<'nota' | 'aprendizaje' | 'observacion' | null>(null);
  const [quickText, setQuickText] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const quickToast = useToast();

  const libraryKey = `/api/library?months=${months}`;
  const { data, isLoading, mutate } = useSWR<Response>(libraryKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  async function publishQuick() {
    const text = quickText.trim();
    if (!text || !quickKind) return;
    setQuickSaving(true);
    try {
      const res = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: quickKind, text }),
      });
      if (!res.ok) throw new Error('Save failed');
      quickToast.success('Agregado a tu biblioteca');
      setQuickText('');
      setQuickKind(null);
      mutate();
    } catch (err) {
      logger.error('library.quick-add.failed', { err, kind: quickKind });
      quickToast.error('No pudimos guardar');
    }
    setQuickSaving(false);
  }

  const q = query.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (!data) return [];
    return data.entries.filter((e) => {
      if (activeTopic !== 'all' && e.topic !== activeTopic) return false;
      if (q && !e.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, activeTopic, q]);

  const filteredLinks = useMemo(() => {
    if (!data) return [];
    return data.links.filter((l) => {
      if (activeTopic !== 'all' && l.topic !== activeTopic) return false;
      if (!q) return true;
      return (
        l.url.toLowerCase().includes(q) ||
        l.context.toLowerCase().includes(q) ||
        l.host.toLowerCase().includes(q)
      );
    });
  }, [data, activeTopic, q]);

  const availableTopics = useMemo(() => {
    if (!data) return [] as Array<{ topic: LibraryTopic; count: number }>;
    return (Object.entries(data.byTopic) as Array<[LibraryTopic, number]>)
      .filter(([, c]) => c > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([topic, count]) => ({ topic, count }));
  }, [data]);

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold mb-1.5">
            Tu archivo
          </p>
          <h1 className="text-3xl font-black tracking-tight">Biblioteca</h1>
          <p className="text-sm text-jjl-muted mt-1.5">
            Todo lo que anotaste en {months} meses — aprendizajes, notas y links.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="h-9 px-3 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white focus:outline-none focus:border-jjl-red"
          >
            <option value={3}>Ultimos 3 meses</option>
            <option value={6}>Ultimos 6 meses</option>
            <option value={12}>Ultimo año</option>
          </select>
          <Link
            href={`/exportar/diario?from=${format(
              (() => {
                const d = new Date();
                d.setMonth(d.getMonth() - months);
                return d;
              })(),
              'yyyy-MM-dd'
            )}`}
            className="inline-flex items-center gap-2 h-9 px-3 bg-white/[0.03] border border-jjl-border hover:border-jjl-border-strong hover:text-white text-jjl-muted rounded-lg text-[13px] font-semibold transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </Link>
          <Button size="sm" onClick={() => setQuickKind(quickKind ? null : 'nota')}>
            <Plus className="h-4 w-4" />
            Nueva nota
          </Button>
        </div>
      </div>

      {quickKind && (
        <div className="rounded-xl border border-jjl-red/30 bg-jjl-red/[0.05] p-4 space-y-3 animate-slide-down">
          <div className="flex items-center gap-2">
            {(['nota', 'aprendizaje', 'observacion'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setQuickKind(k)}
                className={`h-7 px-3 rounded-full text-[11px] font-semibold uppercase tracking-wider border transition-all ${
                  quickKind === k
                    ? 'bg-jjl-red/20 border-jjl-red/50 text-jjl-red'
                    : 'bg-white/[0.03] border-jjl-border text-jjl-muted hover:text-white'
                }`}
              >
                {k === 'nota' ? 'Nota / link' : k === 'aprendizaje' ? 'Aprendizaje' : 'Observacion'}
              </button>
            ))}
            <button
              onClick={() => {
                setQuickKind(null);
                setQuickText('');
              }}
              className="ml-auto text-[11px] text-jjl-muted hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            placeholder="Escribi y guarda — no hace falta estar en el diario"
            rows={4}
            autoFocus
            className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={publishQuick}
              loading={quickSaving}
              disabled={!quickText.trim()}
            >
              <Save className="h-3.5 w-3.5" />
              Guardar en biblioteca
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-jjl-border rounded-xl p-1 overflow-x-auto">
        {[
          { key: 'movimientos', label: 'Mis movimientos', icon: Camera },
          { key: 'probar', label: 'Para probar', icon: ClipboardPaste },
          { key: 'links', label: 'Links del diario', count: data?.counts.links, icon: LinkIcon },
          {
            key: 'entries',
            label: 'Aprendizajes',
            count: data?.counts.entries,
            icon: NotebookPen,
          },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`shrink-0 inline-flex items-center gap-2 px-3.5 h-9 rounded-lg text-[13px] font-semibold transition-all ${
                active
                  ? 'bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                  : 'text-jjl-muted hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.9} />
              {t.label}
              {typeof t.count === 'number' && t.count > 0 && (
                <span className="text-[11px] text-jjl-muted tabular-nums">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + topic filters — only for tabs that need them */}
      {(tab === 'links' || tab === 'entries') && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-jjl-muted pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar texto, URL, dominio..."
              className="w-full h-10 pl-10 pr-4 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
            />
          </div>

          {availableTopics.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <span className="flex items-center gap-1 text-[11px] text-jjl-muted uppercase tracking-wider font-semibold shrink-0">
                <Filter className="h-3 w-3" />
                Tema
              </span>
              <TopicChip
                label="Todos"
                count={
                  (tab === 'links' ? data?.counts.links : data?.counts.entries) ?? 0
                }
                active={activeTopic === 'all'}
                onClick={() => setActiveTopic('all')}
                tone="bg-white/[0.04] border-jjl-border text-white"
              />
              {availableTopics.map(({ topic, count }) => (
                <TopicChip
                  key={topic}
                  label={TOPIC_LABELS[topic]}
                  count={count}
                  active={activeTopic === topic}
                  onClick={() => setActiveTopic(topic)}
                  tone={TOPIC_TONE[topic]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {tab === 'movimientos' ? (
        <MyMoves />
      ) : tab === 'probar' ? (
        <TryLater />
      ) : isLoading && !data ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !data || data.counts.entries === 0 ? (
        <EmptyState
          icon={LibraryIcon}
          title="Tu biblioteca va a crecer"
          description="Todo lo que escribas en el diario (aprendizajes, notas, links) aparece aca para revisar despues."
          action={{ label: 'Ir al diario', href: '/journal' }}
          className="py-14"
        />
      ) : tab === 'links' ? (
        <LinksView links={filteredLinks} />
      ) : (
        <EntriesView entries={filteredEntries} onChanged={() => mutate()} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function LinksView({ links }: { links: LinkItem[] }) {
  if (links.length === 0) {
    return (
      <EmptyState
        icon={LinkIcon}
        title="Sin links con esos filtros"
        description="Probá otro tema o borra la busqueda."
        className="py-10"
      />
    );
  }
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <Card key={`${l.fecha}-${i}`} className="group">
          <div className="flex items-start gap-3">
            <div
              className={`h-9 w-9 rounded-lg border ring-1 flex items-center justify-center shrink-0 ${TOPIC_TONE[l.topic]}`}
            >
              <LinkIcon className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-semibold text-white hover:text-jjl-red truncate inline-flex items-center gap-1.5 group"
                >
                  {l.host}
                  <ExternalLink className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
                </a>
                <TopicBadge topic={l.topic} />
              </div>
              <p className="text-[11px] text-jjl-muted/70 mt-0.5">
                {format(parseISO(l.fecha), "EEE d 'de' MMM yyyy", { locale: es })}
              </p>
              {l.context && (
                <p className="text-[12px] text-jjl-muted mt-2 leading-relaxed line-clamp-2">
                  {l.context}
                </p>
              )}
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-jjl-red/80 hover:text-jjl-red mt-1.5 inline-block break-all"
              >
                {l.url}
              </a>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function EntriesView({ entries, onChanged }: { entries: Entry[]; onChanged: () => void }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="Sin entradas con esos filtros"
        description="Probá otro tema o borra la busqueda."
        className="py-10"
      />
    );
  }

  // Group by month for a cleaner archive feel.
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = format(parseISO(e.fecha), 'yyyy-MM');
    const list = groups.get(key) || [];
    list.push(e);
    groups.set(key, list);
  }

  return (
    <div className="space-y-5">
      {Array.from(groups.entries()).map(([monthKey, items]) => (
        <section key={monthKey} className="space-y-2">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold px-1">
            {format(parseISO(monthKey + '-01'), 'MMMM yyyy', { locale: es })}
          </h3>
          <div className="space-y-2">
            {items.map((e, i) => (
              <EntryCard key={`${e.fecha}-${e.kind}-${i}`} entry={e} onChanged={onChanged} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EntryCard({ entry, onChanged }: { entry: Entry; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.text);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const Icon = KIND_META[entry.kind].icon;

  async function save(newText: string) {
    setSaving(true);
    try {
      const trimmed = newText.trim();
      const res = trimmed
        ? await fetch(`/api/journal-entries/${entry.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: trimmed }),
          })
        : await fetch(`/api/journal-entries/${entry.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'No pudimos guardar');
      }
      toast.success(trimmed ? 'Entrada actualizada' : 'Entrada eliminada');
      setEditing(false);
      setConfirmDelete(false);
      onChanged();
    } catch (err) {
      logger.error('library.entry.save.failed', { err });
      toast.error('Error al guardar');
    }
    setSaving(false);
  }

  function cancel() {
    setText(entry.text);
    setEditing(false);
    setConfirmDelete(false);
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${KIND_META[entry.kind].tone} bg-current/10 ring-1 ring-current/15`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.1} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/journal?d=${entry.fecha}`}
              className="text-[12px] font-semibold text-white hover:text-jjl-red"
            >
              {format(parseISO(entry.fecha), "EEE d 'de' MMM", { locale: es })}
            </Link>
            <span className="text-[10px] uppercase tracking-wider text-jjl-muted/70 font-semibold">
              · {KIND_META[entry.kind].label}
            </span>
            <TopicBadge topic={entry.topic} />
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={Math.max(3, text.split('\n').length + 1)}
                className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={() => save(text)} loading={saving}>
                  <Save className="h-3.5 w-3.5" />
                  Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={cancel}>
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </Button>
              </div>
            </div>
          ) : confirmDelete ? (
            <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/[0.06] p-3">
              <p className="text-[12px] text-white mb-2">Eliminar esta entrada del diario?</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => save('')}
                  loading={saving}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </Button>
                <Button size="sm" variant="ghost" onClick={cancel}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-white mt-1.5 whitespace-pre-wrap leading-relaxed">
                {renderLinkified(entry.text)}
              </p>
              <div className="mt-2.5 flex gap-3 text-[11px]">
                <button
                  onClick={() => {
                    setText(entry.text);
                    setEditing(true);
                  }}
                  className="inline-flex items-center gap-1 text-jjl-muted hover:text-white font-semibold"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1 text-jjl-muted hover:text-red-400 font-semibold"
                >
                  <Trash2 className="h-3 w-3" />
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function TopicChip({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold whitespace-nowrap border transition-all ${
        active
          ? tone + ' scale-105'
          : 'bg-white/[0.02] border-jjl-border text-jjl-muted hover:text-white hover:border-jjl-border-strong'
      }`}
    >
      {label}
      <span className="text-[10px] tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function TopicBadge({ topic }: { topic: LibraryTopic }) {
  return (
    <span
      className={`inline-flex items-center h-5 px-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${TOPIC_TONE[topic]}`}
    >
      {TOPIC_LABELS[topic]}
    </span>
  );
}
