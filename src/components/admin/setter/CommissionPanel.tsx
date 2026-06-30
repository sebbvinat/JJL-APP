'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';

interface MonthRow {
  month: string;
  label: string;
  comision: number;
  monto: number;
  ventas: number;
  cuotas: number;
  is_current: boolean;
}

interface CommissionResponse {
  hide_amount: boolean;
  rate_pct: number;
  current: { month: string; label: string; comision: number; monto: number; ventas: number };
  months: MonthRow[];
  setupRequired?: boolean;
}

/**
 * Panel "Tu comisión por mes" en /admin/agendas.
 *
 * - Setter: ve su comisión del mes actual (grande) + meses anteriores,
 *   nunca el monto bruto.
 * - Admin/coach: ve la comisión total de la operación + el bruto cobrado.
 */
export default function CommissionPanel({ isSetter }: { isSetter: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { data } = useSWR<CommissionResponse>(
    '/api/admin/leads/commission-monthly',
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 300_000, dedupingInterval: 30_000 },
  );

  const current = data?.current;
  const months = data?.months ?? [];
  const hideAmount = data?.hide_amount ?? isSetter;
  const ratePct = data?.rate_pct;
  const prevMonths = months.filter((m) => !m.is_current);
  const shown = expanded ? prevMonths : prevMonths.slice(0, 3);

  const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`;

  return (
    <div className="rounded-xl border border-green-500/30 bg-gradient-to-br from-green-500/[0.07] to-transparent p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/15 border border-green-500/30">
            <TrendingUp className="h-4 w-4 text-green-300" />
          </span>
          <div>
            <h3 className="text-[13px] font-bold text-white leading-tight">
              {isSetter ? 'Tu comisión' : 'Comisión de la operación'}
            </h3>
            <p className="text-[10px] text-jjl-muted">
              {isSetter && ratePct != null ? `${ratePct}% por venta` : 'Por mes'}
            </p>
          </div>
        </div>
      </div>

      {/* Mes actual — número grande */}
      <div className="flex items-end justify-between gap-3 mb-1">
        <div>
          <p className="text-3xl font-black text-green-300 tabular-nums leading-none">
            {fmt(current?.comision ?? 0)}
          </p>
          <p className="text-[11px] text-jjl-muted mt-1 capitalize">
            {current?.label || 'este mes'}
            {current && current.ventas > 0 && (
              <span className="lowercase"> · {current.ventas} venta{current.ventas === 1 ? '' : 's'}</span>
            )}
          </p>
        </div>
        {!hideAmount && current && current.monto > 0 && (
          <p className="text-[11px] text-jjl-muted text-right">
            sobre {fmt(current.monto)}<br />cobrado
          </p>
        )}
      </div>

      {current && current.comision === 0 && (
        <p className="text-[11px] text-jjl-muted/70 italic mt-1">
          Todavía no marcaste ventas este mes.
        </p>
      )}

      {/* Meses anteriores */}
      {prevMonths.length > 0 && (
        <div className="mt-3 pt-3 border-t border-green-500/20 space-y-1.5">
          {shown.map((m) => (
            <div key={m.month} className="flex items-center justify-between text-[12px]">
              <span className="text-jjl-muted capitalize">{m.label}</span>
              <span className="flex items-center gap-2">
                {!hideAmount && m.monto > 0 && (
                  <span className="text-[10px] text-jjl-muted/70 tabular-nums">{fmt(m.monto)}</span>
                )}
                <span className="font-bold text-green-300/90 tabular-nums">{fmt(m.comision)}</span>
              </span>
            </div>
          ))}
          {prevMonths.length > 3 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-jjl-muted hover:text-white transition-colors mt-1"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Ver menos' : `Ver ${prevMonths.length - 3} meses más`}
            </button>
          )}
        </div>
      )}

      {data?.setupRequired && (
        <p className="text-[11px] text-amber-300/80 mt-2">Sin ventas registradas todavía.</p>
      )}
    </div>
  );
}
