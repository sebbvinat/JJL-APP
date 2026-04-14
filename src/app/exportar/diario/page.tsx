'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, Download, Calendar } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';

interface Entry {
  fecha: string;
  entreno_check: boolean;
  fatiga: string | null;
  intensidad: string | null;
  puntaje: number | null;
  objetivo: string | null;
  objetivo_cumplido: boolean | null;
  regla: string | null;
  regla_cumplida: boolean | null;
  meta_entreno: string | null;
  aprendizajes: string | null;
  observaciones: string | null;
  notas: string | null;
}

interface Response {
  profile: { nombre: string; cinturon_actual: string } | null;
  range: { from: string; to: string };
  /** Daily tasks rows in the range. Legacy name kept for compatibility. */
  entries: Entry[];
  /** New journal_entries rows indexed by fecha. */
  entriesByFecha?: Record<
    string,
    { aprendizajes: string[]; observaciones: string[]; notas: string[] }
  >;
}

const FATIGA_LABEL: Record<string, string> = {
  verde: 'Bien',
  amarillo: 'Normal',
  rojo: 'Cansado',
};

export default function JournalExportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-jjl-muted text-sm">Cargando...</p>
        </div>
      }
    >
      <ExportView />
    </Suspense>
  );
}

function ExportView() {
  const searchParams = useSearchParams();
  const today = new Date();
  const defaultFrom = format(subDays(today, 90), 'yyyy-MM-dd');
  const defaultTo = format(today, 'yyyy-MM-dd');
  const [from, setFrom] = useState(searchParams.get('from') || defaultFrom);
  const [to, setTo] = useState(searchParams.get('to') || defaultTo);
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const autoPrint = searchParams.get('print') === '1';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher<Response>(`/api/journal/export?from=${from}&to=${to}`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
          if (autoPrint) {
            // Wait a tick so fonts/layout settle.
            setTimeout(() => window.print(), 400);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, autoPrint]);

  const stats = useMemo(() => {
    if (!data) return null;
    const entries = data.entries;
    const trained = entries.filter((e) => e.entreno_check).length;
    const puntajes = entries.filter((e) => e.puntaje != null).map((e) => e.puntaje as number);
    const avg =
      puntajes.length > 0
        ? Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 10) / 10
        : null;
    const withReflection = entries.filter((e) => e.aprendizajes || e.observaciones).length;
    return { trained, avg, withReflection, total: entries.length };
  }, [data]);

  return (
    <>
      {/* Screen-only controls (hidden when printing) */}
      <div className="no-print sticky top-0 z-50 bg-jjl-dark border-b border-jjl-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-[12px] text-jjl-muted">
              <Calendar className="h-3.5 w-3.5" />
              Desde
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-8 px-2 bg-jjl-gray border border-jjl-border rounded-md text-[12px] text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-[12px] text-jjl-muted">
              Hasta
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-8 px-2 bg-jjl-gray border border-jjl-border rounded-md text-[12px] text-white"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 h-9 px-4 bg-jjl-red hover:bg-jjl-red-hover text-white text-[13px] font-semibold rounded-lg transition-colors"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
          </div>
        </div>
        <p className="max-w-4xl mx-auto mt-2 text-[11px] text-jjl-muted/70">
          Tip: al imprimir, elegi &quot;Guardar como PDF&quot; como destino para obtener el archivo.
        </p>
      </div>

      {/* Document */}
      <main className="print-root max-w-4xl mx-auto px-6 py-8 text-black bg-white min-h-screen">
        {/* Header (visible on screen and print) */}
        <header className="pb-5 border-b-2 border-black/80 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-black/60">
                Diario de entrenamiento
              </p>
              <h1 className="text-3xl font-black tracking-tight mt-1 text-black">
                {data?.profile?.nombre || 'Alumno'}
              </h1>
              <p className="text-[12px] text-black/70 mt-1 capitalize">
                {data?.profile?.cinturon_actual
                  ? `Cinturon ${data.profile.cinturon_actual}`
                  : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-black/50 font-bold">
                Periodo
              </p>
              <p className="text-[13px] font-semibold text-black">
                {format(parseISO(from), "d 'de' MMM yyyy", { locale: es })}
                <br />
                {format(parseISO(to), "d 'de' MMM yyyy", { locale: es })}
              </p>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-4 gap-4 mt-5 pt-4 border-t border-black/10">
              <Stat label="Registros" value={String(stats.total)} />
              <Stat label="Entrenos" value={String(stats.trained)} />
              <Stat
                label="Promedio"
                value={stats.avg != null ? `${stats.avg.toFixed(1)}/10` : '—'}
              />
              <Stat label="Con reflexion" value={String(stats.withReflection)} />
            </div>
          )}
        </header>

        {loading ? (
          <p className="text-black/60 text-sm">Cargando diario...</p>
        ) : !data || data.entries.length === 0 ? (
          <p className="text-black/60 text-sm italic">
            Sin entradas en el rango seleccionado.
          </p>
        ) : (
          <div className="space-y-6">
            {data.entries.map((e) => (
              <EntryBlock
                key={e.fecha}
                entry={e}
                extras={data.entriesByFecha?.[e.fecha]}
              />
            ))}
          </div>
        )}

        <footer className="no-print mt-12 pt-4 border-t border-black/10 text-[10px] text-black/50 text-center">
          Generado desde JJL Elite · {format(new Date(), "d 'de' MMM yyyy", { locale: es })}
        </footer>
      </main>

      {/* Print styles */}
      <style jsx global>{`
        @page {
          size: A4;
          margin: 14mm 14mm 16mm 14mm;
        }
        @media print {
          html,
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-root {
            padding: 0 !important;
            max-width: none !important;
          }
          .avoid-break-inside {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          a {
            color: #b91c1c !important;
            text-decoration: underline !important;
            word-break: break-all;
          }
        }
        @media screen {
          body {
            background: #f3f4f6;
          }
          .print-root {
            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.35);
            margin-top: 20px;
            margin-bottom: 40px;
            border-radius: 6px;
          }
        }
      `}</style>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-black/50">
        {label}
      </p>
      <p className="text-[20px] font-black tabular-nums text-black leading-tight mt-0.5">
        {value}
      </p>
    </div>
  );
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
function renderLinkified(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((chunk, i) =>
    URL_REGEX.test(chunk) ? (
      <a key={i} href={chunk} target="_blank" rel="noopener noreferrer">
        {chunk}
      </a>
    ) : (
      <span key={i}>{chunk}</span>
    )
  );
}

