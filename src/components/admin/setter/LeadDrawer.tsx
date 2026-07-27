'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, MessageSquare, ExternalLink, UserPlus, Send, ChevronDown, Phone as PhoneIcon, DollarSign } from 'lucide-react';
import {
  COMPROMISO_LABEL, ESTADO_LABEL, FORTALEZA_LABEL, LIMITACION_LABEL, VISION_LABEL,
  URGENCIA_LABEL, flagFor, phoneToWaMe,
} from '@/lib/lead-labels';
import { STAGES, type LeadRowExt, type LeadStage } from './Kanban';

type Contact = {
  id: string;
  canal: 'whatsapp' | 'instagram' | 'email' | 'telefono' | 'otro';
  direccion: 'saliente' | 'entrante';
  nota: string | null;
  hecho_por_name?: string | null;
  created_at: string;
};

interface Props {
  lead: LeadRowExt;
  admins: { id: string; nombre: string; tags?: string[] | null }[];
  onClose: () => void;
  onChanged: () => void;       // reload de la lista
  onConvertClick: () => void;
}

export default function LeadDrawer({ lead, admins, onClose, onChanged, onConvertClick }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [savingStage, setSavingStage] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);
  const [newCanal, setNewCanal] = useState<Contact['canal']>('whatsapp');
  const [newDir, setNewDir] = useState<Contact['direccion']>('saliente');
  const [newNota, setNewNota] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Marcar venta
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [saleMonto, setSaleMonto] = useState('');
  const [saleMoneda, setSaleMoneda] = useState('ARS');
  const [saleIsFee, setSaleIsFee] = useState(false);
  const [saleConcepto, setSaleConcepto] = useState('');
  const [savingSale, setSavingSale] = useState(false);
  const [saleMsg, setSaleMsg] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/contacts`, { cache: 'no-store' });
      const data = await res.json();
      setContacts(data?.contacts || []);
    } catch { /* silencioso */ }
  }, [lead.id]);

  useEffect(() => { void loadContacts(); }, [loadContacts]);

  // Sin chequear res.ok, un PATCH fallido no avisaba nada: la tarjeta volvía
  // sola a su estado anterior tras el mutate() y el setter no entendía por qué.
  async function patchLead(patch: Record<string, unknown>, what: string) {
    const res = await fetch(`/api/admin/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `No se pudo cambiar ${what}`);
    }
  }

  async function changeStage(stage: LeadStage) {
    // Marcar "convertido" a mano deja el lead SIN vincular al alumno
    // (converted_user_id queda en null), y ese vínculo es lo único que después
    // permite saber de qué campaña salió cada alumno. Hoy los 10 convertidos
    // están así: nadie usó el botón. Empujamos a "Convertir a alumno", que crea
    // (o reactiva) la cuenta y deja el vínculo hecho.
    if (stage === 'convertido' && !lead.converted_user_id) {
      const usarBoton = window.confirm(
        'Conviene usar "Convertir a alumno": deja este lead vinculado al alumno, ' +
        'y es lo que después permite saber de qué campaña vino.\n\n' +
        'Aceptar → abrir "Convertir a alumno"\n' +
        'Cancelar → marcarlo igual, pero sin vincular',
      );
      if (usarBoton) {
        onConvertClick();
        return;
      }
    }
    setSavingStage(true);
    try {
      await patchLead({ stage }, 'el estado');
      onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    } finally { setSavingStage(false); }
  }

  async function changeAssigned(uid: string | null) {
    setSavingAssign(true);
    try {
      await patchLead({ assigned_to: uid }, 'la asignación');
      onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo cambiar la asignación');
    } finally { setSavingAssign(false); }
  }

  async function addContact() {
    if (savingContact) return;
    setSavingContact(true);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/contacts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canal: newCanal, direccion: newDir, nota: newNota.trim() || null }),
      });
      if (res.ok) {
        setNewNota('');
        await loadContacts();
        onChanged();
      }
    } finally { setSavingContact(false); }
  }

  async function markSale() {
    if (savingSale) return;
    const monto = parseFloat(saleMonto.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.'));
    if (!saleIsFee && (!monto || monto <= 0)) {
      setSaleMsg('Ingresá un monto válido.');
      return;
    }
    setSavingSale(true);
    setSaleMsg(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/mark-sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: saleIsFee ? null : monto,
          moneda: saleMoneda,
          is_fee: saleIsFee,
          concepto: saleConcepto.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo marcar la venta');
      setSaleMsg(
        `✓ ${saleIsFee ? 'Fee' : 'Venta'} registrada${data.comision ? ` · comisión $${Number(data.comision).toLocaleString('es-AR')}` : ''}`,
      );
      setSaleMonto('');
      setSaleConcepto('');
      setSaleIsFee(false);
      setShowSaleForm(false);
      onChanged();
    } catch (e) {
      setSaleMsg(e instanceof Error ? e.message : 'Error al marcar la venta.');
    } finally {
      setSavingSale(false);
    }
  }

  const setters = admins.filter((a) => (a.tags || []).includes('setter'));
  const otherAdmins = admins.filter((a) => !(a.tags || []).includes('setter'));

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-jjl-gray border-l border-jjl-border shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="p-4 border-b border-jjl-border flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-lg font-bold text-white truncate">{lead.nombre || lead.email || 'Sin nombre'}</h2>
              {lead.pais && <span className="text-base">{flagFor(lead.pais)}</span>}
            </div>
            <p className="text-[12px] text-jjl-muted truncate">{lead.email || '—'}</p>
            {lead.scheduled_at && (
              <p className="text-[11px] text-amber-300 mt-0.5">Agendado: {new Date(lead.scheduled_at).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            )}
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md text-jjl-muted hover:text-white hover:bg-white/5 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Stage + Asignación */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-jjl-muted font-semibold mb-1 block">Stage</span>
              <select value={lead.stage || 'nuevo'} onChange={(e) => changeStage(e.target.value as LeadStage)} disabled={savingStage}
                className="w-full bg-white/[0.03] border border-jjl-border rounded-md px-2 py-1.5 text-[12px] text-white focus:outline-none focus:border-jjl-red">
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-jjl-muted font-semibold mb-1 block">Asignado a</span>
              <select value={lead.assigned_to || ''} onChange={(e) => changeAssigned(e.target.value || null)} disabled={savingAssign}
                className="w-full bg-white/[0.03] border border-jjl-border rounded-md px-2 py-1.5 text-[12px] text-white focus:outline-none focus:border-jjl-red">
                <option value="">Sin asignar</option>
                {setters.length > 0 && (
                  <optgroup label="Setters">
                    {setters.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </optgroup>
                )}
                {otherAdmins.length > 0 && (
                  <optgroup label="Otros admins">
                    {otherAdmins.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </optgroup>
                )}
              </select>
            </label>
          </div>

          {actionError && (
            <p className="text-[12px] text-red-400 -mt-2">{actionError}</p>
          )}

          {/* Acciones rápidas (contacto externo) */}
          <div className="flex gap-1.5 flex-wrap">
            {lead.telefono && (
              <a href={phoneToWaMe(lead.telefono) || undefined} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded bg-green-500/10 border border-green-500/30 text-green-300 text-[11px] font-semibold hover:bg-green-500/15">
                <MessageSquare className="h-3 w-3" /> WhatsApp
              </a>
            )}
            {lead.instagram && (
              <a href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-semibold hover:bg-purple-500/15">
                <ExternalLink className="h-3 w-3" /> Instagram
              </a>
            )}
            {lead.calendly_event_uri && (
              <a href={lead.calendly_event_uri} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold hover:bg-amber-500/15">
                <ExternalLink className="h-3 w-3" /> Calendly
              </a>
            )}
            <button
              onClick={() => { setShowSaleForm((v) => !v); setSaleMsg(null); }}
              className="ml-auto inline-flex items-center gap-1 h-8 px-3 rounded bg-green-500/15 border border-green-500/40 text-green-300 text-[11px] font-bold uppercase tracking-wider hover:bg-green-500/25">
              <DollarSign className="h-3 w-3" /> Marcar venta
            </button>
            {lead.stage !== 'convertido' && (
              <button onClick={onConvertClick}
                className="inline-flex items-center gap-1 h-8 px-3 rounded bg-green-500 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-green-600">
                <UserPlus className="h-3 w-3" /> Convertir a alumno
              </button>
            )}
          </div>

          {/* Form: marcar venta / cuota */}
          {showSaleForm && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/[0.04] p-3 space-y-2.5">
              <p className="text-[10px] uppercase tracking-wide text-green-300 font-semibold flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Registrar venta o cuota
              </p>
              <label className="flex items-center gap-2 text-[12px] text-jjl-muted cursor-pointer">
                <input type="checkbox" checked={saleIsFee} onChange={(e) => setSaleIsFee(e.target.checked)}
                  className="accent-green-500 h-3.5 w-3.5" />
                Es fee / reserva (no suma comisión)
              </label>
              {!saleIsFee && (
                <div className="flex gap-1.5">
                  <input
                    type="text" inputMode="numeric" value={saleMonto}
                    onChange={(e) => setSaleMonto(e.target.value)}
                    placeholder="Monto cobrado"
                    className="flex-1 bg-black/30 border border-jjl-border rounded px-2 py-1.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-green-500"
                  />
                  <select value={saleMoneda} onChange={(e) => setSaleMoneda(e.target.value)}
                    className="bg-black/30 border border-jjl-border rounded px-2 text-[12px] text-white focus:outline-none focus:border-green-500">
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              )}
              <input
                type="text" value={saleConcepto}
                onChange={(e) => setSaleConcepto(e.target.value)}
                placeholder="Concepto (opcional) — ej: Cuota 1/3, Reserva…"
                className="w-full bg-black/30 border border-jjl-border rounded px-2 py-1.5 text-[12px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-green-500"
              />
              {saleMsg && <p className="text-[11px] text-amber-300">{saleMsg}</p>}
              <div className="flex gap-1.5">
                <button onClick={markSale} disabled={savingSale}
                  className="flex-1 h-8 inline-flex items-center justify-center gap-1 rounded bg-green-500 text-white text-[12px] font-bold hover:bg-green-600 disabled:opacity-40">
                  {savingSale ? 'Guardando…' : 'Guardar venta'}
                </button>
                <button onClick={() => { setShowSaleForm(false); setSaleMsg(null); }}
                  className="h-8 px-3 rounded border border-jjl-border text-[12px] text-jjl-muted hover:text-white">
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {saleMsg && !showSaleForm && (
            <p className="text-[12px] text-green-300 px-1">{saleMsg}</p>
          )}

          {/* Datos del lead */}
          <div className="rounded-lg border border-jjl-border bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wide text-jjl-muted font-semibold mb-2">Datos</p>
            <dl className="space-y-1 text-[12px]">
              {lead.telefono && <Row k="Teléfono" v={lead.telefono} />}
              {lead.instagram && <Row k="Instagram" v={`@${lead.instagram}`} />}
              {lead.ocupacion && <Row k="Ocupación" v={lead.ocupacion} />}
              {lead.pais && <Row k="País" v={lead.pais} />}
              <Row k="Creado" v={new Date(lead.created_at).toLocaleString('es-AR')} />
            </dl>
          </div>

          {/* Quiz */}
          {(lead.fortaleza || lead.limitacion || lead.estado || lead.vision || lead.compromiso || lead.urgencia) && (
            <div className="rounded-lg border border-jjl-border bg-white/[0.02] p-3">
              <p className="text-[10px] uppercase tracking-wide text-jjl-muted font-semibold mb-2">Quiz</p>
              <dl className="space-y-1.5 text-[12px]">
                {lead.fortaleza && <Row k="Fortaleza" v={FORTALEZA_LABEL[lead.fortaleza] || lead.fortaleza} />}
                {lead.limitacion && <Row k="Limitación" v={LIMITACION_LABEL[lead.limitacion] || lead.limitacion} />}
                {lead.estado && <Row k="Estado" v={ESTADO_LABEL[lead.estado] || lead.estado} />}
                {lead.vision && <Row k="Visión" v={VISION_LABEL[lead.vision] || lead.vision} />}
                {lead.compromiso && <Row k="Compromiso" v={COMPROMISO_LABEL[lead.compromiso] || lead.compromiso} />}
              </dl>

              {/* Disposición a invertir — es LA pregunta que califica al lead,
                  así que va separada y con color, no perdida entre las otras. */}
              <div className="mt-2.5 pt-2.5 border-t border-jjl-border/50">
                <p className="text-[10px] uppercase tracking-wide text-jjl-muted font-semibold mb-1">
                  ¿Dispuesto a invertir?
                </p>
                {lead.urgencia ? (
                  <div
                    className={`rounded-md border px-2.5 py-1.5 text-[12px] font-semibold ${
                      lead.urgencia === 'si'
                        ? 'border-green-500/40 bg-green-500/10 text-green-300'
                        : lead.urgencia === 'no'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : 'border-jjl-border bg-white/[0.03] text-white'
                    }`}
                  >
                    {URGENCIA_LABEL[lead.urgencia] || lead.urgencia}
                  </div>
                ) : (
                  <p className="text-[12px] text-jjl-muted italic">
                    No contestó — completó el quiz antes de que existiera esta pregunta
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Log de contactos */}
          <div className="rounded-lg border border-jjl-border bg-white/[0.02] p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wide text-jjl-muted font-semibold">Historial de contactos ({contacts.length})</p>
            </div>
            {contacts.length === 0 ? (
              <p className="text-[11px] text-jjl-muted italic py-2">Sin contactos registrados.</p>
            ) : (
              <ul className="space-y-1.5 mb-3">
                {contacts.map((c) => (
                  <li key={c.id} className="text-[11px]">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-white">
                        {c.direccion === 'saliente' ? '↗' : '↙'} {c.canal} · {c.hecho_por_name || 'admin'}
                      </span>
                      <span className="text-jjl-muted">{new Date(c.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    {c.nota && <p className="text-jjl-muted mt-0.5 whitespace-pre-wrap">{c.nota}</p>}
                  </li>
                ))}
              </ul>
            )}
            {/* Nuevo contacto */}
            <div className="space-y-1.5 pt-2 border-t border-jjl-border/40">
              <div className="flex gap-1.5">
                <select value={newCanal} onChange={(e) => setNewCanal(e.target.value as Contact['canal'])}
                  className="h-7 bg-black/30 border border-jjl-border rounded px-1.5 text-[11px] text-white focus:outline-none focus:border-jjl-red">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="email">Email</option>
                  <option value="telefono">Teléfono</option>
                  <option value="otro">Otro</option>
                </select>
                <select value={newDir} onChange={(e) => setNewDir(e.target.value as Contact['direccion'])}
                  className="h-7 bg-black/30 border border-jjl-border rounded px-1.5 text-[11px] text-white focus:outline-none focus:border-jjl-red">
                  <option value="saliente">↗ Saliente</option>
                  <option value="entrante">↙ Entrante</option>
                </select>
              </div>
              <textarea value={newNota} onChange={(e) => setNewNota(e.target.value)} rows={2} placeholder="Nota (opcional)…"
                className="w-full bg-black/30 border border-jjl-border rounded px-2 py-1 text-[11px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red resize-none" />
              <button onClick={addContact} disabled={savingContact}
                className="w-full h-7 inline-flex items-center justify-center gap-1 rounded bg-jjl-red text-white text-[11px] font-semibold hover:bg-jjl-red-hover disabled:opacity-40">
                <Send className="h-3 w-3" /> Registrar
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function Row({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-jjl-muted shrink-0">{k}:</span>
      <span className="text-white text-right break-words">{v ?? '—'}</span>
    </div>
  );
}
