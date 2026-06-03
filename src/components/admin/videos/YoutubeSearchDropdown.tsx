'use client';

import { useEffect, useRef, useState } from 'react';
import { parseYoutubeId } from '@/lib/admin-videos';
import { logger } from '@/lib/logger';

export interface VideoMetadata {
  id: string;
  title: string;
  publishedAt: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  embeddable: boolean;
  thumbnailUrl: string | null;
  channelTitle: string;
}
export interface SearchHit {
  id: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string | null;
}

interface Props {
  /** Llamado cuando el usuario elige un video (por URL/ID/click en hit). */
  onPick: (id: string, meta: VideoMetadata | null) => void;
  /** Llamado mientras hay busqueda en vuelo para indicar status al padre. */
  onLoadingChange?: (loading: boolean) => void;
  /** Placeholder. */
  placeholder?: string;
  /** Si esta cargando inspect (controlado externamente). */
  externalLoading?: boolean;
}

/**
 * Input + dropdown de busqueda de YouTube. Maneja:
 *   - URL/ID pegado    → inspeccion directa
 *   - Texto >= 3 chars → busqueda en el canal con debounce
 *   - Navegacion por teclado ↑↓ enter esc
 */
export default function YoutubeSearchDropdown({ onPick, onLoadingChange, placeholder, externalLoading }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [showHits, setShowHits] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setErrorMsg(null);
    const t = query.trim();
    if (!t) {
      setHits(null);
      setShowHits(false);
      return;
    }
    const asId = parseYoutubeId(t);
    if (asId) {
      setHits(null);
      setShowHits(false);
      debounceRef.current = setTimeout(() => void doInspect(asId), 300);
      return;
    }
    if (t.length < 3) {
      setHits(null);
      setShowHits(false);
      return;
    }
    debounceRef.current = setTimeout(() => void doSearch(t), 400);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

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
      logger.error('YoutubeSearchDropdown.fetchMeta.failed', { err });
      return {};
    }
  }

  async function doInspect(id: string) {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    const meta = await fetchMeta([id]);
    if (reqId !== reqIdRef.current) return;
    setLoading(false);
    const hit = meta[id];
    if (!hit) {
      setErrorMsg('Video no encontrado o privado.');
      onPick(id, null);
      return;
    }
    setErrorMsg(null);
    setQuery('');
    onPick(id, hit);
  }

  async function doSearch(q: string) {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/youtube/search?q=${encodeURIComponent(q)}`);
      const body = await res.json();
      if (reqId !== reqIdRef.current) return;
      if (!res.ok) throw new Error(body?.error || 'Error');
      setHits(body.results || []);
      setActiveIdx((body.results as SearchHit[] | undefined)?.length ? 0 : -1);
      setShowHits(true);
    } catch (err) {
      logger.error('YoutubeSearchDropdown.search.failed', { err });
      setHits([]);
      setShowHits(true);
      setErrorMsg('Error al buscar en YouTube.');
    }
    setLoading(false);
  }

  async function selectHit(hit: SearchHit) {
    setQuery('');
    setShowHits(false);
    setHits(null);
    await doInspect(hit.id);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showHits || !hits || hits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(hits.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[activeIdx];
      if (hit) void selectHit(hit);
    } else if (e.key === 'Escape') {
      setShowHits(false);
    }
  }

  const spinning = loading || externalLoading;

  return (
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
          if (hits && hits.length > 0) setShowHits(true);
        }}
        onBlur={() => {
          blurCloseRef.current = setTimeout(() => setShowHits(false), 180);
        }}
        placeholder={placeholder ?? 'Buscar en tu canal o pegar URL/ID…'}
        className="w-full h-10 px-3 bg-black/30 border border-jjl-border rounded-md text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
      />
      {spinning && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {showHits && hits && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-black/95 backdrop-blur border border-jjl-border rounded-lg shadow-2xl max-h-80 overflow-y-auto">
          {hits.length === 0 ? (
            <p className="text-[12px] text-jjl-muted px-3 py-3 italic">
              Sin resultados en tu canal para “{query.trim()}”.
            </p>
          ) : (
            hits.map((hit, i) => (
              <button
                key={hit.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void selectHit(hit);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-start gap-2.5 px-2.5 py-2 text-left transition-colors border-b border-jjl-border/40 last:border-b-0 ${
                  i === activeIdx ? 'bg-jjl-red/10' : 'hover:bg-white/5'
                }`}
              >
                {hit.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hit.thumbnailUrl} alt="" className="w-20 h-[45px] object-cover rounded shrink-0" />
                ) : (
                  <div className="w-20 h-[45px] rounded bg-white/5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-white font-semibold line-clamp-2 leading-snug">{hit.title}</p>
                  <p className="text-[10px] text-jjl-muted mt-0.5">
                    {hit.publishedAt ? new Date(hit.publishedAt).toLocaleDateString('es-AR') : ''}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {errorMsg && <p className="mt-1.5 text-[11px] text-red-400">{errorMsg}</p>}
    </div>
  );
}
