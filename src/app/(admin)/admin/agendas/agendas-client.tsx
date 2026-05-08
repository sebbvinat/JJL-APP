'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  AtSign,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Hourglass,
  MessageSquare,
  ShieldOff,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { fetcher } from '@/lib/fetcher';
import {
  COMPROMISO_LABEL,
  ESTADO_LABEL,
  FORTALEZA_LABEL,
  LIMITACION_LABEL,
  VISION_LABEL,
  flagFor,
  phoneToWaMe,
  type LeadRow,
} from '@/lib/lead-labels';

type Filter = 'all' | 'booked' | 'pending' | 'disqualified';

const FILTERS: { key: Filter; label: string; icon: typeof CalendarClock }[] = [
  { key: 'booked', label: 'Agendados', icon: CalendarCheck },
  { key: 'pending', label: 'Calificados sin agendar', icon: Hourglass },
  { key: 'disqualified', label: 'Descartados', icon: ShieldOff },
  { key: 'all', label: 'Todos', icon: CalendarClock },
];

export default function AgendasClient() {
  const [filter, setFilter] = useState<Filter>('booked');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useSWR<{ leads: LeadRow[] }>(
    `/api/admin/leads?filter=${filter}`,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60_000 },
  );

  const leads = data?.leads || [];

  const counts = useMemo(() => {
    return {
      total: leads.length,
      booked: leads.filter((l) => l.booked && !l.disqualified).length,
      pending: leads.filter((l) => !l.booked && !l.disqualified).length,
      disqualified: leads.filter((l) => l.disqualified).length,
    };
  }, [leads]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-400/80 font-semibold mb-1.5">
          Panel de Instructor
        </p>
        <h1 className="text-3xl font-black tracking-tight">Agendas</h1>
        <p className="text-sm text-jjl-muted mt-1.5">
          Leads que completaron el quiz de calificación. Click en una fila para ver
          todas las respuestas y abrir WhatsApp.
        </p>
      </header>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-semibold transition-colors border ${
                active
                  ? 'bg-jjl-red/15 border-jjl-red/50 text-white'
                  : 'bg-white/[0.02] border-jjl-border text-jjl-muted hover:text-white hover:border-jjl-border-strong'
              }`}
            >
              <Icon className="h-4 w-4" />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatPill label="Resultados" value={counts.total} accent="text-white" />
        <StatPill label="Agendados" value={counts.booked} accent="text-emerald-400" />
        <StatPill label="Sin agendar" value={counts.pending} accent="text-amber-400" />
        <StatPill label="Descartados" value={counts.disqualified} accent="text-jjl-muted" />
      </div>

      {/* List */}
      {isLoading && (
        <Card>
          <p className="text-sm text-jjl-muted">Cargando agendas...</p>
        </Card>
      )}

      {error && (
        <Card>
          <p className="text-sm text-jjl-red">No pudimos cargar la lista.</p>
        </Card>
      )}

      {!isLoading && !error && leads.length === 0 && (
        <Card>
          <div className="flex items-center gap-3 text-jjl-muted">
            <CalendarClock className="h-5 w-5" />
            <p className="text-sm">No hay leads con este filtro todavía.</p>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            expanded={expandedId === lead.id}
            onToggle={() =>
              setExpandedId((curr) => (curr === lead.id ? null : lead.id))
            }
          />
        ))}
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-jjl-border bg-white/[0.02] px-4 py-3">
      <div className={`text-2xl font-black ${accent}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-[0.16em] text-jjl-muted mt-0.5">
        {label}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  expanded,
  onToggle,
}: {
  lead: LeadRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const flag = flagFor(lead.pais);
  const waDigits = phoneToWaMe(lead.telefono);
  const created = new Date(lead.created_at);
  const createdStr = created.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const scheduled = lead.scheduled_at ? new Date(lead.scheduled_at) : null;
  const scheduledStr = scheduled
    ? scheduled.toLocaleString('es-AR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const status = lead.disqualified
    ? { label: 'Descartado', className: 'text-jjl-muted bg-white/[0.04]' }
    : lead.booked
    ? { label: 'Agendado', className: 'text-emerald-400 bg-emerald-500/10' }
    : { label: 'Sin agendar', className: 'text-amber-400 bg-amber-500/10' };

  const igHandle = lead.instagram?.trim() || null;
  const headline =
    lead.nombre?.trim() ||
    lead.email?.trim() ||
    (igHandle ? `@${igHandle}` : null) ||
    lead.telefono?.trim() ||
    'Lead anónimo';

  return (
    <div className="rounded-xl border border-jjl-border bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.03] transition-colors text-left"
      >
        <span className="text-2xl shrink-0" aria-hidden>
          {flag}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">{headline}</span>
            <span
              className={`text-[10px] uppercase tracking-[0.14em] font-bold rounded-full px-2 py-0.5 ${status.className}`}
            >
              {status.label}
            </span>
          </div>
          {scheduledStr ? (
            <p className="text-[12px] text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Agendado para {scheduledStr}</span>
            </p>
          ) : (
            <p className="text-[12px] text-jjl-muted mt-0.5 truncate">
              {createdStr} · {summarizeAnswers(lead)}
            </p>
          )}
        </div>
        {waDigits && (
          <a
            href={`https://wa.me/${waDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 hover:text-white text-[12px] font-semibold transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            WhatsApp
          </a>
        )}
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-jjl-muted shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-jjl-muted shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-jjl-border px-4 py-4 bg-black/20 space-y-3">
          {/* Datos del agendamiento — vienen del webhook de Calendly */}
          {(scheduledStr || lead.nombre || lead.email) && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-emerald-400 font-bold">
                <CalendarCheck className="h-3.5 w-3.5" />
                Datos de la agenda
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
                <Field label="Nombre" value={lead.nombre} />
                <Field label="Email" value={lead.email} />
                <Field label="Fecha y hora" value={scheduledStr} />
                <Field label="Teléfono" value={lead.telefono} />
              </div>
            </div>
          )}

          {waDigits && (
            <div className="sm:hidden">
              <a
                href={`https://wa.me/${waDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-10 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 hover:text-white text-[13px] font-semibold transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Abrir WhatsApp
              </a>
            </div>
          )}

          {(igHandle || lead.ocupacion) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              {igHandle && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-jjl-muted/70 font-semibold">
                    Instagram
                  </div>
                  <a
                    href={`https://instagram.com/${encodeURIComponent(igHandle)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-pink-300 hover:text-pink-200 transition-colors mt-0.5"
                  >
                    <AtSign className="h-3.5 w-3.5" />
                    {igHandle}
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </a>
                </div>
              )}
              <Field label="Ocupación" value={lead.ocupacion} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5 text-[13px]">
            <Field label="Fortaleza" value={FORTALEZA_LABEL[lead.fortaleza || ''] || lead.fortaleza} />
            <Field label="Limitante" value={LIMITACION_LABEL[lead.limitacion || ''] || lead.limitacion} />
            <Field label="Estado actual" value={ESTADO_LABEL[lead.estado || ''] || lead.estado} />
            <Field label="Visión 6 meses" value={VISION_LABEL[lead.vision || ''] || lead.vision} />
            <Field label="Compromiso" value={COMPROMISO_LABEL[lead.compromiso || ''] || lead.compromiso} />
          </div>

          {(lead.referrer || lead.user_agent) && (
            <details className="text-[11px] text-jjl-muted">
              <summary className="cursor-pointer hover:text-white">
                Detalles técnicos
              </summary>
              <div className="mt-2 space-y-1 font-mono">
                {lead.referrer && (
                  <div className="break-all">
                    <span className="text-jjl-muted/60">referrer:</span> {lead.referrer}
                  </div>
                )}
                {lead.user_agent && (
                  <div className="break-all">
                    <span className="text-jjl-muted/60">UA:</span> {lead.user_agent}
                  </div>
                )}
              </div>
            </details>
          )}

          {lead.booked && (
            <div className="flex items-center gap-2 text-[12px] text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Confirmó agenda en Calendly
            </div>
          )}
          {lead.disqualified && (
            <div className="flex items-center gap-2 text-[12px] text-jjl-muted">
              <ShieldOff className="h-3.5 w-3.5" />
              Se autoexcluyó en la pregunta de compromiso
            </div>
          )}
          <a
            href="https://calendly.com/jiujitsulatino/45m"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-jjl-muted hover:text-white transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir Calendly
          </a>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-jjl-muted/70 font-semibold">
        {label}
      </div>
      <div className="text-white/90 mt-0.5">{value || '—'}</div>
    </div>
  );
}

function summarizeAnswers(lead: LeadRow): string {
  const parts: string[] = [];
  if (lead.ocupacion?.trim()) {
    parts.push(lead.ocupacion.trim());
  }
  if (lead.estado) {
    const e = ESTADO_LABEL[lead.estado] || lead.estado;
    parts.push(e.split(',')[0]);
  }
  return parts.join(' · ') || 'Quiz completo';
}
