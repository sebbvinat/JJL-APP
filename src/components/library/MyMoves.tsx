'use client';

import { useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  Plus,
  X,
  Save,
  Trash2,
  Pencil,
  ImagePlus,
  GripVertical,
  ChevronLeft,
  Loader2,
  Camera,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { fetcher } from '@/lib/fetcher';
import { TOPIC_LABELS, TOPIC_TONE, type LibraryTopic } from '@/lib/library-topics';

interface Step {
  orden: number;
  texto: string;
  photo_url?: string | null;
}
interface Photo {
  url: string;
  caption?: string | null;
}
interface Technique {
  id: string;
  nombre: string;
  topic: LibraryTopic;
  notas: string | null;
  steps: Step[];
  photos: Photo[];
  created_at: string;
  updated_at: string;
}

type View =
  | { kind: 'list' }
  | { kind: 'detail'; technique: Technique }
  | { kind: 'editor'; technique: Technique | null };

export default function MyMoves() {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [activeTopic, setActiveTopic] = useState<LibraryTopic | 'all'>('all');
  const { data, isLoading, mutate } = useSWR<{ techniques: Technique[] }>(
    '/api/techniques',
    fetcher,
    { revalidateOnFocus: false }
  );

  const techniques = data?.techniques || [];
  const filtered = useMemo(() => {
    if (activeTopic === 'all') return techniques;
    return techniques.filter((t) => t.topic === activeTopic);
  }, [techniques, activeTopic]);

  const counts = useMemo(() => {
    const m = new Map<LibraryTopic, number>();
    for (const t of techniques) m.set(t.topic, (m.get(t.topic) || 0) + 1);
    return m;
  }, [techniques]);

  if (view.kind === 'detail') {
    return (
      <TechniqueDetail
        technique={view.technique}
        onBack={() => setView({ kind: 'list' })}
        onEdit={() => setView({ kind: 'editor', technique: view.technique })}
        onDeleted={() => {
          mutate();
          setView({ kind: 'list' });
        }}
      />
    );
  }

  if (view.kind === 'editor') {
    return (
      <TechniqueEditor
        initial={view.technique}
        onCancel={() =>
          view.technique
            ? setView({ kind: 'detail', technique: view.technique })
            : setView({ kind: 'list' })
        }
        onSaved={(t) => {
          mutate();
          setView({ kind: 'detail', technique: t });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-jjl-muted">
          Tu repertorio de tecnicas — fotos, pasos y notas.
        </p>
        <Button size="sm" onClick={() => setView({ kind: 'editor', technique: null })}>
          <Plus className="h-4 w-4" />
          Nuevo
        </Button>
      </div>

      {/* Topic filter chips */}
      {techniques.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Chip
            label="Todas"
            count={techniques.length}
            active={activeTopic === 'all'}
            onClick={() => setActiveTopic('all')}
            tone="bg-white/[0.04] border-jjl-border text-white"
          />
          {(Object.keys(TOPIC_LABELS) as LibraryTopic[])
            .filter((t) => (counts.get(t) || 0) > 0)
            .map((t) => (
              <Chip
                key={t}
                label={TOPIC_LABELS[t]}
                count={counts.get(t) || 0}
                active={activeTopic === t}
                onClick={() => setActiveTopic(t)}
                tone={TOPIC_TONE[t]}
              />
            ))}
        </div>
      )}

      {isLoading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="h-40 bg-white/[0.03] border border-jjl-border rounded-xl animate-pulse" />
          <div className="h-40 bg-white/[0.03] border border-jjl-border rounded-xl animate-pulse" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Camera}
          title={techniques.length === 0 ? 'Empeza tu repertorio' : 'Sin tecnicas en esta categoria'}
          description={
            techniques.length === 0
              ? 'Agrega una tecnica con fotos, pasos numerados y notas. Es tu propia biblioteca.'
              : 'Probá otra categoria o agrega una tecnica nueva.'
          }
          action={{
            label: 'Nueva tecnica',
            onClick: () => setView({ kind: 'editor', technique: null }),
          }}
          className="py-10"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((t) => (
            <TechniqueCard
              key={t.id}
              technique={t}
              onClick={() => setView({ kind: 'detail', technique: t })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Chip({
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
          : 'bg-white/[0.02] border-jjl-border text-jjl-muted hover:text-white'
      }`}
    >
      {label}
      <span className="text-[10px] tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function TechniqueCard({ technique, onClick }: { technique: Technique; onClick: () => void }) {
  const cover = technique.photos[0]?.url;
  return (
    <button
      onClick={onClick}
      className="group text-left bg-white/[0.03] border border-jjl-border hover:border-jjl-red/40 rounded-xl overflow-hidden transition-all"
    >
      <div className="aspect-[16/10] bg-black/40 relative overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={technique.nombre} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-jjl-muted">
            <Camera className="h-10 w-10 opacity-40" strokeWidth={1.4} />
          </div>
        )}
        <span
          className={`absolute top-2 left-2 inline-flex items-center h-5 px-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${TOPIC_TONE[technique.topic]}`}
        >
          {TOPIC_LABELS[technique.topic]}
        </span>
      </div>
      <div className="p-3">
        <h3 className="text-[14px] font-semibold text-white group-hover:text-jjl-red transition-colors line-clamp-1">
          {technique.nombre}
        </h3>
        <p className="text-[11px] text-jjl-muted mt-0.5">
          {technique.steps.length} {technique.steps.length === 1 ? 'paso' : 'pasos'}
          {technique.photos.length > 0 && ` · ${technique.photos.length} fotos`}
        </p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
function TechniqueDetail({
  technique,
  onBack,
  onEdit,
  onDeleted,
}: {
  technique: Technique;
  onBack: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function doDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/techniques/${technique.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      toast.success('Tecnica eliminada');
      onDeleted();
    } catch {
      toast.error('No pudimos eliminar');
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] text-jjl-muted hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver
      </button>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span
              className={`inline-flex items-center h-5 px-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${TOPIC_TONE[technique.topic]}`}
            >
              {TOPIC_LABELS[technique.topic]}
            </span>
            <h2 className="text-2xl font-black tracking-tight mt-2">{technique.nombre}</h2>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {confirmDelete && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/[0.06] p-3">
            <p className="text-[12px] text-white mb-2">Eliminar esta tecnica?</p>
            <div className="flex gap-2">
              <Button size="sm" variant="danger" onClick={doDelete} loading={deleting}>
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Photo gallery */}
        {technique.photos.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {technique.photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p.url}
                alt={p.caption || `Foto ${i + 1}`}
                className="aspect-square w-full object-cover rounded-lg border border-jjl-border"
              />
            ))}
          </div>
        )}

        {/* Notes */}
        {technique.notas && (
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wider text-jjl-muted font-semibold mb-1">
              Notas
            </p>
            <p className="text-[13px] text-white whitespace-pre-wrap leading-relaxed">
              {technique.notas}
            </p>
          </div>
        )}

        {/* Steps */}
        {technique.steps.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wider text-jjl-muted font-semibold mb-2">
              Pasos
            </p>
            <ol className="space-y-2">
              {technique.steps.map((s, i) => (
                <li
                  key={i}
                  className="flex gap-3 items-start bg-white/[0.02] border border-jjl-border rounded-lg p-3"
                >
                  <span className="shrink-0 h-7 w-7 rounded-full bg-jjl-red/20 text-jjl-red flex items-center justify-center text-[13px] font-bold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white whitespace-pre-wrap">{s.texto}</p>
                  </div>
                  {s.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.photo_url}
                      alt={`Paso ${i + 1}`}
                      className="shrink-0 h-16 w-16 object-cover rounded-lg border border-jjl-border"
                    />
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
function TechniqueEditor({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Technique | null;
  onCancel: () => void;
  onSaved: (t: Technique) => void;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(initial?.nombre || '');
  const [topic, setTopic] = useState<LibraryTopic>(initial?.topic || 'otro');
  const [notas, setNotas] = useState(initial?.notas || '');
  const [steps, setSteps] = useState<Step[]>(
    initial?.steps && initial.steps.length > 0 ? initial.steps : []
  );
  const [photos, setPhotos] = useState<Photo[]>(initial?.photos || []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Each upload needs an existing technique id (for storage path scoping). On
  // first save we create the row, then subsequent photo uploads target it.
  const [techniqueId, setTechniqueId] = useState<string | null>(initial?.id || null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function ensureTechniqueId(): Promise<string | null> {
    if (techniqueId) return techniqueId;
    // Create a draft so we have an id for photo uploads
    const res = await fetch('/api/techniques', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre.trim() || 'Sin titulo',
        topic,
        notas,
        steps,
        photos,
      }),
    });
    if (!res.ok) return null;
    const { technique } = await res.json();
    setTechniqueId(technique.id);
    return technique.id;
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    const id = await ensureTechniqueId();
    if (!id) return null;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/techniques/${id}/photo`, { method: 'POST', body: fd });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url;
  }

  async function handleAddPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadPhoto(file);
        if (url) setPhotos((prev) => [...prev, { url }]);
        else toast.error('Una foto fallo al subir');
      }
    } finally {
      setUploading(false);
    }
  }

  function moveStep(from: number, dir: -1 | 1) {
    const to = from + dir;
    if (to < 0 || to >= steps.length) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next.map((s, i) => ({ ...s, orden: i }));
    });
  }

  async function save() {
    if (!nombre.trim()) {
      toast.error('Necesitas un nombre');
      return;
    }
    setSaving(true);
    try {
      const id = await ensureTechniqueId();
      if (!id) throw new Error('create_failed');
      const res = await fetch(`/api/techniques/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          topic,
          notas: notas.trim() || null,
          steps: steps.map((s, i) => ({ ...s, orden: i })),
          photos,
        }),
      });
      if (!res.ok) throw new Error('save_failed');
      const { technique } = await res.json();
      toast.success(initial ? 'Tecnica actualizada' : 'Tecnica creada');
      onSaved(technique);
    } catch {
      toast.error('No pudimos guardar');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 text-[13px] text-jjl-muted hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        Cancelar
      </button>

      <Card>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-jjl-muted font-semibold mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. De la Riva babybolo"
              autoFocus
              className="w-full h-10 px-3 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-jjl-muted font-semibold mb-1">
              Categoria
            </label>
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
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-jjl-muted font-semibold mb-1">
              Notas
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Concepto, contra que tipo de oponente, detalles..."
              rows={3}
              className="w-full px-3 py-2.5 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
            />
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] uppercase tracking-wider text-jjl-muted font-semibold">
                Fotos
              </label>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-[12px] text-jjl-red hover:underline"
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                Agregar
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleAddPhotos(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`Foto ${i + 1}`}
                      className="aspect-square w-full object-cover rounded-lg border border-jjl-border"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Quitar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="w-full aspect-[16/9] flex items-center justify-center gap-2 bg-white/[0.02] border border-dashed border-jjl-border rounded-lg text-jjl-muted hover:text-white hover:border-jjl-border-strong"
                disabled={uploading}
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-[13px]">Tocá para agregar fotos</span>
              </button>
            )}
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] uppercase tracking-wider text-jjl-muted font-semibold">
                Pasos
              </label>
              <button
                type="button"
                onClick={() =>
                  setSteps((prev) => [...prev, { orden: prev.length, texto: '' }])
                }
                className="inline-flex items-center gap-1 text-[12px] text-jjl-red hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo paso
              </button>
            </div>
            {steps.length === 0 ? (
              <p className="text-[12px] text-jjl-muted italic">Sin pasos todavía.</p>
            ) : (
              <ol className="space-y-2">
                {steps.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 bg-white/[0.02] border border-jjl-border rounded-lg p-2"
                  >
                    <div className="flex flex-col gap-0.5 pt-1">
                      <button
                        type="button"
                        onClick={() => moveStep(i, -1)}
                        disabled={i === 0}
                        className="text-jjl-muted hover:text-white disabled:opacity-30"
                        title="Subir"
                      >
                        <GripVertical className="h-3.5 w-3.5 rotate-90" />
                      </button>
                    </div>
                    <span className="shrink-0 h-6 w-6 mt-1 rounded-full bg-jjl-red/20 text-jjl-red flex items-center justify-center text-[11px] font-bold">
                      {i + 1}
                    </span>
                    <textarea
                      value={s.texto}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSteps((prev) =>
                          prev.map((p, idx) => (idx === i ? { ...p, texto: v } : p))
                        );
                      }}
                      placeholder="Que haces en este paso..."
                      rows={2}
                      className="flex-1 bg-transparent border-none text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
                      className="shrink-0 text-jjl-muted hover:text-red-400 p-1"
                      title="Eliminar paso"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="primary" onClick={save} loading={saving}>
              <Save className="h-4 w-4" />
              Guardar
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
