'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Search } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import Kanban, { type LeadRowExt } from '@/components/admin/setter/Kanban';
import LeadDrawer from '@/components/admin/setter/LeadDrawer';
import ConvertToAlumnoModal from '@/components/admin/setter/ConvertToAlumnoModal';

type AdminRow = { id: string; nombre: string; avatar_url: string | null; tags: string[] };

export default function AgendasClient() {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR<{ leads: LeadRowExt[]; setupRequired?: boolean }>(
    '/api/admin/leads',
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60_000 },
  );

  // Admins (con sus tags) para el dropdown de asignación. Reusamos /api/admin/tags.
  const { data: adminsData } = useSWR<{ admins: AdminRow[]; setupRequired?: boolean }>('/api/admin/tags', fetcher);
  const admins = useMemo(() => adminsData?.admins || [], [adminsData]);

  const leads: LeadRowExt[] = useMemo(() => {
    const ls = data?.leads || [];
    if (!q.trim()) return ls;
    const qq = q.trim().toLowerCase();
    return ls.filter((l) =>
      `${l.nombre || ''} ${l.email || ''} ${l.instagram || ''} ${l.telefono || ''}`.toLowerCase().includes(qq)
    );
  }, [data, q]);

  const openLead = leads.find((l) => l.id === openId) || null;
  const convertingLead = leads.find((l) => l.id === convertingId) || null;

  // Stats
  const stats = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const ls = data?.leads || [];
    const nuevosHoy = ls.filter((l) => (l.created_at || '').slice(0, 10) === todayIso).length;
    const sinAgendar24 = ls.filter((l) => {
      const s = l.stage || (l.booked ? 'agendado' : l.disqualified ? 'descartado' : 'nuevo');
      if (s !== 'nuevo' && s !== 'contactado') return false;
      const age = now - new Date(l.created_at).getTime();
      return age >= 24 * 3600_000;
    }).length;
    const totalUltMes = ls.filter((l) => (now - new Date(l.created_at).getTime()) <= 30 * 86_400_000).length;
    const conv = ls.filter((l) => l.stage === 'convertido' && (now - new Date(l.created_at).getTime()) <= 30 * 86_400_000).length;
    const convRate = totalUltMes > 0 ? Math.round((conv / totalUltMes) * 100) : 0;
    return { total: ls.length, nuevosHoy, sinAgendar24, convRate, conv, totalUltMes };
  }, [data]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <div className="space-y-4 max-w-[1800px] mx-auto">
      {data?.setupRequired && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-200">
          ⚠ Migración SQL Phase 0 pendiente — kanban funcional pero sin stage/asignación.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Leads totales" value={stats.total} />
        <StatCard label="Nuevos hoy" value={stats.nuevosHoy} tone="blue" />
        <StatCard label="Sin agendar +24h" value={stats.sinAgendar24} tone={stats.sinAgendar24 > 0 ? 'amber' : 'default'} />
        <StatCard label="Conversion últ. 30d" value={`${stats.convRate}%`} sub={`${stats.conv}/${stats.totalUltMes}`} tone={stats.convRate >= 20 ? 'green' : 'default'} />
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-jjl-muted pointer-events-none" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre / email / Instagram / teléfono…"
          className="w-full h-10 pl-10 pr-4 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25" />
      </div>

      {/* Kanban */}
      {isLoading && !data ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <Kanban leads={leads} admins={admins} onOpenLead={(l) => setOpenId(l.id)} />
      )}

      {/* Drawer */}
      {openLead && (
        <LeadDrawer
          lead={openLead}
          admins={admins}
          onClose={() => setOpenId(null)}
          onChanged={() => void mutate()}
          onConvertClick={() => { setConvertingId(openLead.id); setOpenId(null); }}
        />
      )}

      {/* Convert modal */}
      {convertingLead && (
        <ConvertToAlumnoModal
          lead={convertingLead}
          onClose={() => setConvertingId(null)}
          onConverted={({ user_id }) => {
            setConvertingId(null);
            void mutate();
            showToast(`Lead convertido a alumno. Redirigiendo…`);
            setTimeout(() => { window.location.href = `/admin/${user_id}`; }, 800);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-xl bg-green-900/90 border border-green-500/30 text-green-300">
          {toast}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, tone = 'default' }: { label: string; value: string | number; sub?: string; tone?: 'default' | 'blue' | 'amber' | 'green' }) {
  const toneClasses = {
    default: 'border-jjl-border bg-white/[0.02] text-white',
    blue: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
    amber: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
    green: 'border-green-500/30 bg-green-500/5 text-green-300',
  }[tone];
  return (
    <div className={`rounded-xl border p-3 ${toneClasses}`}>
      <p className="text-[10px] uppercase tracking-wide text-jjl-muted font-semibold">{label}</p>
      <p className="text-2xl font-black tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-jjl-muted">{sub}</p>}
    </div>
  );
}
