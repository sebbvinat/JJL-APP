'use client';

import { useState } from 'react';
import { X, Unlock, Lock, Tag as TagIcon, Megaphone, ChevronDown } from 'lucide-react';
import { MONTH_RANGES } from '@/lib/crm';

interface Props {
  selectedIds: string[];
  onClear: () => void;
  onDone: (msg: string) => void;
}

type Action = 'unlock_month' | 'lock_month' | 'tag' | 'lifecycle' | 'announce';

export default function BulkActionBar({ selectedIds, onClear, onDone }: Props) {
  const [open, setOpen] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  if (selectedIds.length === 0) return null;

  async function runBulk(action: Action, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedIds, action, payload }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error');
      onDone(buildMsg(action, body));
      setOpen(null);
      onClear();
    } catch (e) {
      onDone(e instanceof Error ? e.message : 'Error');
    } finally { setBusy(false); }
  }

  return (
    <div className="sticky bottom-4 z-30 flex justify-center mt-4 pointer-events-none">
      <div className="pointer-events-auto bg-jjl-gray border border-jjl-border rounded-2xl shadow-2xl px-3 py-2 flex items-center gap-2 max-w-[min(100%,720px)]">
        <span className="text-[12px] font-semibold text-white px-2">{selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'}</span>
        <div className="h-5 w-px bg-jjl-border" />
        <BulkBtn icon={Unlock} label="Desbloquear mes" onClick={() => setOpen(open === 'unlock_month' ? null : 'unlock_month')} active={open === 'unlock_month'} />
        <BulkBtn icon={Lock}   label="Bloquear mes"    onClick={() => setOpen(open === 'lock_month' ? null : 'lock_month')} active={open === 'lock_month'} />
        <BulkBtn icon={TagIcon} label="Tag"            onClick={() => setOpen(open === 'tag' ? null : 'tag')} active={open === 'tag'} />
        <BulkBtn icon={ChevronDown} label="Lifecycle"  onClick={() => setOpen(open === 'lifecycle' ? null : 'lifecycle')} active={open === 'lifecycle'} />
        <BulkBtn icon={Megaphone} label="Anuncio"      onClick={() => setOpen(open === 'announce' ? null : 'announce')} active={open === 'announce'} />
        <button onClick={onClear} className="h-8 w-8 flex items-center justify-center rounded-md text-jjl-muted hover:text-white hover:bg-white/5 ml-1">
          <X className="h-4 w-4" />
        </button>

        {/* Popovers */}
        {open === 'unlock_month' && <MonthPopover label="Desbloquear" onPick={(mes) => runBulk('unlock_month', { mes })} busy={busy} />}
        {open === 'lock_month'   && <MonthPopover label="Bloquear"    onPick={(mes) => runBulk('lock_month',   { mes })} busy={busy} />}
        {open === 'tag'          && <TagPopover onSubmit={(tag, mode) => runBulk('tag', { tag, mode })} busy={busy} />}
        {open === 'lifecycle'    && <LifecyclePopover onPick={(lc) => runBulk('lifecycle', { lifecycle_stage: lc })} busy={busy} />}
        {open === 'announce'     && <AnnouncePopover onSubmit={(titulo, mensaje) => runBulk('announce', { titulo, mensaje })} busy={busy} />}
      </div>
    </div>
  );
}

