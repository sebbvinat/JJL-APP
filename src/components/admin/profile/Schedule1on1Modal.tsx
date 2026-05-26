'use client';

import { useState } from 'react';
import { X, Calendar, Clock, Link as LinkIcon, MessageSquare } from 'lucide-react';

interface Props {
  userId: string;
  userName: string;
  defaultMonthLabel?: string | null;
  onClose: () => void;
  onScheduled: (info: { event_id: string; llamada_id: string }) => void;
}

export default function Schedule1on1Modal({ userId, userName, defaultMonthLabel, onClose, onScheduled }: Props) {
  // Default: mañana a las 10:00 hora local
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const defaultDate = tomorrow.toISOString().slice(0, 10);
  const defaultTime = '10:00';

  const [fecha, setFecha] = useState(defaultDate);
  const [hora, setHora] = useState(defaultTime);
  const [duration, setDuration] = useState(45);
  const [meetLink, setMeetLink] = useState('');
  const [mensaje, setMensaje] = useState(
    defaultMonthLabel ? `Llamada de cierre de ${defaultMonthLabel}. Hablemos de cómo te fue y qué viene.` : ''
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit() {
    if (!fecha || !hora || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      // Construir ISO local
      const iso = new Date(`${fecha}T${hora}:00`).toISOString();
      const res = await fetch(`/api/admin/students/${userId}/schedule-1on1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_hora: iso,
          duration_min: duration,
          meet_link: meetLink.trim() || null,
          mensaje: mensaje.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error agendando');
      onScheduled({ event_id: body.event_id, llamada_id: body.llamada_id });
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
            <div>
              <h2 className="text-lg font-bold text-white">Agendar 1-on-1</h2>
              <p className="text-[12px] text-jjl-muted mt-0.5">con {userName}</p>
            </div>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md text-jjl-muted hover:text-white hover:bg-white/5">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-jjl-muted font-semibold flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" /> Fecha</span>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={saving}
                  className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-jjl-red" />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-jjl-muted font-semibold flex items-center gap-1 mb-1"><Clock className="h-3 w-3" /> Hora</span>
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={saving}
                  className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-jjl-red" />
              </label>
            </div>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-jjl-muted font-semibold mb-1 block">Duración (min)</span>
              <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10))} disabled={saving}
                className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-jjl-red">
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-jjl-muted font-semibold flex items-center gap-1 mb-1"><LinkIcon className="h-3 w-3" /> Meet link (opcional)</span>
              <input type="url" value={meetLink} onChange={(e) => setMeetLink(e.target.value)} disabled={saving}
                placeholder="https://meet.google.com/... o Zoom URL"
                className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red" />
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-jjl-muted font-semibold flex items-center gap-1 mb-1"><MessageSquare className="h-3 w-3" /> Mensaje al alumno (opcional)</span>
              <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} disabled={saving} rows={3} maxLength={500}
                className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red resize-none" />
            </label>

            {errorMsg && (
              <p className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">{errorMsg}</p>
            )}

            <p className="text-[11px] text-jjl-muted/80">
              Se va a crear el evento en /events del alumno + le llega notificación (campanita + push).
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-jjl-border/40">
            <button onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg text-[13px] text-jjl-muted hover:text-white disabled:opacity-50">Cancelar</button>
            <button onClick={submit} disabled={saving || !fecha || !hora}
              className="h-9 px-4 rounded-lg bg-jjl-red text-white text-[13px] font-semibold hover:bg-jjl-red-hover disabled:opacity-40">
              {saving ? 'Agendando…' : 'Agendar 1-on-1'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
