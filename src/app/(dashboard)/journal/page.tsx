'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { format, startOfWeek, endOfWeek, differenceInCalendarDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Save,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Target,
  ShieldAlert,
  ChevronDown,
  Search,
  Sparkles,
  Activity,
  NotebookPen,
  Link as LinkIcon,
  TrendingUp,
  Pencil,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import EntryField from '@/components/journal/EntryField';
import { fetcher } from '@/lib/fetcher';
import { logger } from '@/lib/logger';
import { useToast } from '@/components/ui/Toast';

interface JournalEntry {
  entreno_check: boolean;
  fatiga: 'verde' | 'amarillo' | 'rojo' | null;
  intensidad: 'baja' | 'media' | 'alta' | null;
  objetivo: string;
  objetivo_cumplido: boolean | null;
  regla: string;
  regla_cumplida: boolean | null;
  puntaje: number | null;
  observaciones: string;
  aprendizajes: string;
  notas: string;
  meta_entreno: string;
}

interface HistoryEntry {
  fecha: string;
  entreno_check: boolean;
  fatiga: string | null;
  intensidad: string | null;
  objetivo: string | null;
  objetivo_cumplido: boolean | null;
  regla: string | null;
  regla_cumplida: boolean | null;
  puntaje: number | null;
  observaciones: string | null;
  aprendizajes: string | null;
  notas: string | null;
  meta_entreno: string | null;
}

interface WeeklyFocus {
  week: { from: string; to: string };
  objetivo: string | null;
  regla: string | null;
  meta_entreno: string | null;
}

const EMPTY_ENTRY: JournalEntry = {
  entreno_check: false,
  fatiga: null,
  intensidad: null,
  objetivo: '',
  objetivo_cumplido: null,
  regla: '',
  regla_cumplida: null,
  puntaje: null,
  observaciones: '',
  aprendizajes: '',
  notas: '',
  meta_entreno: '',
};

const FATIGA_OPTIONS = [
  {
    value: 'verde',
    label: 'Bien',
    dotClass: 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]',
    desc: 'Recuperado, con energia',
  },
  {
    value: 'amarillo',
    label: 'Normal',
    dotClass: 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.55)]',
    desc: 'Cansancio controlable',
  },
  {
    value: 'rojo',
    label: 'Cansado',
    dotClass: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.55)]',
    desc: 'Muy cargado, molestias',
  },
] as const;

const FATIGA_DOT_CLASS: Record<string, string> = {
  verde: 'bg-green-500',
  amarillo: 'bg-yellow-500',
  rojo: 'bg-red-500',
};

