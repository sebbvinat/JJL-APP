'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Save, AlertTriangle, Check, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';
import LessonStatusDot from './LessonStatusDot';
import SharedBadge from './SharedBadge';
import YoutubeSearchDropdown, { type VideoMetadata } from './YoutubeSearchDropdown';
import type { PlanillaLesson } from '@/lib/planillas';
import { isSharedSemana, lessonStatus } from '@/lib/admin-videos';

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export interface LessonRowProps {
  moduleId: string;            // mod-<semana_numero>
  semanaNumero: number;
  index: number;               // posicion en la semana (1-based para display)
  lesson: PlanillaLesson;      // post-override (titulo + youtube_id efectivos)
  originalTitulo: string;      // titulo canonical de planillas.ts (para fallback de matching)
  expanded: boolean;
  onToggle: () => void;
  onSaved: (patch: { youtube_id?: string; titulo?: string; descripcion?: string }, savedFromTitulo: string) => void;
}

export default function LessonRow({
  moduleId,
  semanaNumero,
  index,
  lesson,
  originalTitulo,
  expanded,
  onToggle,
  onSaved,
}: LessonRowProps) {
  const toast = useToast();
  const isReflection = lesson.tipo === 'reflection';
  const isShared = isSharedSemana(semanaNumero);
  const status = lessonStatus(lesson);

  const [currentId, setCurrentId] = useState<string>(lesson.youtube_id || '');
  const [pendingId, setPendingId] = useState<string>(lesson.youtube_id || '');
  const [titulo, setTitulo] = useState<string>(lesson.titulo);
  const [descripcion, setDescripcion] = useState<string>('');
  const [savedTitulo, setSavedTitulo] = useState<string>(lesson.titulo);
  const [savedDescripcion, setSavedDescripcion] = useState<string>('');
  const [inspectMeta, setInspectMeta] = useState<VideoMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialLoadRef = useRef(false);

  const idChanged = pendingId !== currentId;
  const tituloChanged = titulo.trim() !== savedTitulo;
  const descripcionChanged = descripcion !== savedDescripcion;
  const changed = idChanged || tituloChanged || descripcionChanged;
  const idValidForSave = !idChanged || pendingId === '' || (!!pendingId && YT_ID_RE.test(pendingId) && !!inspectMeta && inspectMeta.embeddable);
  const canSave = changed && idValidForSave && !!titulo.trim() && !saving;

  // Fetch meta del id current cuando se expande la primera vez
  useEffect(() => {
    if (!expanded || isReflection) return;
    if (initialLoadRef.current) return;
    if (!currentId) {
      initialLoadRef.current = true;
      return;
    }
    initialLoadRef.current = true;
    void (async () => {
      setLoadingMeta(true);
      try {
        const res = await fetch('/api/admin/youtube/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [currentId] }),
        });
        const body = await res.json();
        if (res.ok) setInspectMeta(body.videos?.[currentId] || null);
      } catch (err) {
        logger.error('LessonRow.inspectInitial.failed', { err });
      }
      setLoadingMeta(false);
    })();
  }, [expanded, currentId, isReflection]);

  function onPickFromSearch(id: string, meta: VideoMetadata | null) {
    setPendingId(id);
    setInspectMeta(meta);
  }

  function clearPendingId() {
    setPendingId('');
    setInspectMeta(null);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: Record<string, string | number> = {
        module_id: moduleId,
        // IDs de planillas.ts no siempre matchean los de DB; el endpoint usa
        // lesson_titulo_original como fallback (matching por titulo).
        lesson_id: '',
        lesson_titulo_original: originalTitulo,
        // Scope por semana: el endpoint solo toca la lección de ESTA semana,
        // así un título repetido en otras semanas (ej "Drill 1: Leg Trap") no
        // se contamina. Las semanas compartidas (mes 1-2) siguen aplicando a
        // las 4 planillas porque el scope es por semana, no por planilla.
        semana_numero: semanaNumero,
      };
      if (idChanged) payload.youtube_id = pendingId;
      if (tituloChanged) payload.titulo = titulo.trim();
      if (descripcionChanged) payload.descripcion = descripcion;

      const res = await fetch('/api/admin/update-lesson-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error al guardar');

      const updatedCount = body.updated ?? 0;
      toast.success(
        updatedCount > 0
          ? `Guardado · actualizado en ${updatedCount} alumno${updatedCount === 1 ? '' : 's'}`
          : 'Guardado (override persistido, ningún alumno tiene este módulo aún)',
      );

      const savedFromTitulo = savedTitulo;
      const patch: { youtube_id?: string; titulo?: string; descripcion?: string } = {};
      if (idChanged) {
        patch.youtube_id = pendingId;
        setCurrentId(pendingId);
      }
      if (tituloChanged) {
        patch.titulo = titulo.trim();
        setSavedTitulo(titulo.trim());
      }
      if (descripcionChanged) {
        patch.descripcion = descripcion;
        setSavedDescripcion(descripcion);
      }
      onSaved(patch, savedFromTitulo);
    } catch (err) {
      logger.error('LessonRow.save.failed', { err, moduleId, originalTitulo });
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
    setSaving(false);
  }

  const previewId = pendingId || currentId;
  const previewHref = previewId && YT_ID_RE.test(previewId) ? `https://www.youtube.com/watch?v=${previewId}` : null;

  // ──────────────────────────────────────────────────────
  // Collapsed (default)
  // ──────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <button
        onClick={onToggle}
        className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-jjl-border/60 bg-white/[0.015] hover:bg-white/[0.04] hover:border-jjl-border transition-colors text-left"
      >
        <span className="text-[11px] font-mono text-jjl-muted w-6 text-right tabular-nums shrink-0">
          {index + 1}.
        </span>
        <LessonStatusDot status={status} />
        <span className="flex-1 min-w-0 text-[13px] font-medium text-white truncate">
          {lesson.titulo}
        </span>
        {isShared && !isReflection && <SharedBadge />}
        {!isReflection && previewId && (
          <span className="hidden sm:inline-block text-[10px] font-mono text-jjl-muted/70 bg-white/5 px-1.5 py-0.5 rounded shrink-0">
            {previewId}
          </span>
        )}
        {isReflection && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-300/80 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded shrink-0">
            Reflexión
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-jjl-muted shrink-0 group-hover:text-white transition-colors" />
      </button>
    );
  }

  // ──────────────────────────────────────────────────────
  // Expanded
  // ──────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-jjl-red/30 bg-white/[0.025] shadow-lg shadow-black/40 overflow-hidden animate-slide-down">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-jjl-border/60 bg-black/20">
        <span className="text-[11px] font-mono text-jjl-muted w-6 text-right tabular-nums shrink-0">
          {index + 1}.
        </span>
        <LessonStatusDot status={status} />
        <span className="flex-1 min-w-0 text-[13px] font-bold text-white truncate">
          {lesson.titulo}
        </span>
        {isShared && !isReflection && <SharedBadge />}
        <button
          onClick={onToggle}
          className="text-jjl-muted hover:text-white transition-colors p-1"
          title="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      {isReflection ? (
        <div className="p-4 text-center">
          <p className="text-[12px] text-purple-300/80 italic">
            Las reflexiones semanales no tienen video. Es una entrada de texto del alumno.
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Titulo */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-jjl-muted mb-1">
              Título de la lección
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={200}
              className="w-full h-10 px-3 bg-black/30 border border-jjl-border rounded-md text-[13px] font-medium text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
            />
            {isShared && titulo.trim() !== savedTitulo && (
              <p className="mt-1 text-[10px] text-blue-300/80">
                ⚠ Cambiar el título de una lección compartida afecta las 4 planillas.
              </p>
            )}
          </div>

          {/* Buscador YT */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-jjl-muted mb-1">
              {pendingId ? 'Cambiar video' : 'Asignar video'}
            </label>
            <YoutubeSearchDropdown
              onPick={onPickFromSearch}
              placeholder="Pegar URL/ID de YouTube o buscar título en tu canal…"
              externalLoading={loadingMeta}
            />
          </div>

          {/* Preview / current */}
          {(previewId || inspectMeta) && (
            <CurrentVideoCard
              meta={inspectMeta}
              previewId={previewId}
              originalTitle={lesson.titulo}
              isPending={!!idChanged}
              onClear={clearPendingId}
              currentId={currentId}
            />
          )}

          {/* Descripcion */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-jjl-muted mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Anotación para el alumno…"
              className="w-full px-3 py-2 bg-black/30 border border-jjl-border rounded-md text-[12px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-y"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-jjl-muted">
              {previewHref ? (
                <a href={previewHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white transition-colors">
                  <ExternalLink className="h-3 w-3" />
                  abrir en YouTube
                </a>
              ) : (
                <span className="italic">sin video todavía</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {changed && (
                <button
                  onClick={() => {
                    setPendingId(currentId);
                    setTitulo(savedTitulo);
                    setDescripcion(savedDescripcion);
                  }}
                  className="text-[11px] text-jjl-muted hover:text-white transition-colors px-2 py-1"
                >
                  Descartar
                </button>
              )}
              <Button
                size="sm"
                variant={canSave ? 'primary' : 'secondary'}
                onClick={save}
                disabled={!canSave}
                loading={saving}
              >
                <Save className="h-3.5 w-3.5" />
                {changed ? 'Guardar' : 'Sin cambios'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Preview card (current or pending video)
// ────────────────────────────────────────────────────────
function CurrentVideoCard({
  meta,
  previewId,
  originalTitle,
  isPending,
  onClear,
  currentId,
}: {
  meta: VideoMetadata | null;
  previewId: string;
  originalTitle: string;
  isPending: boolean;
  onClear: () => void;
  currentId: string;
}) {
  const titleMismatch = useMemo(() => {
    if (!meta) return null;
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const a = norm(meta.title);
    const b = norm(originalTitle);
    if (!a || !b) return null;
    if (a.includes(b) || b.includes(a)) return null;
    const tokensA = new Set(a.split(' ').filter((t) => t.length >= 3));
    const tokensB = b.split(' ').filter((t) => t.length >= 3);
    if (tokensB.some((t) => tokensA.has(t))) return null;
    return 'El título del video no coincide con la lección — confirmá que es el correcto.';
  }, [meta, originalTitle]);

  const privacyTone =
    meta?.privacyStatus === 'public'
      ? 'bg-green-500/10 border-green-500/30 text-green-400'
      : meta?.privacyStatus === 'unlisted'
        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
        : 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  const privacyLabel = meta?.privacyStatus === 'public' ? 'Público' : meta?.privacyStatus === 'unlisted' ? 'Oculto' : 'Privado';

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-2.5 ${isPending ? 'border-jjl-red/40 bg-jjl-red/[0.04]' : 'border-jjl-border bg-black/20'}`}>
      {meta?.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meta.thumbnailUrl} alt="" className="w-[120px] h-[68px] object-cover rounded shrink-0" />
      ) : (
        <div className="w-[120px] h-[68px] rounded bg-white/5 shrink-0 flex items-center justify-center text-[10px] text-jjl-muted">
          {previewId ? 'sin preview' : ''}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-bold text-white leading-snug line-clamp-2">
            {meta?.title || (previewId && previewId !== currentId ? 'Buscando…' : 'Video guardado')}
          </p>
          {isPending && (
            <button
              onClick={onClear}
              className="shrink-0 text-[10px] text-jjl-muted hover:text-red-400 inline-flex items-center gap-0.5"
              title="Cancelar cambio"
            >
              <X className="h-3 w-3" />
              quitar
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {isPending && (
            <span className="inline-flex items-center h-5 px-1.5 rounded bg-jjl-red/15 border border-jjl-red/40 text-jjl-red text-[10px] font-bold uppercase tracking-wider">
              Pendiente
            </span>
          )}
          {meta && (
            <>
              <span className={`inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-bold uppercase tracking-wider ${privacyTone}`}>
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
            </>
          )}
          <span className="text-[10px] text-jjl-muted/70 font-mono">{previewId}</span>
        </div>
        {meta && !meta.embeddable && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-red-400">Embed desactivado — el alumno no podrá verlo dentro de la app.</p>
          </div>
        )}
        {titleMismatch && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-400">{titleMismatch}</p>
          </div>
        )}
      </div>
    </div>
  );
}
