'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LifeBuoy, Send } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type Msg = {
  id: string;
  sender: 'user' | 'admin';
  senderLabel: string;
  contenido: string;
  created_at: string;
  isMine: boolean;
};

export default function SoportePage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/soporte', { cache: 'no-store' });
      const body = await res.json();
      if (body?.setupRequired) {
        setSetupRequired(true);
        setLoading(false);
        return;
      }
      setMessages(body?.messages || []);
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/soporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error al enviar');
      setDraft('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] lg:h-[calc(100dvh-8rem)] max-w-2xl lg:max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-jjl-border/60">
        <div className="h-10 w-10 rounded-full bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
          <LifeBuoy className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Soporte</h1>
          <p className="text-[11px] text-jjl-muted">Nuestro equipo te responde. Contanos qué necesitás.</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3">
        {loading ? (
          <div className="text-[12px] text-jjl-muted text-center py-8">Cargando…</div>
        ) : setupRequired ? (
          <div className="text-[12px] text-jjl-muted text-center py-8">
            Soporte se está configurando. Volvé en un rato.
          </div>
        ) : messages.length === 0 ? (
          <div className="text-[12px] text-jjl-muted text-center py-8">
            Sin mensajes todavía — escribinos abajo y te respondemos a la brevedad.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                m.isMine
                  ? 'bg-jjl-red text-white rounded-br-md'
                  : 'bg-white/[0.05] border border-jjl-border text-white rounded-bl-md'
              }`}>
                {!m.isMine && (
                  <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-jjl-red/80 mb-1">{m.senderLabel}</p>
                )}
                {m.contenido}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Compose */}
      <div className="border-t border-jjl-border/60 pt-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
            }}
            disabled={sending || setupRequired}
            placeholder="Escribí tu consulta…"
            rows={2}
            className="flex-1 resize-none bg-white/[0.03] border border-jjl-border rounded-xl px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending || setupRequired}
            className="h-11 px-4 inline-flex items-center gap-1.5 rounded-xl bg-jjl-red text-white text-sm font-semibold hover:bg-jjl-red-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
