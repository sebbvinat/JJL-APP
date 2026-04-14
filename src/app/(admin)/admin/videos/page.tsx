'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Video,
  Search,
  ChevronDown,
  Check,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';
import { MOCK_MODULES, MOCK_LESSONS, type MockLesson } from '@/lib/mock-data';

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function normalizeYoutubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/
  );
  if (m) return m[1];
  if (YT_ID_RE.test(s)) return s;
  return null;
}

interface VideoMetadata {
  id: string;
  title: string;
  publishedAt: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  embeddable: boolean;
  thumbnailUrl: string | null;
  channelTitle: string;
}

interface SearchHit {
  id: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string | null;
}

export default function AdminVideosPage() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['mod-0']));

  const q = query.trim().toLowerCase();
  const filteredModules = useMemo(() => {
    if (!q) return MOCK_MODULES;
    return MOCK_MODULES.filter((m) => {
      if (m.titulo.toLowerCase().includes(q)) return true;
      const lessons = MOCK_LESSONS[m.id] || [];
      return lessons.some((l) => l.titulo.toLowerCase().includes(q));
    });
  }, [q]);

  function toggle(moduleId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      <header>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[12px] text-jjl-muted hover:text-white mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al panel
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold">
              Admin
            </p>
            <h1 className="text-2xl font-black tracking-tight">Editor de videos</h1>
            <p className="text-sm text-jjl-muted mt-0.5">
              Escribi el titulo del video de tu canal o pega el link. El cambio aplica a todos tus alumnos.
            </p>
          </div>
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-jjl-muted pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar modulo o leccion..."
          className="w-full h-10 pl-10 pr-4 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
        />
      </div>

      <div className="space-y-2">
        {filteredModules.map((mod) => {
          const lessons = (MOCK_LESSONS[mod.id] || []).filter((l) => l.tipo !== 'reflection');
          const isOpen = expanded.has(mod.id);
          return (
            <div
              key={mod.id}
              className="rounded-xl border border-jjl-border bg-white/[0.02] overflow-hidden"
            >
              <button
                onClick={() => toggle(mod.id)}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-white/[0.03] transition-colors"
              >
                <span className="inline-flex h-8 px-2 items-center rounded-md bg-jjl-red/10 border border-jjl-red/20 text-jjl-red text-[10px] font-bold uppercase tracking-[0.14em] shrink-0">
                  {mod.semana_numero === 0 ? 'Intro' : `S${mod.semana_numero}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white truncate">{mod.titulo}</p>
                  <p className="text-[11px] text-jjl-muted">{lessons.length} videos</p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-jjl-muted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-jjl-border/60 bg-black/20 p-3 space-y-3 animate-slide-down">
                  {lessons.map((lesson) => (
                    <LessonRow key={lesson.id} moduleId={mod.id} lesson={lesson} />
                  ))}
                  {lessons.length === 0 && (
                    <p className="text-[12px] text-jjl-muted italic py-3 text-center">
                      Sin videos en este modulo.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filteredModules.length === 0 && (
          <Card>
            <p className="text-center py-8 text-[13px] text-jjl-muted">
              No hay modulos que coincidan con &quot;{q}&quot;.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LessonRow — search-by-title or paste-ID, preview, save
// ---------------------------------------------------------------------------

function LessonRow({ moduleId, lesson }: { moduleId: string; lesson: MockLesson }) {
  const toast = useToast();

  const [currentId, setCurrentId] = useState<string>(lesson.youtube_id || '');
  const [pendingId, setPendingId] = useState<string>(lesson.youtube_id || '');
  const [query, setQuery] = useState<string>('');
  const [inspectMeta, setInspectMeta] = useState<VideoMetadata | null>(null);
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null);
  const [activeHitIdx, setActiveHitIdx] = useState<number>(-1);
  const [showHits, setShowHits] = useState(false);
  const [loadingInspect, setLoadingInspect] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);
  const blurCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const changed = pendingId !== currentId;
  const canSave = changed && !!pendingId && !!inspectMeta && inspectMeta.embeddable && !saving;

  // On mount: fetch metadata for the currently-saved ID so the preview
  // card shows the user what's stored today.
  useEffect(() => {
    if (!currentId) return;
    (async () => {
      const meta = await fetchMeta([currentId]);
      setInspectMeta(meta[currentId] || null);
    })();
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to query changes (debounced):
  //   empty    → clear hits
  //   ID/URL   → inspect
  //   text ≥3  → search the channel
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setErrorMsg(null);
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchHits(null);
      setShowHits(false);
      return;
    }
    const asId = normalizeYoutubeId(trimmed);
    if (asId) {
      setSearchHits(null);
      setShowHits(false);
      debounceRef.current = setTimeout(() => void inspectOne(asId), 300);
      return;
    }
    if (trimmed.length < 3) {
      setSearchHits(null);
      setShowHits(false);
      return;
    }
    debounceRef.current = setTimeout(() => void runSearch(trimmed), 400);
  }, [query]);

  async function fetchMeta(ids: string[]): Promise<Record<string, VideoMetadata>> {
    try {
      const res = await fetch('/api/admin/youtube/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error');
      return body.videos || {};
    } catch (err) {
      logger.error('admin.videos.fetchMeta.failed', { err });
      return {};
    }
  }

  async function inspectOne(id: string) {
    const reqId = ++reqIdRef.current;
    setLoadingInspect(true);
    const meta = await fetchMeta([id]);
    if (reqId !== reqIdRef.current) return;
    setLoadingInspect(false);
    const hit = meta[id];
    if (!hit) {
      setInspectMeta(null);
      setPendingId(id);
      setErrorMsg('Video no encontrado o privado.');
      return;
    }
    setInspectMeta(hit);
    setPendingId(id);
    setErrorMsg(null);
  }

  async function runSearch(q: string) {
    const reqId = ++reqIdRef.current;
    setLoadingSearch(true);
    try {
      const res = await fetch(`/api/admin/youtube/search?q=${encodeURIComponent(q)}`);
      const body = await res.json();
      if (reqId !== reqIdRef.current) return;
      if (!res.ok) throw new Error(body?.error || 'Error');
      setSearchHits(body.results || []);
      setActiveHitIdx((body.results as SearchHit[] | undefined)?.length ? 0 : -1);
      setShowHits(true);
    } catch (err) {
      logger.error('admin.videos.search.failed', { err });
      setSearchHits([]);
      setShowHits(true);
      setErrorMsg('Error al buscar en YouTube.');
    }
    setLoadingSearch(false);
  }

  function selectHit(hit: SearchHit) {
    setQuery('');
    setShowHits(false);
    setSearchHits(null);
    void inspectOne(hit.id);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showHits || !searchHits || searchHits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveHitIdx((i) => Math.min(searchHits.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveHitIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = searchHits[activeHitIdx];
      if (hit) selectHit(hit);
    } else if (e.key === 'Escape') {
      setShowHits(false);
    }
  }

  async function save() {
    if (!canSave || !inspectMeta) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/update-lesson-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_id: moduleId,
          lesson_id: lesson.id,
          youtube_id: pendingId,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error al guardar');
      toast.success(
        body.updated > 0
          ? `Actualizado en ${body.updated} alumno${body.updated === 1 ? '' : 's'}`
          : 'Guardado (nadie tiene este modulo asignado todavia)'
      );
      setCurrentId(pendingId);
    } catch (err) {
      logger.error('admin.videos.save.failed', { err, moduleId, lessonId: lesson.id });
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
    setSaving(false);
  }

  const titleSimilarityWarn =
    inspectMeta && !fuzzyIncludes(inspectMeta.title, lesson.titulo)
      ? 'El titulo del video no coincide con la leccion — confirma que es el correcto.'
      : null;

  return (
    <div className="rounded-lg bg-white/[0.02] border border-jjl-border/60 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-white">{lesson.titulo}</p>
        {currentId && YT_ID_RE.test(currentId) && (
          <a
            href={`https://www.youtube.com/watch?v=${currentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-jjl-muted hover:text-white inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            ver actual
          </a>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (blurCloseRef.current) {
              clearTimeout(blurCloseRef.current);
              blurCloseRef.current = null;
            }
            if (searchHits && searchHits.length > 0) setShowHits(true);
          }}
          onBlur={() => {
            blurCloseRef.current = setTimeout(() => setShowHits(false), 180);
          }}
          placeholder="Escribi el titulo del video, o pega la URL / ID"
          className="w-full h-10 px-3 bg-black/30 border border-jjl-border rounded-md text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
        />
        {(loadingSearch || loadingInspect) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {showHits && searchHits && (
          <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-black/95 backdrop-blur border border-jjl-border rounded-lg shadow-2xl max-h-80 overflow-y-auto">
            {searchHits.length === 0 ? (
              <p className="text-[12px] text-jjl-muted px-3 py-3 italic">
                Sin resultados en tu canal para &quot;{query.trim()}&quot;.
              </p>
            ) : (
              searchHits.map((hit, i) => (
                <button
                  key={hit.id}
                  onMouseDown={(e) => {
                    // Use onMouseDown so we fire before onBlur closes the panel.
                    e.preventDefault();
                    selectHit(hit);
                  }}
                  onMouseEnter={() => setActiveHitIdx(i)}
                  className={`w-full flex items-start gap-2.5 px-2.5 py-2 text-left transition-colors border-b border-jjl-border/40 last:border-b-0 ${
                    i === activeHitIdx ? 'bg-jjl-red/10' : 'hover:bg-white/5'
                  }`}
                >
                  {hit.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={hit.thumbnailUrl}
                      alt=""
                      className="w-20 h-[45px] object-cover rounded shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-[45px] rounded bg-white/5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-white font-semibold line-clamp-2 leading-snug">
                      {hit.title}
                    </p>
                    <p className="text-[10px] text-jjl-muted mt-0.5">
                      {hit.publishedAt
                        ? new Date(hit.publishedAt).toLocaleDateString('es-AR')
                        : ''}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-[12px] text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {inspectMeta && <PreviewCard meta={inspectMeta} warning={titleSimilarityWarn} />}

      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant={canSave ? 'primary' : 'secondary'}
          onClick={save}
          disabled={!canSave}
          loading={saving}
        >
          <Save className="h-3.5 w-3.5" />
          {changed ? 'Guardar cambio' : 'Sin cambios'}
        </Button>
      </div>
    </div>
  );
}

function PreviewCard({
  meta,
  warning,
}: {
  meta: VideoMetadata;
  warning: string | null;
}) {
  const privacyTone =
    meta.privacyStatus === 'public'
      ? 'bg-green-500/10 border-green-500/30 text-green-400'
      : meta.privacyStatus === 'unlisted'
        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
        : 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  const privacyLabel =
    meta.privacyStatus === 'public'
      ? 'Publico'
      : meta.privacyStatus === 'unlisted'
        ? 'Oculto'
        : 'Privado';

  return (
    <div className="flex items-start gap-3 rounded-lg border border-jjl-border bg-black/20 p-2.5">
      {meta.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.thumbnailUrl}
          alt=""
          className="w-[120px] h-[68px] object-cover rounded shrink-0"
        />
      ) : (
        <div className="w-[120px] h-[68px] rounded bg-white/5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-white leading-snug line-clamp-2">{meta.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span
            className={`inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-bold uppercase tracking-wider ${privacyTone}`}
          >
            {privacyLabel}
          </span>
          {meta.embeddable ? (
            <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-bold uppercase tracking-wider">
              <Check className="h-3 w-3" />
              Embed OK
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase tracking-wider">
              Embed bloqueado
            </span>
          )}
          <span className="text-[10px] text-jjl-muted font-mono">{meta.id}</span>
        </div>
        {!meta.embeddable && (
          <p className="text-[11px] text-red-400 mt-1.5">
            Este video tiene embed desactivado en YouTube — no se vera en la app.
          </p>
        )}
        {warning && <p className="text-[11px] text-amber-400 mt-1.5">{warning}</p>}
      </div>
    </div>
  );
}

function fuzzyIncludes(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const A = norm(a);
  const B = norm(b);
  if (!A || !B) return false;
  if (A.includes(B) || B.includes(A)) return true;
  const tokensA = new Set(A.split(' ').filter((t) => t.length >= 3));
  const tokensB = B.split(' ').filter((t) => t.length >= 3);
  return tokensB.some((t) => tokensA.has(t));
}
