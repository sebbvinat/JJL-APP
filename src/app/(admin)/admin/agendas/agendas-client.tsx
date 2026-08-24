'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Search, BookOpen, UserPlus } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import Kanban, { type LeadRowExt, type SaleSummary } from '@/components/admin/setter/Kanban';
import LeadDrawer from '@/components/admin/setter/LeadDrawer';
import ConvertToAlumnoModal from '@/components/admin/setter/ConvertToAlumnoModal';
import SetterGuide from '@/components/admin/setter/SetterGuide';
import CommissionPanel from '@/components/admin/setter/CommissionPanel';
import FollowupsPanel from '@/components/admin/setter/FollowupsPanel';
import AgendaCalendly from '@/components/admin/setter/AgendaCalendly';

type AdminRow = { id: string; nombre: string; avatar_url: string | null; tags: string[] };

interface SalesSummaryResponse {
  by_lead: Record<string, SaleSummary>;
  totals: { total_monto: number; total_comision: number; leads_convertidos: number };
  setupRequired?: boolean;
}

interface MeResponse {
  user?: { id: string; nombre: string | null; tags?: string[] | null; setter_guide_seen_at?: string | null };
}

/** Minusculas, sin acentos y sin signos: "Iván M." y "ivanm" matchean igual. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Claves con las que se busca un lead.
 *
 * NINGUN lead tiene email: el quiz solo guarda el Instagram. Pero cuando
 * cerras en la call lo unico que te queda de la persona es el mail, y
 * buscarlo no encontraba nada — parecia que el lead no existia.
 *
 * Asi que de un mail tambien probamos con lo de antes del @, sin los numeros
 * del final, contra el handle: "robertadolf1987@gmail.com" encuentra a
 * "robert_adolfo_dominguez_cuevas". Pedimos 5 caracteres minimo para que un
 * mail tipo "ana@..." no traiga media lista.
 */
function clavesDeBusqueda(q: string): string[] {
  const claves = [normalizar(q)];
  if (q.includes('@')) {
    const local = normalizar(q.split('@')[0]).replace(/[0-9]+$/, '');
    if (local.length >= 5) claves.push(local);
  }
  return claves.filter(Boolean);
}

