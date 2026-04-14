'use client';

import { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Save, CheckCircle, ChevronLeft, ChevronRight, Target, ShieldAlert, ChevronDown, Eye } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
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

export default function JournalPage() {
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entry, setEntry] = useState<JournalEntry>(EMPTY_ENTRY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const isToday = fecha === format(new Date(), 'yyyy-MM-dd');

  const entryKey = `/api/daily-task?fecha=${fecha}`;
  const historyKey = '/api/daily-task?history=true';

  const { data: entryData, isLoading: entryLoading } = useSWR<{ entry: Partial<HistoryEntry> | null }>(
    entryKey,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const { data: historyData } = useSWR<{ history: HistoryEntry[] }>(
    historyKey,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 60_000 }
  );

  const history = historyData?.history || [];
  const loading = entryLoading && !entryData;

  useEffect(() => {
    const data = entryData?.entry;
    setSaved(false);
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
    });
  }, [entryData]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/daily-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'journal', fecha, ...entry }),
      });
      if (res.ok) {
        setSaved(true);
        mutate(entryKey);
        mutate(historyKey);
        toast.success('Diario guardado');
        setTimeout(() => setSaved(false), 3000);
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
    setSaved(false);
  }

  function goDay(offset: number) {
    const d = new Date(fecha + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    const newDate = format(d, 'yyyy-MM-dd');
    if (newDate <= format(new Date(), 'yyyy-MM-dd')) {
      setFecha(newDate);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-lg mx-auto animate-pulse">
        <div className="h-12 bg-jjl-gray-light/50 rounded-xl" />
        <div className="h-40 bg-jjl-gray-light/50 rounded-xl" />
        <div className="h-32 bg-jjl-gray-light/50 rounded-xl" />
        <div className="h-32 bg-jjl-gray-light/50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-8">
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

      {/* Focus banner — shows today's objective & rule as reminder */}
      {isToday && (entry.objetivo.trim() || entry.regla.trim()) && (
        <div className="space-y-2">
          {entry.objetivo.trim() && (
            <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
              entry.objetivo_cumplido === true
                ? 'bg-green-500/10 border-green-500/30'
                : entry.objetivo_cumplido === false
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-blue-500/10 border-blue-500/30'
            }`}>
              <Target className="h-4 w-4 mt-0.5 shrink-0 text-blue-400" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-jjl-muted font-semibold">Objetivo de hoy</p>
                <p className="text-sm text-white mt-0.5">{entry.objetivo}</p>
              </div>
              {entry.objetivo_cumplido === true && <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />}
            </div>
          )}
          {entry.regla.trim() && (
            <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
              entry.regla_cumplida === true
                ? 'bg-green-500/10 border-green-500/30'
                : entry.regla_cumplida === false
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-orange-500/10 border-orange-500/30'
            }`}>
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-orange-400" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-jjl-muted font-semibold">No voy a hacer</p>
                <p className="text-sm text-white mt-0.5">{entry.regla}</p>
              </div>
              {entry.regla_cumplida === true && <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />}
            </div>
          )}
        </div>
      )}

      {/* 1. Entrene hoy? */}
      <Card>
        <button
          onClick={() => update('entreno_check', !entry.entreno_check)}
          className={`w-full flex items-center gap-4 p-1 rounded-lg transition-all ${
            entry.entreno_check ? '' : 'opacity-70'
          }`}
        >
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            entry.entreno_check ? 'bg-green-500/20' : 'bg-jjl-gray-light'
          }`}>
            {entry.entreno_check ? (
              <CheckCircle className="h-6 w-6 text-green-400" />
            ) : (
              <div className="h-6 w-6 rounded-full border-2 border-jjl-muted" />
            )}
          </div>
          <div className="text-left">
            <p className="font-bold text-lg">Entrene hoy?</p>
            <p className="text-sm text-jjl-muted">
              {entry.entreno_check ? 'Si! Registrado' : 'Toca para marcar'}
            </p>
          </div>
        </button>
      </Card>

      {/* 2. Fatiga */}
      <Card>
        <h3 className="font-semibold text-[15px] mb-3">Como te sentis fisicamente?</h3>
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

      {/* 3. Intensidad */}
      <Card>
        <h3 className="font-semibold mb-3">Intensidad planeada</h3>
        <div className="flex gap-2">
          {INTENSIDAD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update('intensidad', entry.intensidad === opt.value ? null : opt.value)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                entry.intensidad === opt.value
                  ? opt.color + ' border-2'
                  : 'border-jjl-border text-jjl-muted bg-jjl-gray-light/30 hover:bg-jjl-gray-light/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {/* 4. Objetivo */}
      <Card>
        <h3 className="font-semibold mb-1">Objetivo del entrenamiento</h3>
        <p className="text-xs text-jjl-muted mb-3">Que queres trabajar hoy puntualmente?</p>
        <textarea
          value={entry.objetivo}
          onChange={(e) => update('objetivo', e.target.value)}
          placeholder="Ej: Mejorar timing en pasadas de guardia..."
          rows={2}
          className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red resize-none"
        />
        {entry.objetivo.trim() && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-jjl-muted">Cumpliste el objetivo?</span>
            <div className="flex gap-2">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  onClick={() => update('objetivo_cumplido', entry.objetivo_cumplido === val ? null : val)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    entry.objetivo_cumplido === val
                      ? val
                        ? 'bg-green-500/20 border-green-500/40 text-green-400'
                        : 'bg-red-500/20 border-red-500/40 text-red-400'
                      : 'border-jjl-border text-jjl-muted'
                  }`}
                >
                  {val ? 'Si' : 'No'}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 5. Regla del dia */}
      <Card>
        <h3 className="font-semibold mb-1">Regla del dia</h3>
        <p className="text-xs text-jjl-muted mb-3">Que NO vas a hacer hoy?</p>
        <textarea
          value={entry.regla}
          onChange={(e) => update('regla', e.target.value)}
          placeholder="Ej: No voy a hacer rondas sin foco..."
          rows={2}
          className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red resize-none"
        />
        {entry.regla.trim() && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-jjl-muted">Cumpliste la regla?</span>
            <div className="flex gap-2">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  onClick={() => update('regla_cumplida', entry.regla_cumplida === val ? null : val)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    entry.regla_cumplida === val
                      ? val
                        ? 'bg-green-500/20 border-green-500/40 text-green-400'
                        : 'bg-red-500/20 border-red-500/40 text-red-400'
                      : 'border-jjl-border text-jjl-muted'
                  }`}
                >
                  {val ? 'Si' : 'No'}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 6. Puntaje */}
      <Card>
        <h3 className="font-semibold mb-3">Puntaje del dia</h3>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="10"
            value={entry.puntaje ?? 5}
            onChange={(e) => update('puntaje', parseInt(e.target.value))}
            className="flex-1 accent-jjl-red h-2"
          />
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 ${
            (entry.puntaje ?? 0) >= 7
              ? 'bg-green-500/20 text-green-400'
              : (entry.puntaje ?? 0) >= 4
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
          }`}>
            {entry.puntaje ?? '-'}
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-jjl-muted mt-1 px-1">
          <span>Malo</span>
          <span>Excelente</span>
        </div>
      </Card>

      {/* 7. Observaciones */}
      <Card>
        <h3 className="font-semibold mb-1">Observaciones</h3>
        <p className="text-xs text-jjl-muted mb-3">Problemas, logros, lo que quieras anotar</p>
        <textarea
          value={entry.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Notas del dia..."
          rows={3}
          className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red resize-none"
        />
      </Card>

      {/* Save button */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleSave}
        loading={saving}
        disabled={saving}
      >
        {saved ? (
          <>
            <CheckCircle className="h-5 w-5 mr-2" />
            Guardado!
          </>
        ) : (
          <>
            <Save className="h-5 w-5 mr-2" />
            Guardar Diario
          </>
        )}
      </Button>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Ultimos dias</h3>
          <div className="space-y-2">
            {history.map((h) => {
              const isExpanded = expandedDay === h.fecha;
              const isSelected = h.fecha === fecha;
              return (
                <div key={h.fecha} className={`rounded-lg border transition-all ${
                  isSelected ? 'border-jjl-red/30 bg-jjl-red/5' : 'border-jjl-border/30'
                }`}>
                  {/* Summary row */}
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : h.fecha)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <span
                      aria-hidden
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        h.fatiga
                          ? FATIGA_DOT_CLASS[h.fatiga] || 'bg-white/20'
                          : 'bg-white/15'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">
                        {format(new Date(h.fecha + 'T12:00:00'), "EEE d MMM", { locale: es })}
                      </p>
                      <p className="text-xs text-jjl-muted">
                        {h.entreno_check ? 'Entreno' : 'No entreno'}
                        {h.intensidad ? ` · ${h.intensidad}` : ''}
                      </p>
                    </div>
                    {h.puntaje && (
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                        h.puntaje >= 7 ? 'text-green-400' : h.puntaje >= 4 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {h.puntaje}/10
                      </span>
                    )}
                    <ChevronDown className={`h-4 w-4 text-jjl-muted shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-jjl-border/20 pt-2 ml-9">
                      {h.objetivo && (
                        <div className="flex items-start gap-2">
                          <Target className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-jjl-muted uppercase">Objetivo</p>
                            <p className="text-xs text-white">{h.objetivo}</p>
                            <p className={`text-[10px] mt-0.5 ${
                              h.objetivo_cumplido === true ? 'text-green-400' : h.objetivo_cumplido === false ? 'text-red-400' : 'text-jjl-muted'
                            }`}>
                              {h.objetivo_cumplido === true ? 'Cumplido' : h.objetivo_cumplido === false ? 'No cumplido' : 'Sin evaluar'}
                            </p>
                          </div>
                        </div>
                      )}
                      {h.regla && (
                        <div className="flex items-start gap-2">
                          <ShieldAlert className="h-3.5 w-3.5 mt-0.5 text-orange-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-jjl-muted uppercase">Regla</p>
                            <p className="text-xs text-white">{h.regla}</p>
                            <p className={`text-[10px] mt-0.5 ${
                              h.regla_cumplida === true ? 'text-green-400' : h.regla_cumplida === false ? 'text-red-400' : 'text-jjl-muted'
                            }`}>
                              {h.regla_cumplida === true ? 'Cumplida' : h.regla_cumplida === false ? 'No cumplida' : 'Sin evaluar'}
                            </p>
                          </div>
                        </div>
                      )}
                      {h.observaciones && (
                        <div className="flex items-start gap-2">
                          <Eye className="h-3.5 w-3.5 mt-0.5 text-jjl-muted shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-jjl-muted uppercase">Observaciones</p>
                            <p className="text-xs text-white">{h.observaciones}</p>
                          </div>
                        </div>
                      )}
                      {!h.objetivo && !h.regla && !h.observaciones && (
                        <p className="text-xs text-jjl-muted italic">Sin detalles registrados</p>
                      )}
                      <button
                        onClick={() => setFecha(h.fecha)}
                        className="text-xs text-jjl-red hover:text-jjl-red/80 mt-1"
                      >
                        Editar este dia
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
