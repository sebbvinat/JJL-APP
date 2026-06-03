'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Video, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { logger } from '@/lib/logger';
import { PLANILLAS } from '@/lib/planillas';
import {
  computePlanillaStats,
  indexOverridesByKey,
  normTitle,
  type PlanillaStats,
  type VideoOverride,
} from '@/lib/admin-videos';
import PlanillaSidebar from '@/components/admin/videos/PlanillaSidebar';
import PlanillaPanel from '@/components/admin/videos/PlanillaPanel';

const DEFAULT_PLANILLA = 'livianos';

// Next.js App Router exige envolver useSearchParams() en <Suspense> para
// que el build de produccion pueda renderizar la pagina sin tener que
// esperar al client. Sin el wrapper, `next build` falla con
// "useSearchParams() should be wrapped in a suspense boundary".
export default function AdminVideosPage() {
  return (
    <Suspense fallback={<AdminVideosSkeleton />}>
      <AdminVideosContent />
    </Suspense>
  );
}

function AdminVideosSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-white/10 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-4">
          <div className="h-96 bg-white/5 rounded-xl" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminVideosContent() {
  const router = useRouter();
  const params = useSearchParams();

  const activePlanillaId = useMemo(() => {
    const q = params.get('planilla');
    return PLANILLAS.some((p) => p.id === q) ? (q as string) : DEFAULT_PLANILLA;
  }, [params]);

  const mesFilter = useMemo(() => {
    const q = params.get('mes');
    if (!q) return null;
    const n = Number(q);
    if (!Number.isFinite(n) || n < 0 || n > 6) return null;
    return n;
  }, [params]);

  const [overridesRaw, setOverridesRaw] = useState<VideoOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedLessonKey, setExpandedLessonKey] = useState<string | null>(null);

  // Index overrides by lesson_key (titulo normalizado) — usado por todas las planillas
  const ovByKey = useMemo(() => indexOverridesByKey(overridesRaw), [overridesRaw]);

  // Stats por planilla (post-override)
  const statsByPlanilla = useMemo(() => {
    const out: Record<string, PlanillaStats> = {};
    for (const p of PLANILLAS) out[p.id] = computePlanillaStats(p, ovByKey);
    return out;
  }, [ovByKey]);

  // Planilla activa
  const activePlanilla = useMemo(
    () => PLANILLAS.find((p) => p.id === activePlanillaId) || PLANILLAS[0],
    [activePlanillaId],
  );

  // Fetch overrides
  const fetchState = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/videos/state', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error');
      setOverridesRaw(body.overrides || []);
    } catch (err) {
      logger.error('admin.videos.state.failed', { err });
      setError(err instanceof Error ? err.message : 'Error al cargar el estado');
    }
    if (mode === 'initial') setLoading(false);
    else setRefreshing(false);
  }, []);

  useEffect(() => {
    void fetchState('initial');
  }, [fetchState]);

  // Cerrar la leccion expandida al cambiar de planilla (puede no existir en la nueva)
  useEffect(() => {
    setExpandedLessonKey(null);
    setSearchFilter('');
  }, [activePlanillaId]);

  // Handlers de query param (sidebar)
  const setPlanilla = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params.toString());
      next.set('planilla', id);
      next.delete('mes');
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const setMes = useCallback(
    (mes: number | null) => {
      const next = new URLSearchParams(params.toString());
      if (mes == null) next.delete('mes');
      else next.set('mes', String(mes));
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const onToggleLesson = useCallback((lessonKey: string) => {
    setExpandedLessonKey((prev) => (prev === lessonKey ? null : lessonKey));
  }, []);

  // Local update post-save: refleja el cambio en memoria sin refetch completo
  const onLessonSaved = useCallback(
    (savedFromTitulo: string, patch: { youtube_id?: string; titulo?: string; descripcion?: string }) => {
      const key = normTitle(savedFromTitulo);
      setOverridesRaw((prev) => {
        const idx = prev.findIndex((o) => o.lesson_key === key);
        const moduleId = idx >= 0 ? prev[idx].module_id : '';   // si es nuevo, dejamos placeholder
        const merged: VideoOverride = idx >= 0
          ? {
              ...prev[idx],
              ...(patch.youtube_id !== undefined ? { youtube_id: patch.youtube_id } : {}),
              ...(patch.titulo !== undefined ? { titulo: patch.titulo } : {}),
              ...(patch.descripcion !== undefined ? { descripcion: patch.descripcion } : {}),
            }
          : {
              module_id: moduleId,
              lesson_key: key,
              ...(patch.youtube_id !== undefined ? { youtube_id: patch.youtube_id } : {}),
              ...(patch.titulo !== undefined ? { titulo: patch.titulo } : {}),
              ...(patch.descripcion !== undefined ? { descripcion: patch.descripcion } : {}),
            };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = merged;
          return next;
        }
        return [merged, ...prev];
      });
    },
    [],
  );

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-white/10 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-4">
            <div className="h-96 bg-white/5 rounded-xl" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-white/5 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-[12px] text-jjl-muted hover:text-white mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al panel
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold">
                Admin · Editor de videos
              </p>
              <h1 className="text-2xl font-black tracking-tight">Planillas y lecciones</h1>
              <p className="text-sm text-jjl-muted mt-0.5">
                Elegí una planilla, navegá por mes y semana, y editá las lecciones inline.
                Las lecciones compartidas afectan las 4 planillas.
              </p>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void fetchState('refresh')}
          loading={refreshing}
          title="Volver a leer los overrides desde la base"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refrescar
        </Button>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
          {error}
        </div>
      )}

      {/* Layout 2-pane */}
      <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-4">
        <PlanillaSidebar
          planillas={PLANILLAS}
          activePlanillaId={activePlanilla.id}
          onSelectPlanilla={setPlanilla}
          statsByPlanilla={statsByPlanilla}
          mesFilter={mesFilter}
          onSelectMes={setMes}
        />
        <PlanillaPanel
          planilla={activePlanilla}
          overrides={ovByKey}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          expandedLessonKey={expandedLessonKey}
          onToggleLesson={onToggleLesson}
          onLessonSaved={onLessonSaved}
          mesFilter={mesFilter}
        />
      </div>
    </div>
  );
}
