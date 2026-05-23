'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, LifeBuoy, Send } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';

type Thread = {
  userId: string;
  nombre: string;
  avatar_url: string | null;
  isAdmin: boolean;
  lastMessage: string;
  lastSender: 'user' | 'admin';
  lastAt: string;
  unread: number;
};

type Msg = {
  id: string;
  sender: 'user' | 'admin';
  adminName: string | null;
  contenido: string;
  created_at: string;
};

export default function AdminSoportePage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const toast = useToast();

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/soporte', { cache: 'no-store' });
      const body = await res.json();
      if (body?.setupRequired) { setSetupRequired(true); setLoading(false); return; }
      setThreads(body?.threads || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void loadThreads();
    const t = setInterval(loadThreads, 12000);
    return () => clearInterval(t);
  }, [loadThreads]);

  const selectedThread = threads.find((t) => t.userId === selectedUserId);

  return (
    <div className="max-w-5xl xl:max-w-6xl mx-auto space-y-5 pb-12">
      <header>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12px] text-jjl-muted hover:text-white mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al panel
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold">Admin</p>
            <h1 className="text-2xl font-black tracking-tight">Soporte</h1>
            <p className="text-sm text-jjl-muted mt-0.5">
              Consultas de alumnos. Los alumnos te ven como &quot;Soporte&quot; (anónimo).
            </p>
          </div>
        </div>
      </header>

      {setupRequired ? (
        <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-6 text-center text-[13px] text-jjl-muted">
          Falta correr la migración SQL <code className="text-jjl-red">support_messages</code> en Supabase.
        </div>
      ) : selectedUserId && selectedThread ? (
        <ThreadView
          thread={selectedThread}
          onBack={() => { setSelectedUserId(null); void loadThreads(); }}
          onSent={() => void loadThreads()}
        />
      ) : (
        <div className="space-y-2">
          {loading ? (
            <p className="text-[12px] text-jjl-muted italic py-8 text-center">Cargando…</p>
          ) : threads.length === 0 ? (
            <p className="text-[12px] text-jjl-muted italic py-8 text-center">Sin consultas todavía.</p>
          ) : (
            threads.map((t) => (
              <button
                key={t.userId}
                onClick={() => setSelectedUserId(t.userId)}
                className="w-full flex items-center gap-3 p-3.5 text-left rounded-xl border border-jjl-border bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <Avatar src={t.avatar_url} name={t.nombre} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-semibold text-white truncate">{t.nombre}</p>
                    {t.isAdmin && (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">Admin</span>
                    )}
                  </div>
                  <p className="text-[12px] text-jjl-muted truncate mt-0.5">
                    {t.lastSender === 'user' ? '' : '↳ Soporte: '}{t.lastMessage}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-jjl-muted">{timeAgo(t.lastAt)}</span>
                  {t.unread > 0 && (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-jjl-red text-white text-[10px] font-bold">
                      {t.unread}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ThreadView({ thread, onBack, onSent }: { thread: Thread; onBack: () => void; onSent: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/soporte/${thread.userId}`, { cache: 'no-store' });
      const body = await res.json();
      setMessages(body?.messages || []);
    } finally { setLoading(false); }
  }, [thread.userId]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 10000);
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
      const res = await fetch(`/api/admin/soporte/${thread.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Error al enviar');
      setDraft('');
      await load();
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar');
    } finally { setSending(false); }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-13rem)]">
      <div className="flex items-center gap-3 pb-3 border-b border-jjl-border/60">
        <button onClick={onBack} className="h-9 w-9 flex items-center justify-center rounded-lg text-jjl-muted hover:text-white hover:bg-white/5">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Avatar src={thread.avatar_url} name={thread.nombre} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{thread.nombre}</p>
          <p className="text-[11px] text-jjl-muted">El alumno te ve como &quot;Soporte&quot;.</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3">
        {loading ? (
          <p className="text-[12px] text-jjl-muted text-center py-8">Cargando…</p>
        ) : messages.length === 0 ? (
          <p className="text-[12px] text-jjl-muted text-center py-8">Sin mensajes.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                m.sender === 'admin'
                  ? 'bg-jjl-red text-white rounded-br-md'
                  : 'bg-white/[0.05] border border-jjl-border text-white rounded-bl-md'
              }`}>
                {m.sender === 'admin' && m.adminName && (
                  <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-white/70 mb-1">
                    Soporte · {m.adminName}
                  </p>
                )}
                {m.contenido}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-jjl-border/60 pt-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
            }}
            disabled={sending}
            placeholder="Respondé como Soporte… (Enter envía, Shift+Enter nueva línea)"
            rows={2}
            className="flex-1 resize-none bg-white/[0.03] border border-jjl-border rounded-xl px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
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

function timeAgo(iso: string): string {
  const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('es-AR');
}
