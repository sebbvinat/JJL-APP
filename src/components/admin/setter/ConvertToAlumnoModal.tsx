'use client';

import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { MONTH_RANGES } from '@/lib/crm';
import type { LeadRowExt } from './Kanban';

interface Props {
  lead: LeadRowExt;
  onClose: () => void;
  onConverted: (info: { user_id: string }) => void;
}

const PLANILLAS = [
  { id: 'livianos', label: 'Livianos' },
  { id: 'medios', label: 'Medios' },
  { id: 'simbio', label: 'Simbio' },
  { id: 'atleticos', label: 'Atléticos' },
];

export default function ConvertToAlumnoModal({ lead, onClose, onConverted }: Props) {
  const [nombre, setNombre] = useState(lead.nombre || '');
  const [email, setEmail] = useState(lead.email || '');
  const [telefono, setTelefono] = useState(lead.telefono || '');
  const [planillaId, setPlanillaId] = useState<string>('livianos');
  const [mesesSel, setMesesSel] = useState<number[]>([0, 1]); // Fundamentos + Mes 1
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function toggleMes(mes: number) {
    setMesesSel((prev) => prev.includes(mes) ? prev.filter((m) => m !== mes) : [...prev, mes].sort((a, b) => a - b));
  }

  async function submit() {
    if (!nombre.trim() || !email.trim() || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          telefono: telefono.trim() || null,
          planilla_id: planillaId,
          meses_iniciales: mesesSel,
          password: password.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error convirtiendo');
      onConverted({ user_id: body.user_id });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-jjl-gray border border-jjl-border rounded-2xl p-5 w-full max-w-lg shadow-2xl pointer-events-auto animate-scale-in max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-green-500/10 ring-1 ring-green-500/30 text-green-400 flex items-center justify-center">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Convertir a alumno</h2>
                <p className="text-[12px] text-jjl-muted">Lead → usuario del programa</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md text-jjl-muted hover:text-white hover:bg-white/5">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-jjl-muted font-semibold mb-1 block">Nombre completo</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={saving}
                className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-jjl-red" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-jjl-muted font-semibold mb-1 block">Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={saving}
                  className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-jjl-red" />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-jjl-muted font-semibold mb-1 block">Teléfono</span>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} disabled={saving}
                  className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-jjl-red" />
              </label>
            </div>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-jjl-muted font-semibold mb-1 block">Planilla</span>
              <select value={planillaId} onChange={(e) => setPlanillaId(e.target.value)} disabled={saving}
                className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-jjl-red">
                {PLANILLAS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-jjl-muted font-semibold mb-1.5">Meses iniciales a desbloquear</p>
              <div className="flex flex-wrap gap-1">
                {MONTH_RANGES.map((b) => {
                  const on = mesesSel.includes(b.mes);
                  return (
                    <button key={b.mes} onClick={() => toggleMes(b.mes)} disabled={saving}
                      className={`h-7 px-2.5 rounded text-[11px] font-semibold border transition-colors ${
                        on ? 'bg-jjl-red border-jjl-red text-white' : 'bg-white/[0.03] border-jjl-border text-jjl-muted hover:text-white'
                      }`}>
                      {b.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-jjl-muted/70 mt-1">Default: Fundamentos + Mes 1. Después seguís desbloqueando 1 mes a la vez desde el perfil.</p>
            </div>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-jjl-muted font-semibold mb-1 block">Contraseña (opcional)</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} disabled={saving} type="text"
                placeholder="Vacío → se le manda magic link por email"
                className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red" />
            </label>

            {errorMsg && (
              <p className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">{errorMsg}</p>
            )}

            <div className="rounded-lg bg-white/[0.02] border border-jjl-border p-3 text-[11px] text-jjl-muted">
              Al confirmar:<br />
              · Se crea el usuario con <code className="text-white">program_member=TRUE</code> y <code className="text-white">lifecycle_stage=onboarding</code>.<br />
              · Se carga la planilla {PLANILLAS.find((p) => p.id === planillaId)?.label}.<br />
              · Se desbloquean los meses seleccionados.<br />
              · Se marca el lead como <code className="text-white">stage=convertido</code>.
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-jjl-border/40">
            <button onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg text-[13px] text-jjl-muted hover:text-white disabled:opacity-50">Cancelar</button>
            <button onClick={submit} disabled={saving || !nombre.trim() || !email.trim()}
              className="h-9 px-4 rounded-lg bg-green-500 text-white text-[13px] font-semibold hover:bg-green-600 disabled:opacity-40">
              {saving ? 'Convirtiendo…' : 'Convertir a alumno'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
