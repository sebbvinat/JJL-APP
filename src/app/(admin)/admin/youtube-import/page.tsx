'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Loader2, CheckCircle2, AlertCircle, Video as YoutubeIcon, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type Match = {
  module_id: string;
  modules: string[];
  student_count: number;
  current_youtube_ids: string[];
  will_replace: boolean;
};

type VideoRow = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  match: Match | null;
};

type SearchResponse = {
  date: string;
  exclude: string;
  total_uploaded: number;
  after_exclude: number;
  matched: number;
  unmatched: number;
  videos: VideoRow[];
};

export default function YoutubeImportPage() {
  const toast = useToast();
  const [date, setDate] = useState('2026-06-01');
  const [exclude, setExclude] = useState('ADN DISTANCIA MEDIA');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<{ id: string; title: string; ok: boolean; msg?: string }[]>([]);

  async function search() {
    setLoading(true);
    setData(null);
    setResults([]);
    try {
      const res = await fetch(`/api/admin/youtube/by-date?date=${encodeURIComponent(date)}&exclude=${encodeURIComponent(exclude)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error');
      setData(body);
      // Pre-seleccionar los que tienen match Y van a reemplazar
      const auto = new Set<string>();
      (body.videos as VideoRow[]).forEach((v) => {
        if (v.match && v.match.will_replace) auto.add(v.id);
      });
      setSelected(auto);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally { setLoading(false); }
  }

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function apply() {
    if (!data || selected.size === 0) return;
    if (!confirm(`Aplicar ${selected.size} reemplazo${selected.size === 1 ? '' : 's'} de youtube_id?\n\nCada uno se aplica a TODOS los alumnos que tengan esa lección + queda como override canónico.`)) return;
    setApplying(true);
    const out: typeof results = [];
    for (const v of data.videos) {
      if (!selected.has(v.id) || !v.match) continue;
      try {
        const res = await fetch('/api/admin/update-lesson-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            module_id: v.match.module_id,
            lesson_titulo_original: v.title,
            youtube_id: v.id,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        out.push({ id: v.id, title: v.title, ok: true, msg: `Actualizado en ${body.updated || 0} alumnos` });
      } catch (e) {
        out.push({ id: v.id, title: v.title, ok: false, msg: e instanceof Error ? e.message : 'Error' });
      }
      setResults([...out]);
    }
    setApplying(false);
    const okCount = out.filter((r) => r.ok).length;
    toast.success(`${okCount}/${out.length} aplicados`);
  }

  return (
    <div className="max-w-5xl xl:max-w-6xl mx-auto space-y-5 pb-12">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12px] text-jjl-muted hover:text-white mb-3">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al panel
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
          <YoutubeIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold">Admin · YouTube</p>
          <h1 className="text-2xl font-black tracking-tight">Import por fecha</h1>
          <p className="text-sm text-jjl-muted mt-0.5">
            Lista los videos del canal subidos un día puntual y reemplaza el youtube_id en las lecciones que tengan el mismo título.
          </p>
        </div>
      </div>

      {/* Inputs */}
      <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-jjl-muted font-semibold block mb-1">Fecha (UTC)</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 px-3 bg-black/30 border border-jjl-border rounded-md text-[13px] text-white focus:outline-none focus:border-jjl-red" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-jjl-muted font-semibold block mb-1">Excluir (regex, case insensitive)</label>
            <input type="text" value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="ADN DISTANCIA MEDIA"
              className="w-full h-10 px-3 bg-black/30 border border-jjl-border rounded-md text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red" />
          </div>
        </div>
        <button onClick={search} disabled={loading || !date}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-jjl-red text-white text-[13px] font-semibold hover:bg-jjl-red-hover disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Buscando…' : 'Buscar videos'}
        </button>
      </div>

      {/* Results */}
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
            <Stat label="Subidos ese día" value={data.total_uploaded} />
            <Stat label="Tras exclusión" value={data.after_exclude} />
            <Stat label="Match con lección" value={data.matched} tone="green" />
            <Stat label="Sin match" value={data.unmatched} tone="muted" />
          </div>

          {/* Bulk apply bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-lg border border-jjl-border bg-white/[0.02]">
            <p className="text-[12px] text-jjl-muted">
              <b className="text-white">{selected.size}</b> seleccionado{selected.size === 1 ? '' : 's'} para aplicar
            </p>
            <button onClick={apply} disabled={applying || selected.size === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-jjl-red text-white text-[13px] font-semibold hover:bg-jjl-red-hover disabled:opacity-50">
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Aplicar reemplazos
            </button>
          </div>

          {/* Table */}
          <div className="space-y-1.5">
            {data.videos.map((v) => {
              const res = results.find((r) => r.id === v.id);
              const checked = selected.has(v.id);
              const canSelect = !!v.match;
              return (
                <label key={v.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  checked ? 'bg-jjl-red/5 border-jjl-red/30' :
                  !v.match ? 'bg-white/[0.01] border-jjl-border/50 opacity-70' :
                  'bg-white/[0.02] border-jjl-border hover:bg-white/[0.03]'
                }`}>
                  <input type="checkbox" checked={checked} disabled={!canSelect}
                    onChange={(e) => toggle(v.id, e.target.checked)}
                    className="mt-1.5 h-4 w-4 accent-jjl-red shrink-0" />
                  {v.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnailUrl} alt="" className="w-24 h-[54px] object-cover rounded shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-white truncate">{v.title}</p>
                      <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener" className="text-[10px] text-jjl-muted hover:text-white">
                        <ExternalLink className="h-3 w-3 inline" />
                      </a>
                      <span className="font-mono text-[10px] text-jjl-muted">{v.id}</span>
                    </div>
                    {v.match ? (
                      <div className="text-[11px] text-jjl-muted mt-1 space-y-0.5">
                        <p>
                          {v.match.will_replace ? (
                            <span className="text-green-300 font-semibold">↻ Reemplaza</span>
                          ) : (
                            <span className="text-amber-300 font-semibold">= Ya está</span>
                          )}
                          {' '}en <b className="text-white">{v.match.student_count}</b> alumno{v.match.student_count === 1 ? '' : 's'} · módulo {v.match.module_id}
                          {v.match.modules.length > 1 && <> (+{v.match.modules.length - 1} otros)</>}
                        </p>
                        {v.match.current_youtube_ids.length > 0 && (
                          <p>
                            Actual: {v.match.current_youtube_ids.map((id) => <code key={id} className="font-mono text-jjl-red/70">{id}</code>).reduce((acc, x, i) => i === 0 ? [x] : [...acc, <span key={`s${i}`}>, </span>, x], [] as React.ReactNode[])}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-jjl-muted/70 mt-1 italic">Sin lección con ese título — no se puede aplicar</p>
                    )}
                    {res && (
                      <p className={`text-[11px] mt-1.5 ${res.ok ? 'text-green-300' : 'text-red-300'}`}>
                        {res.ok ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <AlertCircle className="h-3 w-3 inline mr-1" />}
                        {res.msg}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'muted' }) {
  const c = tone === 'green' ? 'text-green-300' : tone === 'muted' ? 'text-jjl-muted' : 'text-white';
  return (
    <div className="rounded-md border border-jjl-border bg-white/[0.02] p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-jjl-muted">{label}</p>
      <p className={`text-xl font-bold ${c}`}>{value}</p>
    </div>
  );
}
