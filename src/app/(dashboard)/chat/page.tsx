'use client';

import { useState, useEffect, useRef } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Send, MessageCircle, Search } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';

interface Conversation {
  userId: string;
  nombre: string;
  avatar_url: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  contenido: string;
  created_at: string;
  leido: boolean;
}

export default function ChatPage() {
  const { authUser, profile } = useUser();
  const isAdmin = profile?.rol === 'admin';
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; nombre: string; avatar_url: string | null } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; nombre: string; avatar_url: string | null }[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    loadMessages(selectedUser.id);
    // Poll for new messages every 5s
    pollRef.current = setInterval(() => loadMessages(selectedUser.id), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadConversations() {
    const res = await fetch('/api/messages');
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations || []);
    }
    setLoading(false);
  }

  async function loadMessages(withUserId: string) {
    const res = await fetch(`/api/messages?with=${withUserId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages || []);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || sending) return;
    setSending(true);

    const msg = newMessage.trim();
    setNewMessage('');

    // Optimistic add
    setMessages((prev) => [...prev, {
      id: `temp-${Date.now()}`,
      from_user_id: authUser!.id,
      to_user_id: selectedUser.id,
      contenido: msg,
      created_at: new Date().toISOString(),
      leido: false,
    }]);

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId: selectedUser.id, contenido: msg }),
    });

    setSending(false);
    loadMessages(selectedUser.id);
  }

  async function openNewChat() {
    setShowNewChat(true);
    if (allUsers.length === 0) {
      const supabase = createClient();
      const { data } = await supabase.from('users').select('id, nombre, avatar_url').neq('id', authUser?.id || '');
      setAllUsers((data || []) as any[]);
    }
  }

  function startChat(user: { id: string; nombre: string; avatar_url: string | null }) {
    setSelectedUser(user);
    setShowNewChat(false);
    setSearch('');
  }

  const filteredUsers = allUsers.filter((u) =>
    u.nombre.toLowerCase().includes(search.toLowerCase())
  );

  // Conversation list view
  if (!selectedUser) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Chat</h1>
          <button
            onClick={openNewChat}
            className="px-4 py-2 bg-jjl-red text-white text-sm font-semibold rounded-lg hover:bg-jjl-red-hover transition-colors"
          >
            <MessageCircle className="h-4 w-4 inline mr-1.5" />
            Nuevo
          </button>
        </div>

        {/* New chat - user search */}
        {showNewChat && (
          <Card>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-jjl-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar alumno..."
                autoFocus
                className="w-full pl-10 pr-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-sm text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red"
              />
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => startChat(u)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-jjl-gray-light text-left"
                >
                  <Avatar src={u.avatar_url} name={u.nombre} size="sm" />
                  <span className="text-sm font-medium">{u.nombre}</span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Conversation list */}
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-jjl-gray-light/50 rounded-xl" />)}
          </div>
        ) : conversations.length === 0 && !showNewChat ? (
          <Card>
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-jjl-muted mx-auto mb-3" />
              <p className="text-jjl-muted">No hay conversaciones</p>
              <p className="text-xs text-jjl-muted/60 mt-1">Toca &quot;Nuevo&quot; para iniciar un chat</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.userId}
                onClick={() => startChat({ id: conv.userId, nombre: conv.nombre, avatar_url: conv.avatar_url })}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-jjl-gray-light transition-colors text-left"
              >
                <Avatar src={conv.avatar_url} name={conv.nombre} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{conv.nombre}</span>
                    <span className="text-[10px] text-jjl-muted">
                      {formatDistanceToNow(new Date(conv.lastAt), { addSuffix: false, locale: es })}
                    </span>
                  </div>
                  <p className="text-xs text-jjl-muted truncate">{conv.lastMessage}</p>
                </div>
                {conv.unread > 0 && (
                  <span className="min-w-[20px] h-5 rounded-full bg-jjl-red text-white text-[10px] font-bold flex items-center justify-center px-1.5">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Chat view
  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-lg mx-auto">
      {/* Chat header */}
      <div className="flex items-center gap-3 pb-3 border-b border-jjl-border">
        <button onClick={() => { setSelectedUser(null); loadConversations(); }} className="p-2 rounded-lg hover:bg-jjl-gray-light text-jjl-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar src={selectedUser.avatar_url} name={selectedUser.nombre} size="sm" />
        <span className="font-semibold">{selectedUser.nombre}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.map((msg) => {
          const isMine = msg.from_user_id === authUser?.id;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                isMine
                  ? 'bg-jjl-red text-white rounded-br-md'
                  : 'bg-jjl-gray-light text-white rounded-bl-md'
              }`}>
                <p>{msg.contenido}</p>
                <p className={`text-[10px] mt-1 ${isMine ? 'text-white/50' : 'text-jjl-muted'}`}>
                  {format(new Date(msg.created_at), 'HH:mm')}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-jjl-border">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-jjl-gray-light border border-jjl-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="px-4 py-2.5 bg-jjl-red text-white rounded-xl hover:bg-jjl-red-hover disabled:opacity-50 transition-colors"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
