'use client';

import { useState, useEffect, useRef } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Send, MessageCircle, Shield } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import { useUser } from '@/hooks/useUser';

interface Channel {
  channelId: string;
  nombre: string;
  avatar_url: string | null;
  lastMessage: string | null;
  lastAt: string | null;
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
  const isAdmin = profile?.rol === 'admin';
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadChannels();
  }, []);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    // Optimistic add
    setMessages((prev) => [...prev, {
      id: `temp-${Date.now()}`,
      from_user_id: authUser!.id,
      contenido: msg,
      created_at: new Date().toISOString(),
      senderName: profile?.nombre || 'Yo',
      senderAvatar: profile?.avatar_url || null,
      isAdmin: isAdmin || false,
      isMine: true,
    }]);

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: selectedChannel.channelId, contenido: msg }),
    });

    setSending(false);
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
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-jjl-gray-light transition-colors text-left"
              >
                <Avatar src={ch.avatar_url} name={ch.nombre} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{ch.nombre}</span>
                    {ch.lastAt && (
                      <span className="text-[10px] text-jjl-muted">
                        {formatDistanceToNow(new Date(ch.lastAt), { addSuffix: false, locale: es })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-jjl-muted truncate">
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
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-jjl-muted text-sm">No hay mensajes todavia</p>
            <p className="text-xs text-jjl-muted/60 mt-1">Escribi algo para empezar la conversacion</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
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
                  <p className="whitespace-pre-wrap">{msg.contenido}</p>
                  <p className={`text-[10px] mt-1 ${msg.isMine ? 'text-white/50' : 'text-jjl-muted'}`}>
                    {format(new Date(msg.created_at), 'HH:mm')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-jjl-border shrink-0 pb-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-jjl-gray-light border border-jjl-border rounded-xl px-4 py-3 text-base text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="px-5 py-3 bg-jjl-red text-white rounded-xl hover:bg-jjl-red-hover disabled:opacity-50 transition-colors shrink-0 min-w-[48px] min-h-[48px] flex items-center justify-center"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