const INTENSIDAD_OPTIONS = [
  { value: 'baja', label: 'Baja', color: 'text-green-400 border-green-500/40 bg-green-500/10' },
  { value: 'media', label: 'Media', color: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10' },
  { value: 'alta', label: 'Alta', color: 'text-red-400 border-red-500/40 bg-red-500/10' },
] as const;

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderLinkified(text: string | null | undefined) {
  if (!text) return null;
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

function averagePuntaje(history: HistoryEntry[], days: number): number | null {
  const cutoff = differenceInCalendarDays(new Date(), new Date()) - days;
  void cutoff;
  const today = new Date();
  const values = history
    .filter((h) => {
      if (h.puntaje == null) return false;
      const diff = differenceInCalendarDays(today, parseISO(h.fecha));
      return diff >= 0 && diff < days;
    })
    .map((h) => h.puntaje as number);
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

function weekLabel(fecha: string) {
  const d = new Date(fecha + 'T12:00:00');
  const from = startOfWeek(d, { weekStartsOn: 1 });
  const to = endOfWeek(d, { weekStartsOn: 1 });
  const sameMonth = from.getMonth() === to.getMonth();
  const fromStr = format(from, sameMonth ? 'd' : 'd MMM', { locale: es });
  const toStr = format(to, 'd MMM', { locale: es });
  return `${fromStr} — ${toStr}`;
}

export default function JournalPage() {
  // Accept ?fecha=YYYY-MM-DD from calendar clicks
  const initialFecha = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('fecha') || format(new Date(), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd');
  const [fecha, setFecha] = useState(initialFecha);
  const [entry, setEntry] = useState<JournalEntry>(EMPTY_ENTRY);
  const [saving, setSaving] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const isToday = fecha === format(new Date(), 'yyyy-MM-dd');

  const entryKey = `/api/daily-task?fecha=${fecha}`;
  const historyKey = `/api/daily-task?history=true${
    debouncedQuery ? `&q=${encodeURIComponent(debouncedQuery)}` : ''
  }`;
  const weeklyKey = `/api/daily-task?weekly=${fecha}`;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const { data: entryData, isLoading: entryLoading } = useSWR<{ entry: Partial<HistoryEntry> | null }>(
    entryKey,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const { data: historyData } = useSWR<{ history: HistoryEntry[] }>(historyKey, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });

  const { data: weeklyFocus } = useSWR<WeeklyFocus>(weeklyKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const history = historyData?.history || [];
  const loading = entryLoading && !entryData;

  // Hydrate the editable form from the server entry.
  useEffect(() => {
    const data = entryData?.entry;
    if (!data) {
      setEntry(EMPTY_ENTRY);
      return;
    }
    setEntry({
      entreno_check: data.entreno_check ?? false,
      fatiga: (data.fatiga as JournalEntry['fatiga']) ?? null,
      intensidad: (data.intensidad as JournalEntry['intensidad']) ?? null,
      objetivo: data.objetivo ?? '',
      objetivo_cumplido: data.objetivo_cumplido ?? null,
      regla: data.regla ?? '',
      regla_cumplida: data.regla_cumplida ?? null,
      puntaje: data.puntaje ?? null,
      observaciones: data.observaciones ?? '',
      aprendizajes: data.aprendizajes ?? '',
      notas: data.notas ?? '',
      meta_entreno: data.meta_entreno ?? '',
    });
  }, [entryData]);

  // When the current day has empty weekly/long-term fields, prefill from the
  // most-recent same-week / most-recent-ever row so editing feels continuous.
  useEffect(() => {
    if (!weeklyFocus || !entryData?.entry) return;
    const curr = entryData.entry;
    setEntry((prev) => ({
      ...prev,
      objetivo: curr.objetivo ?? weeklyFocus.objetivo ?? prev.objetivo,
      regla: curr.regla ?? weeklyFocus.regla ?? prev.regla,
      meta_entreno: curr.meta_entreno ?? weeklyFocus.meta_entreno ?? prev.meta_entreno,
    }));
  }, [weeklyFocus, entryData]);

  async function handleSave() {
    setSaving(true);
    try {
      // The 3 persistent text fields (aprendizajes, observaciones, notas)
      // now live in the journal_entries table and save themselves per-entry.
      // Guardar diario only commits the structured daily fields.
      const res = await fetch('/api/daily-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'journal', fecha, ...entry }),
      });
      if (res.ok) {
        mutate(entryKey);
        mutate(weeklyKey);
        mutate((k: string) => typeof k === 'string' && k.startsWith('/api/daily-task?history'));
        toast.success('Diario guardado');
      } else {
        logger.error('journal.save.badStatus', { status: res.status, fecha });
        toast.error('No pudimos guardar el diario');
      }
    } catch (err) {
      logger.error('journal.save.failed', { err, fecha });
      toast.error('Error de conexion');
    }
    setSaving(false);
  }

  function update<K extends keyof JournalEntry>(field: K, value: JournalEntry[K]) {
    setEntry((prev) => ({ ...prev, [field]: value }));
  }

  function goDay(offset: number) {
    const d = new Date(fecha + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    const newDate = format(d, 'yyyy-MM-dd');
    if (newDate <= format(new Date(), 'yyyy-MM-dd')) {
      setFecha(newDate);
    }
  }

  const avg15 = useMemo(() => averagePuntaje(history, 15), [history]);
  const avg30 = useMemo(() => averagePuntaje(history, 30), [history]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto animate-pulse">
        <div className="skeleton h-14 rounded-xl" />
        <div className="skeleton h-36 rounded-xl" />
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-44 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-12">
      {/* Date nav */}
      <div className="flex items-center justify-between gap-2 bg-white/[0.02] border border-jjl-border rounded-xl px-2 py-1.5">
        <button
          onClick={() => goDay(-1)}
          aria-label="Dia anterior"
          className="h-9 w-9 flex items-center justify-center rounded-lg text-jjl-muted hover:text-white hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-jjl-muted/70 font-semibold">
            {isToday ? 'Hoy' : 'Diario del dia'}
          </p>
          <p className="text-[14px] font-bold text-white capitalize truncate">
            {format(new Date(fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
          </p>
        </div>
        <button
          onClick={() => goDay(1)}
          disabled={isToday}
          aria-label="Dia siguiente"
          className="h-9 w-9 flex items-center justify-center rounded-lg text-jjl-muted hover:text-white hover:bg-white/5 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* =====================================================================
          1. FOCO SEMANAL — objetivo + regla (primero y bien arriba)
          =================================================================== */}
      <section className="space-y-3">
        <SectionHeading
          icon={Target}
          title="Foco de la semana"
          subtitle={`Visible toda la semana · ${weekLabel(fecha)}`}
        />

        <FocoCard
          tone="blue"
          icon={Target}
          label="Que voy a practicar en la lucha"
          value={entry.objetivo}
          onChange={(v) => update('objetivo', v)}
          cumplido={entry.objetivo_cumplido}
          onCumplido={(v) => update('objetivo_cumplido', v)}
          cumplidoLabel="Cumpliste?"
          placeholder="Ej: Mejorar timing en pasadas de guardia"
        />

        <FocoCard
          tone="orange"
          icon={ShieldAlert}
          label="Que NO voy a hacer"
          value={entry.regla}
          onChange={(v) => update('regla', v)}
          cumplido={entry.regla_cumplida}
          onCumplido={(v) => update('regla_cumplida', v)}
          cumplidoLabel="Cumpliste la regla?"
          placeholder="Ej: No voy a hacer rondas sin foco"
        />
      </section>

      {/* =====================================================================
          2. CHECK-IN DEL DIA — metricas cuantitativas
          =================================================================== */}
      <section className="space-y-3">
        <SectionHeading
          icon={Activity}
          title="Check-in"
          subtitle="Registra como paso el entrenamiento"
        />

        {/* Entreno? */}
        <Card>
          <button
            onClick={() => update('entreno_check', !entry.entreno_check)}
            className="w-full flex items-center gap-4 text-left"
          >
            <div
              className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ring-1 ${
                entry.entreno_check
                  ? 'bg-green-500/15 ring-green-500/30 text-green-400'
                  : 'bg-white/5 ring-jjl-border text-jjl-muted'
              }`}
            >
              {entry.entreno_check ? (
                <CheckCircle className="h-6 w-6" />
              ) : (
                <div className="h-5 w-5 rounded-full border-2 border-current" />
              )}
            </div>
            <div>
              <p className="font-bold text-[15px] text-white">Entrene hoy?</p>
              <p className="text-[13px] text-jjl-muted">
                {entry.entreno_check ? 'Si — registrado' : 'Toca para marcar'}
              </p>
            </div>
          </button>
        </Card>

        {/* Fatiga */}
        <Card>
          <h3 className="text-[13px] font-semibold text-white mb-3">
            Como te sentis fisicamente?
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {FATIGA_OPTIONS.map((opt) => {
              const active = entry.fatiga === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => update('fatiga', active ? null : opt.value)}
                  className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border transition-all ${
                    active
                      ? 'border-jjl-red bg-jjl-red/10 -translate-y-0.5'
                      : 'border-jjl-border hover:border-jjl-border-strong bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <span
                    className={`h-3 w-3 rounded-full ${opt.dotClass} ${
                      active ? 'scale-110' : 'opacity-70'
                    } transition-transform`}
                  />
                  <span className="text-[13px] font-semibold text-white">{opt.label}</span>
                  <span className="text-[10px] text-jjl-muted leading-tight text-center">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Intensidad + Puntaje en una sola fila */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <h3 className="text-[13px] font-semibold text-white mb-3">Intensidad</h3>
            <div className="flex gap-2">
              {INTENSIDAD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    update('intensidad', entry.intensidad === opt.value ? null : opt.value)
                  }
                  className={`flex-1 h-10 rounded-lg border text-[13px] font-semibold transition-all ${
                    entry.intensidad === opt.value
                      ? opt.color + ' border-2'
                      : 'border-jjl-border text-jjl-muted bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-semibold text-white">Puntaje del dia</h3>
              <span
                className={`text-[11px] font-bold tabular-nums ${
                  (entry.puntaje ?? 0) >= 7
                    ? 'text-green-400'
                    : (entry.puntaje ?? 0) >= 4
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }`}
              >
                {entry.puntaje ?? '-'}/10
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={entry.puntaje ?? 5}
              onChange={(e) => update('puntaje', parseInt(e.target.value))}
              className="w-full accent-jjl-red h-1.5"
            />
            <div className="flex justify-between text-[10px] text-jjl-muted mt-1">
              <span>Malo</span>
              <span>Excelente</span>
            </div>
          </Card>
        </div>
      </section>

      {/* =====================================================================
          3. META DE ENTRENAMIENTO — largo plazo
          =================================================================== */}
      <section className="space-y-3">
        <SectionHeading
          icon={TrendingUp}
          title="Que queres entrenar"
          subtitle="Meta mas abarcadora · editable en cualquier dia"
        />
        <Card>
          <textarea
            value={entry.meta_entreno}
            onChange={(e) => update('meta_entreno', e.target.value)}
            placeholder="Ej: Solidificar mi guardia cerrada. Escapes de 100kg. Pases de guardia contra cinturones mayores..."
            rows={3}
            className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
          />
        </Card>
      </section>

      {/* =====================================================================
          4. REFLEXION — aprendizajes / observaciones / notas+links
          =================================================================== */}
      <section className="space-y-3">
        <SectionHeading
          icon={Sparkles}
          title="Reflexion del dia"
          subtitle="Cada nota se guarda sola cuando la agregas — sin pisar las anteriores"
        />

        <EntryField
          kind="aprendizaje"
          fecha={fecha}
          label="Aprendizajes de hoy"
          placeholder="Insights de las luchas, detalles tecnicos, patrones que notaste..."
          iconTone="bg-yellow-500/10 ring-yellow-500/25 text-yellow-400"
          icon={Sparkles}
          addLabel="Agregar aprendizaje"
        />

        <EntryField
          kind="observacion"
          fecha={fecha}
          label="Observaciones"
          placeholder="Problemas, logros, lo que quieras anotar"
          iconTone="bg-white/5 ring-white/15 text-jjl-muted"
          icon={NotebookPen}
          addLabel="Agregar observacion"
        />

        <EntryField
          kind="nota"
          fecha={fecha}
          label="Notas + links"
          placeholder={'Recursos, videos, ideas — pega URLs y se convierten en links'}
          iconTone="bg-jjl-red/10 ring-jjl-red/25 text-jjl-red"
          icon={LinkIcon}
          renderText={(t) => renderLinkified(t)}
          addLabel="Agregar nota"
        />
      </section>

      {/* Save */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleSave}
        loading={saving}
        disabled={saving}
      >
        <Save className="h-4 w-4" />
        Guardar diario
      </Button>

      {/* =====================================================================
          5. METRICAS — promedio puntaje 15 y 30 dias
          =================================================================== */}
      <section className="space-y-3 pt-4">
        <SectionHeading
          icon={TrendingUp}
          title="Como vas"
          subtitle="Promedios para medir tu entrenamiento"
        />
        <div className="grid grid-cols-2 gap-3">
          <PuntajeCard label="Ultimos 15 dias" value={avg15} />
          <PuntajeCard label="Ultimos 30 dias" value={avg30} />
        </div>
      </section>

      {/* =====================================================================
          6. HISTORIAL — search + expand
          =================================================================== */}
      <section className="space-y-3 pt-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <SectionHeading
            icon={NotebookPen}
            title="Historial"
            subtitle="Hasta 120 dias · busca en aprendizajes, notas, observaciones"
          />
          <a
            href="/exportar/diario"
            className="inline-flex items-center gap-1.5 h-8 px-3 bg-white/[0.03] border border-jjl-border hover:border-jjl-border-strong hover:text-white text-jjl-muted rounded-lg text-[12px] font-semibold transition-colors"
          >
            Exportar PDF
          </a>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-jjl-muted pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el diario..."
            className="w-full h-10 pl-10 pr-4 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
          />
        </div>

        {history.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title={query ? 'Sin resultados' : 'Tu historial va a aparecer aca'}
            description={
              query
                ? 'Probá con otras palabras o borra la busqueda.'
                : 'Las entradas que guardes se mantienen 120 dias para revisar cuando quieras.'
            }
            className="py-10"
          />
        ) : (
          <div className="space-y-2">
            {history.map((h) => {
              const isExpanded = expandedDay === h.fecha;
              const isSelected = h.fecha === fecha;
              const hasDetail = !!(h.objetivo || h.regla || h.aprendizajes || h.observaciones || h.notas || h.meta_entreno);
              return (
                <div
                  key={h.fecha}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    isSelected
                      ? 'border-jjl-red/40 bg-jjl-red/5'
                      : 'border-jjl-border bg-white/[0.02]'
                  }`}
                >
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : h.fecha)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <span
                      aria-hidden
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        h.fatiga ? FATIGA_DOT_CLASS[h.fatiga] || 'bg-white/20' : 'bg-white/15'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white capitalize">
                        {format(new Date(h.fecha + 'T12:00:00'), "EEE d 'de' MMM", { locale: es })}
                      </p>
                      <p className="text-[11px] text-jjl-muted mt-0.5">
                        {h.entreno_check ? 'Entreno' : 'No entreno'}
                        {h.intensidad ? ` · ${h.intensidad}` : ''}
                        {h.aprendizajes ? ' · con reflexion' : ''}
                      </p>
                    </div>
                    {h.puntaje != null && (
                      <span
                        className={`text-[12px] font-bold px-2 py-0.5 rounded tabular-nums ${
                          h.puntaje >= 7
                            ? 'text-green-400'
                            : h.puntaje >= 4
                              ? 'text-yellow-400'
                              : 'text-red-400'
                        }`}
                      >
                        {h.puntaje}/10
                      </span>
                    )}
                    <ChevronDown
                      className={`h-4 w-4 text-jjl-muted shrink-0 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-jjl-border/40 pt-3 animate-slide-down">
                      {!hasDetail && (
                        <p className="text-[12px] text-jjl-muted italic">
                          Sin detalles registrados este dia.
                        </p>
                      )}
                      {h.objetivo && (
                        <DetailRow
                          icon={Target}
                          tone="blue"
                          label="Objetivo"
                          value={h.objetivo}
                          status={
                            h.objetivo_cumplido === true
                              ? 'Cumplido'
                              : h.objetivo_cumplido === false
                                ? 'No cumplido'
                                : null
                          }
                        />
                      )}
                      {h.regla && (
                        <DetailRow
                          icon={ShieldAlert}
                          tone="orange"
                          label="Regla"
                          value={h.regla}
                          status={
                            h.regla_cumplida === true
                              ? 'Cumplida'
                              : h.regla_cumplida === false
                                ? 'No cumplida'
                                : null
                          }
                        />
                      )}
                      {h.meta_entreno && (
                        <DetailRow
                          icon={TrendingUp}
                          tone="purple"
                          label="Meta"
                          value={h.meta_entreno}
                        />
                      )}
                      {h.aprendizajes && (
                        <DetailRow
                          icon={Sparkles}
                          tone="yellow"
                          label="Aprendizajes"
                          value={h.aprendizajes}
                        />
                      )}
                      {h.observaciones && (
                        <DetailRow
                          icon={NotebookPen}
                          tone="neutral"
                          label="Observaciones"
                          value={h.observaciones}
                        />
                      )}
                      {h.notas && (
                        <DetailRow
                          icon={LinkIcon}
                          tone="red"
                          label="Notas"
                          value={h.notas}
                          linkify
                        />
                      )}
                      <button
                        onClick={() => setFecha(h.fecha)}
                        className="text-[11px] text-jjl-red hover:text-jjl-red-hover font-semibold mt-2"
                      >
                        Abrir este dia
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * FocoCard — shows the weekly focus (objetivo / regla) prominently and
 * readable when it has content, with an 'Editar' toggle that swaps to a
 * textarea for edits. Empty state goes straight to the editor.
 */
function FocoCard({
  tone,
  icon: Icon,
  label,
  value,
  onChange,
  cumplido,
  onCumplido,
  cumplidoLabel,
  placeholder,
}: {
  tone: 'blue' | 'orange';
  icon: typeof Target;
  label: string;
  value: string;
  onChange: (v: string) => void;
  cumplido: boolean | null;
  onCumplido: (v: boolean | null) => void;
  cumplidoLabel: string;
  placeholder: string;
}) {
  const hasValue = value.trim().length > 0;
  const [editing, setEditing] = useState(!hasValue);

  const iconTone =
    tone === 'blue'
      ? 'bg-blue-500/10 ring-blue-500/25 text-blue-400'
      : 'bg-orange-500/10 ring-orange-500/25 text-orange-400';
  const accentBorder =
    tone === 'blue' ? 'border-blue-500/30' : 'border-orange-500/30';
  const accentBg = tone === 'blue' ? 'bg-blue-500/[0.05]' : 'bg-orange-500/[0.05]';

  return (
    <Card className={hasValue && !editing ? `${accentBorder} ${accentBg}` : ''}>
      <div className="flex items-start gap-3">
        <div
          className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ring-1 ${iconTone}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-jjl-muted">
              {label}
            </span>
            {hasValue && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-[11px] text-jjl-red hover:text-jjl-red-hover font-semibold inline-flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                Editar
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={2}
                className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[14px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
                autoFocus={hasValue}
              />
              {hasValue && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-[11px] text-jjl-muted hover:text-white font-semibold"
                >
                  Listo
                </button>
              )}
            </div>
          ) : (
            <p className="text-[17px] font-semibold text-white leading-snug whitespace-pre-wrap text-balance">
              {value}
            </p>
          )}

          {hasValue && (
            <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-white/5">
              <span className="text-[11px] text-jjl-muted">{cumplidoLabel}</span>
              <YesNo value={cumplido} onChange={onCumplido} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function SavedBlock({ value, linkify }: { value: string; linkify?: boolean }) {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  return (
    <div className="mb-2 rounded-lg bg-black/25 border border-jjl-border/60 px-3 py-2.5 text-[12px] text-jjl-muted/90 whitespace-pre-wrap leading-relaxed">
      <p className="text-[9px] uppercase tracking-[0.14em] text-jjl-muted/60 font-bold mb-1">
        Lo que ya escribiste hoy
      </p>
      {linkify ? renderLinkified(trimmed) : trimmed}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Target;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <Icon className="h-4 w-4 text-jjl-red" strokeWidth={2.2} />
      <div>
        <h2 className="text-[15px] font-bold text-white leading-none">{title}</h2>
        {subtitle && <p className="text-[11px] text-jjl-muted mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function YesNo({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          onClick={() => onChange(value === v ? null : v)}
          className={`h-7 px-3 rounded-md text-[12px] font-semibold border transition-colors ${
            value === v
              ? v
                ? 'bg-green-500/20 border-green-500/40 text-green-400'
                : 'bg-red-500/20 border-red-500/40 text-red-400'
              : 'border-jjl-border text-jjl-muted hover:border-jjl-border-strong'
          }`}
        >
          {v ? 'Si' : 'No'}
        </button>
      ))}
    </div>
  );
}

function PuntajeCard({ label, value }: { label: string; value: number | null }) {
  const tone =
    value == null
      ? 'text-jjl-muted'
      : value >= 7
        ? 'text-green-400'
        : value >= 4
          ? 'text-yellow-400'
          : 'text-red-400';
  return (
    <Card>
      <p className="text-[10px] uppercase tracking-[0.14em] text-jjl-muted font-semibold">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-[30px] font-black tabular-nums leading-none ${tone}`}>
          {value == null ? '--' : value.toFixed(1)}
        </span>
        <span className="text-[11px] text-jjl-muted">/10</span>
      </div>
    </Card>
  );
}

const TONE_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500/10 ring-blue-500/25 text-blue-400',
  orange: 'bg-orange-500/10 ring-orange-500/25 text-orange-400',
  purple: 'bg-purple-500/10 ring-purple-500/25 text-purple-400',
  yellow: 'bg-yellow-500/10 ring-yellow-500/25 text-yellow-400',
  red: 'bg-jjl-red/10 ring-jjl-red/25 text-jjl-red',
  neutral: 'bg-white/5 ring-white/10 text-jjl-muted',
};

function DetailRow({
  icon: Icon,
  tone,
  label,
  value,
  status,
  linkify,
}: {
  icon: typeof Target;
  tone: keyof typeof TONE_CLASSES;
  label: string;
  value: string;
  status?: string | null;
  linkify?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={`h-7 w-7 rounded-md flex items-center justify-center ring-1 shrink-0 ${TONE_CLASSES[tone]}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-jjl-muted uppercase tracking-wider font-semibold">
            {label}
          </p>
          {status && (
            <span
              className={`text-[10px] font-bold ${
                status.includes('No') ? 'text-red-400' : 'text-green-400'
              }`}
            >
              {status}
            </span>
          )}
        </div>
        <p className="text-[13px] text-white whitespace-pre-wrap leading-relaxed mt-1">
          {linkify ? renderLinkified(value) : value}
        </p>
      </div>
    </div>
  );
}
