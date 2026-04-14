'use client';

import { useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import {
  format,
  parseISO,
  differenceInCalendarDays,
  isToday,
  isPast,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Trophy,
  Plus,
  MapPin,
  Calendar,
  Shield,
  Target,
  ChevronDown,
  Pencil,
  Trash2,
  X,
  Save,
  Flag,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { fetcher } from '@/lib/fetcher';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

interface Competition {
  id: string;
  nombre: string;
  fecha: string;
  lugar: string | null;
  categoria: string | null;
  modalidad: string | null;
  importancia: 'baja' | 'normal' | 'alta';
  resultado: string | null;
  notas: string | null;
}

const IMPORTANCIA_TONE: Record<Competition['importancia'], string> = {
  alta: 'text-red-400 bg-red-500/10 border-red-500/25',
  normal: 'text-jjl-muted bg-white/5 border-white/10',
  baja: 'text-jjl-muted/60 bg-white/[0.02] border-white/5',
};

const IMPORTANCIA_LABEL: Record<Competition['importancia'], string> = {
  alta: 'Alta',
  normal: 'Normal',
  baja: 'Baja',
};

interface PrepPhase {
  label: string;
  focus: string;
  minDays: number;
  maxDays: number;
}

const PREP_PLAN: PrepPhase[] = [
  { label: 'Base (4+ sem)', focus: 'Volumen alto, tecnica nueva, condicion fisica.', minDays: 28, maxDays: Infinity },
  { label: 'Especifico (3-4 sem)', focus: 'Juego competitivo afilado. Sparring con foco.', minDays: 15, maxDays: 28 },
  { label: 'Puesta a punto (1-2 sem)', focus: 'Tapering. Situaciones cortas. Peso y hidratacion.', minDays: 4, maxDays: 14 },
  { label: 'Activacion (3 dias)', focus: 'Movilidad, tecnica suave, descanso real.', minDays: 1, maxDays: 3 },
  { label: 'Competencia', focus: 'Ejecutar. Ya entrenaste, confiá.', minDays: 0, maxDays: 0 },
];

function currentPhase(daysUntil: number): PrepPhase | null {
  if (daysUntil < 0) return null;
  for (const p of PREP_PLAN) {
    if (daysUntil >= p.minDays && daysUntil <= p.maxDays) return p;
  }
  return PREP_PLAN[0];
}

export default function CompetitionsPage() {
  const { data, isLoading } = useSWR<{ competitions: Competition[] }>(
    '/api/competitions',
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 30_000 }
  );
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Competition | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Competition | null>(null);
  const [deleting, setDeleting] = useState(false);

  const competitions = data?.competitions || [];
  const today = new Date();

  const { upcoming, past } = useMemo(() => {
    const up: Competition[] = [];
    const pa: Competition[] = [];
    for (const c of competitions) {
      const d = parseISO(c.fecha);
      if (isPast(d) && !isToday(d)) pa.push(c);
      else up.push(c);
    }
    // upcoming ascending (closest first), past descending (most recent first)
    up.sort((a, b) => a.fecha.localeCompare(b.fecha));
    pa.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return { upcoming: up, past: pa };
  }, [competitions]);

  const nextComp = upcoming[0];
  const daysUntilNext = nextComp
    ? differenceInCalendarDays(parseISO(nextComp.fecha), today)
    : null;

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/competitions?id=${confirmDelete.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Competencia eliminada');
        mutate('/api/competitions');
        setConfirmDelete(null);
      } else {
        toast.error('No pudimos eliminar');
      }
    } catch (err) {
      logger.error('competitions.delete.failed', { err });
      toast.error('Error de conexion');
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold mb-1.5">
            Calendario
          </p>
          <h1 className="text-3xl font-black tracking-tight">Competencias</h1>
          <p className="text-sm text-jjl-muted mt-1.5">
            Registra tus torneos y entrena con objetivo.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva competencia
        </Button>
      </div>

      {/* Countdown hero (next upcoming) */}
      {nextComp && daysUntilNext != null && (
        <NextCompetitionHero
          comp={nextComp}
          daysUntil={daysUntilNext}
          onEdit={() => {
            setEditing(nextComp);
            setFormOpen(true);
          }}
        />
      )}

      {isLoading && !data ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : competitions.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Sin competencias todavia"
          description="Agrega tu proximo torneo para empezar a entrenar con fecha."
          tone="red"
          action={{ label: 'Agregar competencia', onClick: () => setFormOpen(true) }}
          className="py-12"
        />
      ) : (
        <>
          {upcoming.length > (nextComp ? 1 : 0) && (
            <section className="space-y-2">
              <h2 className="text-[13px] font-bold text-white flex items-center gap-2 px-1">
                <Calendar className="h-4 w-4 text-jjl-red" />
                Proximas ({upcoming.length})
              </h2>
              <div className="space-y-2">
                {upcoming.slice(nextComp ? 1 : 0).map((c) => (
                  <CompetitionRow
                    key={c.id}
                    comp={c}
                    onEdit={() => {
                      setEditing(c);
                      setFormOpen(true);
                    }}
                    onDelete={() => setConfirmDelete(c)}
                  />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[13px] font-bold text-white flex items-center gap-2 px-1">
                <Flag className="h-4 w-4 text-jjl-muted" />
                Historial ({past.length})
              </h2>
              <div className="space-y-2">
                {past.map((c) => (
                  <CompetitionRow
                    key={c.id}
                    comp={c}
                    isPast
                    onEdit={() => {
                      setEditing(c);
                      setFormOpen(true);
                    }}
                    onDelete={() => setConfirmDelete(c)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {formOpen && (
        <CompetitionForm
          initial={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            mutate('/api/competitions');
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Eliminar competencia?"
          description={`"${confirmDelete.nombre}" se eliminara de tu calendario.`}
          confirmLabel={deleting ? 'Eliminando...' : 'Eliminar'}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          destructive
          loading={deleting}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NextCompetitionHero({
  comp,
  daysUntil,
  onEdit,
}: {
  comp: Competition;
  daysUntil: number;
  onEdit: () => void;
}) {
  const phase = currentPhase(daysUntil);
  const fechaLabel = format(parseISO(comp.fecha), "EEEE d 'de' MMMM yyyy", {
    locale: es,
  });

  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full blur-3xl opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(220,38,38,0.55), transparent 70%)',
        }}
      />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-jjl-red font-bold mb-1">
            {daysUntil === 0
              ? 'Es hoy'
              : daysUntil === 1
                ? 'Es manana'
                : `Faltan ${daysUntil} dias`}
          </p>
          <h2 className="text-2xl font-black text-white tracking-tight">{comp.nombre}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[12px] text-jjl-muted">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {fechaLabel}
            </span>
            {comp.lugar && (
              <span className="inline-flex items-center gap-1.5">
                · <MapPin className="h-3.5 w-3.5" />
                {comp.lugar}
              </span>
            )}
            {comp.modalidad && (
              <span className="inline-flex items-center gap-1.5">
                · <Shield className="h-3.5 w-3.5" />
                {comp.modalidad}
              </span>
            )}
          </div>
          {comp.categoria && (
            <p className="text-[12px] text-white/70 mt-1.5">{comp.categoria}</p>
          )}
        </div>
        <div className="flex items-start gap-2">
          <span
            className={`inline-flex items-center h-6 px-2 rounded-md border text-[10px] font-bold uppercase tracking-wider ${IMPORTANCIA_TONE[comp.importancia]}`}
          >
            {IMPORTANCIA_LABEL[comp.importancia]}
          </span>
          <button
            onClick={onEdit}
            aria-label="Editar"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-jjl-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      {phase && (
        <div className="relative mt-5 p-4 rounded-xl bg-black/30 border border-jjl-border/60">
          <div className="flex items-center gap-2 mb-1.5">
            <Target className="h-4 w-4 text-jjl-red" strokeWidth={2.2} />
            <p className="text-[11px] uppercase tracking-[0.14em] text-jjl-red font-bold">
              Fase actual
            </p>
            <span className="text-[13px] font-bold text-white">{phase.label}</span>
          </div>
          <p className="text-[13px] text-jjl-muted leading-relaxed">{phase.focus}</p>
        </div>
      )}

      {comp.notas && (
        <p className="relative text-[12px] text-jjl-muted mt-3 whitespace-pre-wrap leading-relaxed">
          {comp.notas}
        </p>
      )}
    </Card>
  );
}

function CompetitionRow({
  comp,
  isPast,
  onEdit,
  onDelete,
}: {
  comp: Competition;
  isPast?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const daysUntil = differenceInCalendarDays(parseISO(comp.fecha), new Date());

  return (
    <div className="rounded-xl border border-jjl-border bg-white/[0.02] overflow-hidden transition-colors hover:bg-white/[0.035]">
      <div className="flex items-center gap-3 p-3">
        <div
          className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ring-1 ${
            isPast
              ? 'bg-white/5 ring-white/10 text-jjl-muted'
              : 'bg-jjl-red/10 ring-jjl-red/25 text-jjl-red'
          }`}
        >
          <Trophy className="h-4 w-4" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-white truncate">
              {comp.nombre}
            </span>
            <span
              className={`inline-flex items-center h-5 px-1.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${IMPORTANCIA_TONE[comp.importancia]}`}
            >
              {IMPORTANCIA_LABEL[comp.importancia]}
            </span>
          </div>
          <p className="text-[11px] text-jjl-muted mt-0.5 capitalize">
            {format(parseISO(comp.fecha), "EEE d 'de' MMM yyyy", { locale: es })}
            {comp.lugar ? ` · ${comp.lugar}` : ''}
            {!isPast && daysUntil >= 0
              ? daysUntil === 0
                ? ' · hoy'
                : ` · en ${daysUntil} dias`
              : ''}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          aria-label="Detalles"
          className="h-8 w-8 flex items-center justify-center rounded-lg text-jjl-muted hover:text-white hover:bg-white/5 transition-colors"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-jjl-border/40 pt-3 animate-slide-down">
          {comp.categoria && (
            <p className="text-[12px] text-white/80">
              <span className="text-[10px] uppercase tracking-wider text-jjl-muted font-semibold mr-2">
                Categoria
              </span>
              {comp.categoria}
            </p>
          )}
          {comp.modalidad && (
            <p className="text-[12px] text-white/80">
              <span className="text-[10px] uppercase tracking-wider text-jjl-muted font-semibold mr-2">
                Modalidad
              </span>
              {comp.modalidad}
            </p>
          )}
          {comp.resultado && (
            <p className="text-[12px] text-white whitespace-pre-wrap">
              <span className="text-[10px] uppercase tracking-wider text-jjl-muted font-semibold mr-2">
                Resultado
              </span>
              {comp.resultado}
            </p>
          )}
          {comp.notas && (
            <p className="text-[12px] text-jjl-muted whitespace-pre-wrap leading-relaxed">
              {comp.notas}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-jjl-border text-[12px] font-semibold text-jjl-muted hover:text-white hover:border-jjl-border-strong transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-500/30 text-[12px] font-semibold text-red-400 hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CompetitionForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Competition | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [fecha, setFecha] = useState(initial?.fecha ?? '');
  const [lugar, setLugar] = useState(initial?.lugar ?? '');
  const [categoria, setCategoria] = useState(initial?.categoria ?? '');
  const [modalidad, setModalidad] = useState(initial?.modalidad ?? '');
  const [importancia, setImportancia] = useState<Competition['importancia']>(
    initial?.importancia ?? 'normal'
  );
  const [resultado, setResultado] = useState(initial?.resultado ?? '');
  const [notas, setNotas] = useState(initial?.notas ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !fecha) {
      toast.error('Nombre y fecha son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initial?.id,
          nombre,
          fecha,
          lugar: lugar || null,
          categoria: categoria || null,
          modalidad: modalidad || null,
          importancia,
          resultado: resultado || null,
          notas: notas || null,
        }),
      });
      if (res.ok) {
        toast.success(initial ? 'Competencia actualizada' : 'Competencia guardada');
        onSaved();
      } else {
        const body = await res.json();
        toast.error(body.error || 'No pudimos guardar');
      }
    } catch (err) {
      logger.error('competitions.save.failed', { err });
      toast.error('Error de conexion');
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="max-w-lg w-full bg-jjl-gray border border-jjl-border rounded-2xl p-6 shadow-2xl animate-scale-in my-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-bold text-white">
            {initial ? 'Editar competencia' : 'Nueva competencia'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-jjl-muted hover:text-white hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Nombre del torneo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Panamericano IBJJF 2026"
            required
            autoFocus
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              type="date"
              label="Fecha"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
            <Input
              label="Lugar"
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="Buenos Aires"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Adulto azul medio pesado"
            />
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-jjl-muted mb-1.5">
                Modalidad
              </label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value)}
                className="w-full h-[42px] px-3 bg-white/[0.03] text-white text-sm rounded-lg border border-jjl-border hover:border-jjl-border-strong focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
              >
                <option value="">—</option>
                <option value="Gi">Gi</option>
                <option value="No-Gi">No-Gi</option>
                <option value="Gi + No-Gi">Gi + No-Gi</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-jjl-muted mb-1.5">
              Importancia
            </label>
            <div className="flex gap-2">
              {(['baja', 'normal', 'alta'] as const).map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setImportancia(v)}
                  className={`flex-1 h-10 rounded-lg border text-[13px] font-semibold transition-all ${
                    importancia === v
                      ? IMPORTANCIA_TONE[v] + ' border-2'
                      : 'border-jjl-border text-jjl-muted bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  {IMPORTANCIA_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-jjl-muted mb-1.5">
              Resultado
            </span>
            <textarea
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              rows={2}
              placeholder="Ej: Oro, plata, bronce, 2-1, etc."
              className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-jjl-muted mb-1.5">
              Notas
            </span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Plan de peso, rivales esperados, objetivos puntuales..."
              className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
            />
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} fullWidth>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={saving} fullWidth>
              <Save className="h-4 w-4" />
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive,
  loading,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="max-w-sm w-full bg-jjl-gray border border-jjl-border rounded-2xl p-6 shadow-2xl animate-scale-in">
        <h3 className="text-[16px] font-bold text-white">{title}</h3>
        <p className="text-[13px] text-jjl-muted mt-2 leading-relaxed">{description}</p>
        <div className="flex gap-2 mt-5">
          <Button variant="secondary" size="md" onClick={onCancel} fullWidth>
            Cancelar
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
            loading={loading}
            fullWidth
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
