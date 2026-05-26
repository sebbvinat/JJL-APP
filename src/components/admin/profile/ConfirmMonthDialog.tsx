'use client';

import { useState } from 'react';
import { X, CheckCircle2, Unlock } from 'lucide-react';

interface Props {
  userId: string;
  userName: string;
  currentMesLabel: string;
  nextMesLabel: string | null;
  nextModulesPreview: string[];   // module_id list (informativo)
  onClose: () => void;
  onConfirmed: (info: { mes_completado: number; next_mes: number; unlocked_count: number }) => void;
}

export default function ConfirmMonthDialog({ userId, userName, currentMesLabel, nextMesLabel, nextModulesPreview, onClose, onConfirmed }: Props) {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit() {
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/students/${userId}/confirm-month`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),  // usa currentMes calculado en server
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error confirmando');
      onConfirmed(body);
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
        <div className="bg-jjl-gray border border-jjl-border rounded-2xl p-5 w-full max-w-md shadow-2xl pointer-events-auto animate-scale-in">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-green-500/10 ring-1 ring-green-500/30 text-green-400 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Confirmar {currentMesLabel}</h2>
                <p className="text-[12px] text-jjl-muted">y desbloquear {nextMesLabel || '(no hay próximo mes)'}</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md text-jjl-muted hover:text-white hover:bg-white/5">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 text-[13px] text-white">
            <p>Vas a marcar a <span className="font-semibold">{userName}</span> como que terminó <span className="font-semibold">{currentMesLabel}</span>.</p>

            {nextMesLabel ? (
              <div className="rounded-lg border border-jjl-border bg-white/[0.02] p-3">
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-jjl-muted font-semibold mb-1.5">
                  <Unlock className="h-3 w-3" /> Se van a desbloquear ({nextModulesPreview.length})
                </p>
                {nextModulesPreview.length > 0 ? (
                  <ul className="text-[12px] text-jjl-muted space-y-0.5">
                    {nextModulesPreview.map((id) => <li key={id} className="font-mono">· {id}</li>)}
                  </ul>
                ) : (
                  <p className="text-[12px] text-jjl-muted italic">El alumno no tiene módulos para el próximo mes en su course_data — verificá la planilla primero.</p>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                No hay siguiente mes (puede ser que ya completó el programa). Solo se va a registrar el cierre.
              </p>
            )}

            <p className="text-[11px] text-jjl-muted/80">
              Se le manda notificación al alumno y se loggea en su historial.
            </p>

            {errorMsg && (
              <p className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">{errorMsg}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-jjl-border/40">
            <button onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg text-[13px] text-jjl-muted hover:text-white disabled:opacity-50">Cancelar</button>
            <button onClick={submit} disabled={saving}
              className="h-9 px-4 rounded-lg bg-green-500 text-white text-[13px] font-semibold hover:bg-green-600 disabled:opacity-40">
              {saving ? 'Confirmando…' : 'Confirmar y desbloquear'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
