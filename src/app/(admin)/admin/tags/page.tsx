'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, Bell } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';

type AdminRow = {
  id: string;
  nombre: string;
  avatar_url: string | null;
  tags: string[];
  email?: string | null;
};

/**
 * Equipo y permisos.
 *
 * Antes se llamaba "Tags de Admins" y presentaba los tres tags como
 * preferencias de notificacion. Dos lo son (soporte, profesor). El tercero no:
 * `setter` es un permiso. El middleware le cierra a quien lo tiene todo el
 * panel menos /admin/agendas, y el resumen de ventas le oculta el total
 * recaudado. Mostrarlo como "recibe notifs de leads (futuro)" invitaba a
 * sacarselo a alguien pensando que era una notificacion, y con eso esa
 * persona pasaba a ver todo, incluida la plata.
 */

const NOTIFICACIONES: Record<string, { label: string; description: string }> = {
  soporte: { label: 'Soporte', description: 'Le llegan las consultas de Soporte' },
  profesor: { label: 'Profesor', description: 'Le llegan los videos nuevos para revisar' },
};

export default function EquipoPermisosPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tags', { cache: 'no-store' });
      const data = await res.json();
      if (data?.setupRequired) {
        setSetupRequired(true);
        return;
      }
      setAdmins(data?.admins || []);
      setMe(data?.me || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function guardar(admin: AdminRow, next: string[]) {
    const antes = admin.tags;
    setSavingId(admin.id);
    setAdmins((prev) => prev.map((a) => (a.id === admin.id ? { ...a, tags: next } : a)));
    try {
      const res = await fetch('/api/admin/tags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: admin.id, tags: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'No se pudo guardar');
      toast.success('Guardado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      setAdmins((prev) => prev.map((a) => (a.id === admin.id ? { ...a, tags: antes } : a)));
    } finally {
      setSavingId(null);
    }
  }

  function toggleNotificacion(admin: AdminRow, tag: string) {
    const next = admin.tags.includes(tag) ? admin.tags.filter((t) => t !== tag) : [...admin.tags, tag];
    void guardar(admin, next);
  }

  function toggleSetter(admin: AdminRow) {
    const esSetter = admin.tags.includes('setter');
    // Este cambio no es cosmetico: cambia lo que la persona puede ver. Se
    // confirma siempre, diciendo exactamente que pasa.
    const aviso = esSetter
      ? `${admin.nombre} va a pasar a tener ACCESO COMPLETO al panel: todos los alumnos, analíticas, cursos y el total recaudado.\n\n¿Seguir?`
      : `${admin.nombre} va a quedar como SETTER: solo va a ver Agendas y su propia comisión. Pierde acceso a alumnos, analíticas y cursos, y deja de ver el total recaudado.\n\n¿Seguir?`;
    if (!window.confirm(aviso)) return;
    const next = esSetter ? admin.tags.filter((t) => t !== 'setter') : [...admin.tags, 'setter'];
    void guardar(admin, next);
  }

  return (
    <div className="max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto space-y-5 pb-12">
      <header>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12px] text-jjl-muted hover:text-white mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al panel
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold">Admin</p>
            <h1 className="text-2xl font-black tracking-tight">Equipo y permisos</h1>
            <p className="text-sm text-jjl-muted mt-0.5">Quién tiene acceso al panel y qué puede ver.</p>
          </div>
        </div>
      </header>

      {/* Los dos tipos de marca, explicados una vez arriba */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-[13px] font-bold text-white">
            <Lock className="h-4 w-4 text-jjl-red" /> Permiso: Setter
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-jjl-muted">
            Solo ve <b className="text-white/80">Agendas</b> y su propia comisión. No ve alumnos, analíticas,
            cursos ni el total recaudado. Sin esta marca, un admin ve todo.
          </p>
        </div>
        <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-[13px] font-bold text-white">
            <Bell className="h-4 w-4 text-jjl-muted" /> Notificaciones: Soporte y Profesor
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-jjl-muted">
            Solo deciden a quién le llegan los avisos. No cambian lo que puede ver. Si nadie tiene una, ese
            aviso le llega a todos los admins.
          </p>
        </div>
      </div>

      {setupRequired ? (
        <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-6 text-center text-[13px] text-jjl-muted">
          Falta correr la migración SQL <code className="text-jjl-red">users.tags</code> en Supabase.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-jjl-red border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-jjl-border bg-white/[0.02] divide-y divide-white/[0.06]">
          {admins.map((a) => {
            const esSetter = a.tags.includes('setter');
            const soyYo = a.id === me;
            const bloqueado = soyYo || savingId === a.id;
            return (
              <div key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar src={a.avatar_url} name={a.nombre} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-white">{a.nombre}</span>
                      {soyYo && (
                        <span className="rounded border border-jjl-border px-1.5 text-[10px] font-bold uppercase tracking-wider text-jjl-muted">
                          Vos
                        </span>
                      )}
                    </div>
                    {a.email && <p className="truncate text-[12px] text-jjl-muted">{a.email}</p>}
                    <p className={`mt-1 text-[12px] font-semibold ${esSetter ? 'text-sky-300' : 'text-amber-300'}`}>
                      {esSetter ? 'Setter · solo Agendas y su comisión' : 'Acceso completo · ve todo, incluido lo recaudado'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleSetter(a)}
                    disabled={bloqueado}
                    title={soyYo ? 'No podés cambiar tus propios permisos' : undefined}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      esSetter
                        ? 'border-sky-400/50 bg-sky-400/15 text-sky-200'
                        : 'border-jjl-border text-jjl-muted hover:border-jjl-border-strong hover:text-white'
                    }`}
                  >
                    <Lock className="h-3.5 w-3.5" /> Setter
                  </button>
                  <span className="mx-0.5 hidden h-5 w-px bg-jjl-border sm:block" />
                  {Object.entries(NOTIFICACIONES).map(([tag, info]) => {
                    const activo = a.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleNotificacion(a, tag)}
                        disabled={bloqueado}
                        title={soyYo ? 'No podés cambiar tus propios permisos' : info.description}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          activo
                            ? 'border-jjl-red/50 bg-jjl-red/15 text-white'
                            : 'border-jjl-border text-jjl-muted hover:border-jjl-border-strong hover:text-white'
                        }`}
                      >
                        <Bell className="h-3.5 w-3.5" /> {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[12px] text-jjl-muted">
        Nadie puede cambiar sus propios permisos: los cambia otro admin con acceso completo.
      </p>
    </div>
  );
}
