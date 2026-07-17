'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow, isSameDay, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Send, MessageCircle, Shield, Mic, Square, Play, Pause, LifeBuoy, Image as ImageIcon, Trash2, X } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { useUser } from '@/hooks/useUser';

interface Channel {
  channelId: string;
  nombre: string;
  avatar_url: string | null;
  lastMessage: string | null;
  lastAt: string | null;
  hasNew?: boolean;
}

interface Message {
  id: string;
  from_user_id: string;
  contenido: string;
  created_at: string;
  senderName: string;
  senderAvatar: string | null;
  isAdmin: boolean;
  isMine: boolean;
}

export default function ChatPage() {
  const { authUser, profile } = useUser();
  const toast = useToast();
  const isAdmin = profile?.rol === 'admin';
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastMsgCountRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const [supportUnread, setSupportUnread] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    loadChannels();
  }, []);

  // Bandeja de Soporte (admin): contar mensajes sin leer para el shortcut.
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/soporte');
        if (!res.ok || !active) return;
        const data = await res.json();
        type Thread = { unread?: number };
        const total = ((data?.threads || []) as Thread[]).reduce((s, t) => s + (t.unread || 0), 0);
        if (active) setSupportUnread(total);
      } catch { /* silencioso */ }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { active = false; clearInterval(t); };
  }, [isAdmin]);

  // Auto-open for alumnos (they only have 1 channel)
  useEffect(() => {
    if (!isAdmin && channels.length === 1 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, isAdmin, selectedChannel]);

  useEffect(() => {
    if (!selectedChannel) return;
    loadMessages(selectedChannel.channelId);
    pollRef.current = setInterval(() => loadMessages(selectedChannel.channelId), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedChannel]);

  // Auto-scroll only if user is near bottom OR message count changed because of a new message they sent
  useEffect(() => {
    const prevCount = lastMsgCountRef.current;
    lastMsgCountRef.current = messages.length;

    // If no new messages, dont scroll
    if (messages.length <= prevCount) return;

    // If user is at bottom (within 100px), auto-scroll. Otherwise keep position.
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Reset to bottom when switching channels
  useEffect(() => {
    if (selectedChannel) {
      isAtBottomRef.current = true;
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    }
  }, [selectedChannel?.channelId]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 100;
  }

  async function loadChannels() {
    try {
      const res = await fetch('/api/messages');
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch {}
    setLoading(false);
  }

  async function loadMessages(channelId: string) {
    const res = await fetch(`/api/messages?channel=${channelId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages || []);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChannel || sending) return;
    setSending(true);

    const msg = newMessage.trim();
    setNewMessage('');

    const tempId = `temp-${Date.now()}`;
    // Optimistic add
    setMessages((prev) => [...prev, {
      id: tempId,
      from_user_id: authUser!.id,
      contenido: msg,
      created_at: new Date().toISOString(),
      senderName: profile?.nombre || 'Yo',
      senderAvatar: profile?.avatar_url || null,
      isAdmin: isAdmin || false,
      isMine: true,
    }]);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: selectedChannel.channelId, contenido: msg }),
      });
      if (!res.ok) throw new Error('send failed');
    } catch {
      // Revertir el mensaje optimista y devolver el texto al input para no
      // perderlo (antes el fetch fallaba en silencio y el mensaje se
      // "desaparecía" al siguiente poll).
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(msg);
      toast.error('No se pudo enviar el mensaje. Probá de nuevo.');
    }

    setSending(false);
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permitir re-elegir la misma foto
    if (!file || !selectedChannel || sending) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Elegí una imagen.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen es muy grande (máx 10MB).');
      return;
    }
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('channelId', selectedChannel.channelId);
      const res = await fetch('/api/messages/image', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('upload failed');
      await loadMessages(selectedChannel.channelId);
    } catch {
      toast.error('No pudimos enviar la foto. Probá de nuevo.');
    } finally {
      setSending(false);
    }
  }

  // Borrar mensaje (solo admin). Optimista: lo saco de la lista y revierto si
  // el backend falla.
  async function handleDelete(msgId: string) {
    if (!selectedChannel || msgId.startsWith('temp-')) return;
    if (!window.confirm('¿Borrar este mensaje? No se puede deshacer.')) return;
    const prev = messages;
    setMessages((m) => m.filter((x) => x.id !== msgId));
    try {
      const res = await fetch(`/api/messages/${msgId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch {
      setMessages(prev);
      toast.error('No se pudo borrar el mensaje.');
    }
  }

  // Safari iOS NO soporta audio/webm — el constructor de MediaRecorder
  // tiraba NotSupportedError y caía en "no se pudo acceder al micrófono".
  // Elegimos el primer mimeType soportado por el navegador (mp4/aac en iOS,
  // webm/opus en Chrome) y guardamos ese tipo real, así se reproduce en
  // todos lados.
  function pickAudioMime(): { mime: string; ext: string } {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
      return { mime: '', ext: 'webm' };
    }
    const candidates: { mime: string; ext: string }[] = [
      { mime: 'audio/webm;codecs=opus', ext: 'webm' },
      { mime: 'audio/webm', ext: 'webm' },
      { mime: 'audio/mp4', ext: 'mp4' },
      { mime: 'audio/mpeg', ext: 'mp3' },
    ];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    }
    return { mime: '', ext: 'webm' };
  }

  async function startRecording() {
    if (typeof MediaRecorder === 'undefined') {
      toast.error('Tu navegador no permite grabar audio. Probá escribir el mensaje.');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error('No pudimos acceder al micrófono. Revisá los permisos del navegador.');
      return;
    }

    try {
      const { mime, ext } = pickAudioMime();
      const recordType = mime || undefined;
      const mediaRecorder = new MediaRecorder(stream, recordType ? { mimeType: recordType } : undefined);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        setRecordingTime(0);

        const blobType = mediaRecorder.mimeType || mime || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: blobType });
        if (blob.size < 1000) return; // too short

        // Upload — con manejo de error visible (antes fallaba en silencio).
        setSending(true);
        try {
          const formData = new FormData();
          formData.append('audio', blob, `audio.${ext}`);
          formData.append('channelId', selectedChannel!.channelId);
          const res = await fetch('/api/messages/audio', { method: 'POST', body: formData });
          if (!res.ok) throw new Error('upload failed');
          loadMessages(selectedChannel!.channelId);
        } catch {
          toast.error('No pudimos enviar el audio. Probá de nuevo.');
        } finally {
          setSending(false);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
      setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      toast.error('Tu dispositivo no permite grabar audio en este navegador.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }

  // Loading
  if (loading) {
    return (
      <div className="space-y-3 max-w-lg mx-auto animate-pulse">
        <div className="h-12 bg-jjl-gray-light/50 rounded-xl" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-jjl-gray-light/50 rounded-xl" />)}
      </div>
    );
  }

  // Channel list (admin view)
  if (!selectedChannel) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Chat</h1>
          <p className="text-jjl-muted text-sm mt-1">Conversaciones con alumnos</p>
        </div>

        {/* Shortcut a la bandeja de Soporte (admin) — separa visualmente
            las consultas de Soporte de los chats normales con alumnos. */}
        {isAdmin && (
          <Link
            href="/admin/soporte"
            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
              supportUnread > 0
                ? 'bg-jjl-red/10 border-jjl-red/40 hover:bg-jjl-red/15'
                : 'bg-white/[0.02] border-jjl-border hover:bg-white/[0.04]'
            }`}
          >
            <div className="h-10 w-10 rounded-full bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center shrink-0">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Bandeja de Soporte</p>
              <p className="text-[11px] text-jjl-muted">Consultas anónimas — separado de los chats con alumnos</p>
            </div>
            {supportUnread > 0 && (
              <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-jjl-red text-white text-[11px] font-bold shrink-0">
                {supportUnread > 9 ? '9+' : supportUnread}
              </span>
            )}
          </Link>
        )}

        {channels.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-jjl-muted mx-auto mb-3" />
              <p className="text-jjl-muted">No hay alumnos</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-1">
            {channels.map((ch) => (
              <button
                key={ch.channelId}
                onClick={() => setSelectedChannel(ch)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-jjl-gray-light transition-colors text-left ${ch.hasNew ? 'bg-jjl-red/5 border border-jjl-red/20' : ''}`}
              >
                <div className="relative">
                  <Avatar src={ch.avatar_url} name={ch.nombre} />
                  {ch.hasNew && (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-jjl-red border-2 border-jjl-gray" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${ch.hasNew ? 'font-bold text-white' : 'font-semibold'}`}>{ch.nombre}</span>
                    {ch.lastAt && (
                      <span className={`text-[10px] ${ch.hasNew ? 'text-jjl-red font-semibold' : 'text-jjl-muted'}`}>
                        {formatDistanceToNow(new Date(ch.lastAt), { addSuffix: false, locale: es })}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${ch.hasNew ? 'text-white font-medium' : 'text-jjl-muted'}`}>
                    {ch.lastMessage || 'Sin mensajes'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Chat view
  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] lg:h-[calc(100dvh-8rem)] max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-jjl-border shrink-0">
        {isAdmin && (
          <button onClick={() => { setSelectedChannel(null); loadChannels(); }} className="p-2 rounded-lg hover:bg-jjl-gray-light text-jjl-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <Avatar src={selectedChannel.avatar_url} name={selectedChannel.nombre} size="sm" />
        <div>
          <span className="font-semibold text-sm">{isAdmin ? selectedChannel.nombre : 'Chat con tu instructor'}</span>
          <p className="text-[10px] text-jjl-muted">Los admins ven este chat</p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto py-4 space-y-3 overscroll-contain"
      >
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-jjl-muted text-sm">No hay mensajes todavia</p>
            <p className="text-xs text-jjl-muted/60 mt-1">Escribi algo para empezar la conversacion</p>
          </div>
        )}
        {messages.map((msg, i) => {
          // Separador de fecha: solo cuando cambia el día respecto del mensaje
          // anterior (estilo WhatsApp). Así se ve de qué día es cada mensaje
          // sin repetir la fecha en cada burbuja.
          const prev = i > 0 ? messages[i - 1] : null;
          const showDateSep =
            !prev || !isSameDay(new Date(prev.created_at), new Date(msg.created_at));
          return (
          <Fragment key={msg.id}>
          {showDateSep && <DateSeparator iso={msg.created_at} />}
          <div className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.isMine ? '' : 'flex gap-2'}`}>
              {!msg.isMine && (
                <Avatar src={msg.senderAvatar} name={msg.senderName} size="sm" />
              )}
              <div>
                {!msg.isMine && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-semibold text-jjl-muted">{msg.senderName}</span>
                    {msg.isAdmin && <Shield className="h-3 w-3 text-yellow-400" />}
                  </div>
                )}
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                  msg.isMine
                    ? 'bg-jjl-red text-white rounded-br-md'
                    : msg.isAdmin
                      ? 'bg-yellow-500/10 border border-yellow-500/20 text-white rounded-bl-md'
                      : 'bg-jjl-gray-light text-white rounded-bl-md'
                }`}>
                  {msg.contenido.startsWith('[audio]') ? (
                    <audio
                      src={msg.contenido.replace('[audio]', '')}
                      controls
                      preload="metadata"
                      className="max-w-[220px] h-10"
                    />
                  ) : msg.contenido.startsWith('[image]') ? (
                    <button
                      type="button"
                      onClick={() => setLightbox(msg.contenido.replace('[image]', ''))}
                      className="block -mx-1 -mt-0.5"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.contenido.replace('[image]', '')}
                        alt="Foto"
                        loading="lazy"
                        className="rounded-lg max-w-[220px] max-h-[280px] object-cover cursor-zoom-in"
                      />
                    </button>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{msg.contenido}</p>
                  )}
                  <p
                    className={`text-[10px] mt-1 ${msg.isMine ? 'text-white/50' : 'text-jjl-muted'}`}
                    title={format(new Date(msg.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                  >
                    {format(new Date(msg.created_at), 'HH:mm')}
                  </p>
                </div>
                {isAdmin && !msg.id.startsWith('temp-') && (
                  <div className={`mt-0.5 ${msg.isMine ? 'text-right' : 'text-left'}`}>
                    <button
                      type="button"
                      onClick={() => handleDelete(msg.id)}
                      className="inline-flex items-center gap-0.5 text-[10px] text-jjl-muted/60 hover:text-jjl-red transition-colors"
                    >
                      <Trash2 className="h-2.5 w-2.5" /> Borrar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {recording ? (
        <div className="flex items-center gap-3 pt-3 border-t border-jjl-border shrink-0 pb-2">
          <div className="flex-1 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-400 font-medium">Grabando... {recordingTime}s</span>
          </div>
          <button
            onClick={stopRecording}
            className="px-5 py-3 bg-jjl-red text-white rounded-xl hover:bg-jjl-red-hover transition-colors shrink-0 min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            <Square className="h-5 w-5" fill="white" />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-jjl-border shrink-0 pb-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            title="Enviar foto"
            className="px-4 py-3 bg-jjl-gray-light border border-jjl-border text-white rounded-xl hover:bg-jjl-border disabled:opacity-50 transition-colors shrink-0 min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <textarea
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter new line
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as any);
              }
            }}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 bg-jjl-gray-light border border-jjl-border rounded-2xl px-4 py-3 text-base text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red resize-none max-h-[120px] overflow-y-auto"
          />
          {newMessage.trim() ? (
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-3 bg-jjl-red text-white rounded-xl hover:bg-jjl-red-hover disabled:opacity-50 transition-colors shrink-0 min-w-[48px] min-h-[48px] flex items-center justify-center"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={sending}
              className="px-5 py-3 bg-jjl-gray-light border border-jjl-border text-white rounded-xl hover:bg-jjl-border disabled:opacity-50 transition-colors shrink-0 min-w-[48px] min-h-[48px] flex items-center justify-center"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </form>
      )}

      {/* Visor de foto ampliada */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-7 w-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Foto ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Separador de día entre mensajes (estilo WhatsApp). Muestra "Hoy" / "Ayer"
 * para los días recientes y la fecha para el resto. El año solo aparece si el
 * mensaje no es de este año.
 */
function DateSeparator({ iso }: { iso: string }) {
  const d = new Date(iso);
  const label = isToday(d)
    ? 'Hoy'
    : isYesterday(d)
      ? 'Ayer'
      : format(
          d,
          d.getFullYear() === new Date().getFullYear() ? "d 'de' MMMM" : "d 'de' MMMM yyyy",
          { locale: es },
        );
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 h-px bg-jjl-border/50" />
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-jjl-muted px-2.5 py-1 rounded-full bg-white/[0.04] border border-jjl-border/50">
        {label}
      </span>
      <div className="flex-1 h-px bg-jjl-border/50" />
    </div>
  );
}