export default function AgendasClient() {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [altaLibre, setAltaLibre] = useState(false);

  // Polling moderado: cada 5 min para no quemar egress del plan Free de
  // Supabase. Las notifs auto (in-app + push) ya cubren el tiempo real;
  // este refresh es para que el Kanban se actualice cuando vuelve el foco
  // al tab.
  const { data, isLoading, mutate } = useSWR<{ leads: LeadRowExt[]; setupRequired?: boolean }>(
    '/api/admin/leads',
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 300_000, dedupingInterval: 30_000 },
  );

  // Resumen de ventas (lead_id → { total_comision, ... }) — mismo polling.
  const { data: salesData } = useSWR<SalesSummaryResponse>(
    '/api/admin/leads/sales-summary',
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 300_000, dedupingInterval: 30_000 },
  );
  const salesByLead = salesData?.by_lead ?? {};
  const salesTotals = salesData?.totals ?? { total_monto: 0, total_comision: 0, leads_convertidos: 0 };

  // Admins (con sus tags) para el dropdown de asignación. Reusamos /api/admin/tags.
  const { data: adminsData } = useSWR<{ admins: AdminRow[]; setupRequired?: boolean }>('/api/admin/tags', fetcher);
  const admins = useMemo(() => adminsData?.admins || [], [adminsData]);

  // Para decidir si mostrar la guía: usuario actual + tags + flag de visto.
  const { data: meData, mutate: mutateMe } = useSWR<MeResponse>('/api/auth/me', fetcher);
  const me = meData?.user;
  const isSetter = !!me?.tags?.includes('setter');
  const showGuide = !guideDismissed && isSetter && !me?.setter_guide_seen_at;

  const leads: LeadRowExt[] = useMemo(() => {
    const ls = data?.leads || [];
    if (!q.trim()) return ls;
    const claves = clavesDeBusqueda(q);
    return ls.filter((l) => {
      const heno = normalizar(`${l.nombre || ''} ${l.email || ''} ${l.instagram || ''} ${l.telefono || ''}`);
      return claves.some((k) => heno.includes(k));
    });
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <StatCard label="Leads totales" value={stats.total} />
        <StatCard label="Nuevos hoy" value={stats.nuevosHoy} tone="blue" />
        <StatCard label="Sin agendar +24h" value={stats.sinAgendar24} tone={stats.sinAgendar24 > 0 ? 'amber' : 'default'} />
        <StatCard label="Conversion últ. 30d" value={`${stats.convRate}%`} sub={`${stats.conv}/${stats.totalUltMes}`} tone={stats.convRate >= 20 ? 'green' : 'default'} />
        <StatCard
          label={isSetter ? 'Tu comisión total' : 'Comisión total'}
          value={`$${salesTotals.total_comision.toLocaleString('es-AR')}`}
          // Al setter no le mostramos el monto bruto cobrado — solo cuánto gana él.
          sub={isSetter ? `${salesTotals.leads_convertidos} cliente${salesTotals.leads_convertidos === 1 ? '' : 's'}` : `sobre $${salesTotals.total_monto.toLocaleString('es-AR')} cobrado`}
          tone="green"
        />
      </div>

      {/* Consultorías agendadas — se leen en vivo de Calendly. Va primero
          porque es lo más urgente: quién viene hoy y a qué hora. */}
      <AgendaCalendly puedeCrear={!isSetter} />

      {/* Follow-ups del bot que hay que seguir a mano (logs del CRM) */}
      <FollowupsPanel />

      {/* Comisión por mes — cuánto va ganando el setter cada mes */}
      <CommissionPanel isSetter={isSetter} />

      {/* Búsqueda + guion de setting */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-jjl-muted pointer-events-none" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por Instagram, mail, nombre o teléfono…"
            className="w-full h-10 pl-10 pr-4 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25" />
        </div>
        {/* Alta sin depender de encontrar a nadie.
            Los otros dos caminos (convertir un lead, o crear desde una
            consultoria de Calendly) piden ubicar a la persona primero, y hay
            gente que no esta en ninguno de los dos: no hizo el quiz y no
            agendo por Calendly. Para esos no habia forma de darles el alta
            completa — "Crear alumno" del panel de alumnos abre la cuenta pero
            no asigna planilla ni desbloquea modulos. */}
        {!isSetter && (
          <button
            type="button"
            onClick={() => setAltaLibre(true)}
            title="Crear un alumno escribiendo su nombre y mail, sin buscarlo"
            className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg bg-green-500 text-white text-[13px] font-bold hover:bg-green-600 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Crear alumno</span>
            <span className="sm:hidden">Crear</span>
          </button>
        )}
        <a
          href="/guion-setting.html"
          target="_blank"
          rel="noopener noreferrer"
          title="Guion de setting — mapa interactivo con los textos para copiar"
          className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-jjl-border bg-white/[0.03] text-[13px] font-medium text-white hover:border-jjl-red hover:bg-white/[0.06] transition-colors"
        >
          <BookOpen className="h-4 w-4 text-jjl-red" />
          <span className="hidden sm:inline">Guion de setting</span>
          <span className="sm:hidden">Guion</span>
        </a>
      </div>

      {/* Kanban */}
      {isLoading && !data ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <Kanban
          leads={leads}
          admins={admins}
          salesByLead={salesByLead}
          viewerIsSetter={isSetter}
          onOpenLead={(l) => setOpenId(l.id)}
          onQuickDiscard={async (lead) => {
            try {
              const res = await fetch(`/api/admin/leads/${lead.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage: 'descartado' }),
              });
              if (!res.ok) throw new Error('No se pudo descartar');
              await mutate();
              showToast(`Descartado: ${lead.nombre || lead.instagram || lead.email || 'lead'}`);
            } catch {
              showToast('Error al descartar — probá de nuevo');
            }
          }}
        />
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

      {/* Alta libre: sin lead y sin consultoria, solo nombre y mail */}
      {altaLibre && (
        <ConvertToAlumnoModal
          onClose={() => setAltaLibre(false)}
          onConverted={({ user_id }) => {
            setAltaLibre(false);
            showToast('Alumno creado. Redirigiendo…');
            setTimeout(() => { window.location.href = `/admin/${user_id}`; }, 800);
          }}
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

      {/* Guía de bienvenida — primera vez que un setter entra */}
      {showGuide && (
        <SetterGuide
          onDismiss={async () => {
            setGuideDismissed(true);
            try {
              await fetch('/api/admin/setter/guide-seen', { method: 'POST' });
              void mutateMe();
            } catch { /* silencioso — la próxima carga vuelve a mostrar si falla */ }
          }}
        />
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