function EntryBlock({
  entry,
  extras,
}: {
  entry: Entry;
  extras?: { aprendizajes: string[]; observaciones: string[]; notas: string[] };
}) {
  const date = parseISO(entry.fecha);
  const badges: Array<{ label: string; value: string }> = [];
  if (entry.entreno_check) badges.push({ label: 'Entreno', value: 'Si' });
  if (entry.fatiga) badges.push({ label: 'Fatiga', value: FATIGA_LABEL[entry.fatiga] ?? entry.fatiga });
  if (entry.intensidad) badges.push({ label: 'Intensidad', value: entry.intensidad });
  if (entry.puntaje != null) badges.push({ label: 'Puntaje', value: `${entry.puntaje}/10` });

  return (
    <article className="avoid-break-inside pb-5 border-b border-black/10">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-[16px] font-black text-black capitalize">
          {format(date, "EEEE d 'de' MMMM yyyy", { locale: es })}
        </h2>
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-black/70">
            {badges.map((b, i) => (
              <span key={i}>
                <span className="uppercase tracking-wider font-bold text-black/50 mr-1">
                  {b.label}:
                </span>
                {b.value}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-[12px] leading-relaxed">
        {entry.objetivo && (
          <Field
            label="Objetivo"
            value={entry.objetivo}
            status={
              entry.objetivo_cumplido === true
                ? 'Cumplido'
                : entry.objetivo_cumplido === false
                  ? 'No cumplido'
                  : null
            }
          />
        )}
        {entry.regla && (
          <Field
            label="Regla (no hacer)"
            value={entry.regla}
            status={
              entry.regla_cumplida === true
                ? 'Cumplida'
                : entry.regla_cumplida === false
                  ? 'No cumplida'
                  : null
            }
          />
        )}
        {entry.meta_entreno && (
          <Field label="Meta de entrenamiento" value={entry.meta_entreno} className="md:col-span-2" />
        )}
        {(extras?.aprendizajes.length ?? 0) > 0 && (
          <Field
            label="Aprendizajes"
            value={(extras!.aprendizajes).join('\n\n')}
            className="md:col-span-2"
            highlighted
          />
        )}
        {(extras?.observaciones.length ?? 0) > 0 && (
          <Field
            label="Observaciones"
            value={(extras!.observaciones).join('\n\n')}
            className="md:col-span-2"
          />
        )}
        {(extras?.notas.length ?? 0) > 0 && (
          <Field
            label="Notas / links"
            value={(extras!.notas).join('\n\n')}
            className="md:col-span-2"
            linkify
          />
        )}
        {/* Legacy compat — only shown if a row hadn't been migrated yet */}
        {!extras && entry.aprendizajes && (
          <Field label="Aprendizajes" value={entry.aprendizajes} className="md:col-span-2" highlighted />
        )}
        {!extras && entry.observaciones && (
          <Field label="Observaciones" value={entry.observaciones} className="md:col-span-2" />
        )}
        {!extras && entry.notas && (
          <Field label="Notas / links" value={entry.notas} className="md:col-span-2" linkify />
        )}
      </div>
    </article>
  );
}

function Field({
  label,
  value,
  className,
  highlighted,
  linkify,
  status,
}: {
  label: string;
  value: string;
  className?: string;
  highlighted?: boolean;
  linkify?: boolean;
  status?: string | null;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-black/55">
          {label}
        </p>
        {status && (
          <span
            className={`text-[10px] font-bold ${
              status.toLowerCase().includes('no') ? 'text-red-700' : 'text-green-700'
            }`}
          >
            {status}
          </span>
        )}
      </div>
      <p
        className={`mt-0.5 whitespace-pre-wrap ${
          highlighted ? 'border-l-2 border-red-700 pl-2' : ''
        }`}
      >
        {linkify ? renderLinkified(value) : value}
      </p>
    </div>
  );
}
