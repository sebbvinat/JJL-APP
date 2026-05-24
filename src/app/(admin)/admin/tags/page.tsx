'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Tag } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';

type AdminRow = { id: string; nombre: string; avatar_url: string | null; tags: string[] };

const TAG_INFO: Record<string, { label: string; description: string }> = {
  soporte: { label: 'Soporte', description: 'Recibe notifs de consultas de Soporte' },
  profesor: { label: 'Profesor', description: 'Recibe notifs de "Nuevo video" para revisar' },
  setter: { label: 'Setter', description: 'Recibe notifs de leads/agendas (futuro)' },
};

export default function AdminTagsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tags', { cache: 'no-store' });
      const data = await res.json();
      if (data?.setupRequired) { setSetupRequired(true); setLoading(false); return; }
      setAdmins(data?.admins || []);
      setAllowed(data?.allowedTags || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggle(adminId: string, tag: string) {
    const current = admins.find((a) => a.id === adminId)?.tags || [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    setSavingId(adminId);
    // Optimistic
    setAdmins((prev) => prev.map((a) => (a.id === adminId ? { ...a, tags: next } : a)));
    try {
      const res = await fetch('/api/admin/tags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: adminId, tags: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
      // Revert
      setAdmins((prev) => prev.map((a) => (a.id === adminId ? { ...a, tags: current } : a)));
    } finally { setSavingId(null); }
  }

  return (
    <div className="max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto space-y-5 pb-12">
      <header>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12px] text-jjl-muted hover:text-white mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al panel
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold">Admin</p>
            <h1 className="text-2xl font-black tracking-tight">Tags de Admins</h1>
            <p className="text-sm text-jjl-muted mt-0.5">
              Quién recibe qué notificaciones. Si nadie está marcado para un tag, las notifs van a TODOS los admins (fallback).
            </p>
          </div>
        </div>
      </header>

      {setupRequired ? (
        <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-6 text-center text-[13px] text-jjl-muted">
          Falta correr la migración SQL <code className="text-jjl-red">users.tags</code> en Supabase.
        </div>
      ) : loading ? (
        <p className="text-[12px] text-jjl-muted italic py-8 text-center">Cargando…</p>
      ) : admins.length === 0 ? (
        <p className="text-[12px] text-jjl-muted italic py-8 text-center">No hay admins.</p>
      ) : (
        <div className="space-y-2">
          {admins.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-jjl-border bg-white/[0.02]">
              <Avatar src={a.avatar_url} name={a.nombre} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-white truncate">{a.nombre}</p>
                <p className="text-[11px] text-jjl-muted">{a.tags.length === 0 ? 'Sin tags' : `Tags: ${a.tags.join(', ')}`}</p>
              </div>
              <div className="shrink-0 flex flex-wrap items-center gap-1.5">
                {allowed.map((tag) => {
                  const on = a.tags.includes(tag);
                  const info = TAG_INFO[tag] || { label: tag, description: '' };
                  return (
                    <button
                      key={tag}
                      onClick={() => void toggle(a.id, tag)}
                      disabled={savingId === a.id}
                      title={info.description}
                      className={`inline-flex items-center h-8 px-2.5 rounded-md text-[11px] font-semibold uppercase tracking-wider border transition-colors ${
                        on
                          ? 'bg-jjl-red/15 border-jjl-red/40 text-jjl-red'
                          : 'bg-white/[0.03] border-jjl-border text-jjl-muted hover:text-white hover:border-white/30'
                      } disabled:opacity-50`}
                    >
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