function BulkBtn({ icon: Icon, label, onClick, active }: { icon: typeof X; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${
        active ? 'bg-jjl-red text-white' : 'text-jjl-muted hover:text-white hover:bg-white/5'
      }`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function MonthPopover({ label, onPick, busy }: { label: string; onPick: (mes: number) => void; busy: boolean }) {
  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 bg-jjl-gray border border-jjl-border rounded-xl shadow-2xl p-2 min-w-[200px]">
      <p className="text-[10px] uppercase tracking-wide text-jjl-muted px-2 py-1">{label} mes</p>
      <div className="space-y-0.5">
        {MONTH_RANGES.map((b) => (
          <button key={b.mes} disabled={busy} onClick={() => onPick(b.mes)}
            className="w-full text-left px-2 py-1.5 rounded text-[12px] text-white hover:bg-white/5 disabled:opacity-50">
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagPopover({ onSubmit, busy }: { onSubmit: (tag: string, mode: 'add' | 'remove') => void; busy: boolean }) {
  const [tag, setTag] = useState('');
  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 bg-jjl-gray border border-jjl-border rounded-xl shadow-2xl p-3 min-w-[260px]">
      <p className="text-[10px] uppercase tracking-wide text-jjl-muted mb-1.5">Tag</p>
      <input value={tag} onChange={(e) => setTag(e.target.value.toLowerCase())} placeholder="ej. premium"
        className="w-full h-8 px-2 bg-black/30 border border-jjl-border rounded text-[12px] text-white focus:outline-none focus:border-jjl-red mb-2" />
      <div className="flex gap-1.5">
        <button disabled={!tag.trim() || busy} onClick={() => onSubmit(tag.trim(), 'add')}
          className="flex-1 h-8 rounded bg-jjl-red text-white text-[12px] font-semibold hover:bg-jjl-red-hover disabled:opacity-40">Agregar</button>
        <button disabled={!tag.trim() || busy} onClick={() => onSubmit(tag.trim(), 'remove')}
          className="flex-1 h-8 rounded bg-white/[0.05] text-jjl-muted text-[12px] font-semibold hover:text-white hover:bg-white/10 disabled:opacity-40">Quitar</button>
      </div>
    </div>
  );
}

function LifecyclePopover({ onPick, busy }: { onPick: (lc: string) => void; busy: boolean }) {
  const options = [
    { value: 'prospect', label: 'Prospect' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'active', label: 'Activo' },
    { value: 'at_risk', label: 'At risk' },
    { value: 'paused', label: 'Pausado' },
    { value: 'churned', label: 'Churned' },
  ];
  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 bg-jjl-gray border border-jjl-border rounded-xl shadow-2xl p-2 min-w-[200px]">
      <p className="text-[10px] uppercase tracking-wide text-jjl-muted px-2 py-1">Cambiar lifecycle</p>
      <div className="space-y-0.5">
        {options.map((o) => (
          <button key={o.value} disabled={busy} onClick={() => onPick(o.value)}
            className="w-full text-left px-2 py-1.5 rounded text-[12px] text-white hover:bg-white/5 disabled:opacity-50">{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function AnnouncePopover({ onSubmit, busy }: { onSubmit: (titulo: string, mensaje: string) => void; busy: boolean }) {
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 bg-jjl-gray border border-jjl-border rounded-xl shadow-2xl p-3 min-w-[320px]">
      <p className="text-[10px] uppercase tracking-wide text-jjl-muted mb-1.5">Mandar notif a los seleccionados</p>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título"
        className="w-full h-8 px-2 bg-black/30 border border-jjl-border rounded text-[12px] text-white focus:outline-none focus:border-jjl-red mb-1.5" />
      <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Mensaje" rows={2}
        className="w-full px-2 py-1.5 bg-black/30 border border-jjl-border rounded text-[12px] text-white focus:outline-none focus:border-jjl-red mb-2 resize-none" />
      <button disabled={!titulo.trim() || !mensaje.trim() || busy} onClick={() => onSubmit(titulo.trim(), mensaje.trim())}
        className="w-full h-8 rounded bg-jjl-red text-white text-[12px] font-semibold hover:bg-jjl-red-hover disabled:opacity-40">Enviar</button>
    </div>
  );
}

function buildMsg(action: Action, body: { affected_modules?: number; updated?: number; sent?: number; mes?: number; tag?: string; mode?: string; lifecycle?: string }): string {
  switch (action) {
    case 'unlock_month': return `Desbloqueados ${body.affected_modules || 0} módulos del mes ${body.mes}`;
    case 'lock_month':   return `Bloqueados ${body.affected_modules || 0} módulos del mes ${body.mes}`;
    case 'tag':          return `${body.mode === 'add' ? 'Agregado' : 'Quitado'} tag "${body.tag}" en ${body.updated || 0} alumnos`;
    case 'lifecycle':    return `Lifecycle "${body.lifecycle}" en ${body.updated || 0} alumnos`;
    case 'announce':     return `Notificación enviada a ${body.sent || 0} alumnos`;
  }
}
