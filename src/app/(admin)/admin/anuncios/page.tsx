'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Megaphone, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type Ann = {
  id: string;
  titulo: string;
  mensaje: string;
  importancia: 'info' | 'warning' | 'critical';
  url: string | null;
  activa: boolean;
  created_at: string;
  expires_at: string | null;
};

export default function AdminAnunciosPage() {
  const [items, setItems] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/announcements', { cache: 'no-store' });
      const data = await res.json();
      if (data?.setupRequired) { setSetupRequired(true); setLoading(false); return; }
      setItems(data?.announcements || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggleActiva(id: string, activa: boolean) {
    await fetch(`/api/admin/announcements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activa: !activa }),
    });
    void load();
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar este anuncio?')) return;
    await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    void load();
  }

  return (
    <div className="max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto space-y-5 pb-12">
      <header>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12px] text-jjl-muted hover:text-white mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al panel
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold">Admin</p>
              <h1 className="text-2xl font-black tracking-tight">Anuncios</h1>
              <p className="text-sm text-jjl-muted mt-0.5">Alertas que aparecen como banner para todos los alumnos hasta que las cierran.</p>
            </div>
          </div>
          {!showForm && !setupRequired && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-jjl-red text-white text-[13px] font-semibold hover:bg-jjl-red-hover"
            >
              <Plus className="h-4 w-4" /> Nuevo
            </button>
          )}
        </div>
      </header>

      {setupRequired ? (
        <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-6 text-center text-[13px] text-jjl-muted">
          Falta correr la migración SQL <code className="text-jjl-red">announcements</code> en Supabase.
        </div>
      ) : (
        <>
          {showForm && <NewForm onCancel={() => setShowForm(false)} onSaved={() => { setShowForm(false); void load(); }} />}

          <div className="space-y-2">
            {loading ? (
              <p className="text-[12px] text-jjl-muted italic py-8 text-center">Cargando…</p>
            ) : items.length === 0 ? (
              <p className="text-[12px] text-jjl-muted italic py-8 text-center">Sin anuncios todavía.</p>
            ) : (
              items.map((a) => (
                <div key={a.id} className={`flex items-start gap-3 p-3.5 rounded-xl border ${a.activa ? 'border-jjl-border bg-white/[0.02]' : 'border-jjl-border/40 bg-white/[0.01] opacity-60'}`}>
                  <span className={`mt-0.5 inline-flex items-center h-5 px-1.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    a.importancia === 'critical' ? 'bg-jjl-red/10 border-jjl-red/30 text-red-300' :
                    a.importancia === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                    'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  }`}>{a.importancia}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white">{a.titulo}</p>
                    <p className="text-[12px] text-jjl-muted mt-0.5 line-clamp-2 whitespace-pre-wrap">{a.mensaje}</p>
                    <p className="text-[10px] text-jjl-muted/60 mt-1">
                      {new Date(a.created_at).toLocaleString('es-AR')}
                      {a.url ? <> · <a href={a.url} target="_blank" rel="noopener" className="text-jjl-muted hover:text-white underline">link</a></> : null}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <button
                      onClick={() => void toggleActiva(a.id, a.activa)}
                      className={`h-8 px-2.5 rounded text-[11px] font-semibold ${a.activa ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-jjl-red/20 text-red-300 hover:bg-jjl-red/30'}`}
                    >{a.activa ? 'Desactivar' : 'Activar'}</button>
                    <button onClick={() => void remove(a.id)} className="h-8 w-8 flex items-center justify-center rounded text-jjl-muted hover:text-red-400 hover:bg-white/5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NewForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [importancia, setImportancia] = useState<'info' | 'warning' | 'critical'>('info');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function submit() {
    if (!titulo.trim() || !mensaje.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, mensaje, importancia, url: url || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error al guardar');
      toast.success('Anuncio publicado');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-4 space-y-3">
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título"
        maxLength={200}
        className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red"
      />
      <textarea
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        placeholder="Mensaje"
        rows={3}
        maxLength={2000}
        className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red resize-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={importancia}
          onChange={(e) => setImportancia(e.target.value as 'info' | 'warning' | 'critical')}
          className="bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-jjl-red"
        >
          <option value="info">info (azul)</option>
          <option value="warning">warning (ámbar)</option>
          <option value="critical">critical (rojo)</option>
        </select>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL opcional (/soporte, /events, etc)"
          className="bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red"
        />
      </div>
      <p className="text-[11px] text-jjl-muted/80">
        Al publicar se envía banner + notificación (campanita y push) a todos los alumnos.
      </p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="h-9 px-3 rounded-lg text-[13px] text-jjl-muted hover:text-white">Cancelar</button>
        <button
          onClick={submit}
          disabled={!titulo.trim() || !mensaje.trim() || saving}
          className="h-9 px-4 rounded-lg bg-jjl-red text-white text-[13px] font-semibold hover:bg-jjl-red-hover disabled:opacity-40"
        >{saving ? 'Publicando…' : 'Publicar'}</button>
      </div>
    </div>
  );
}
