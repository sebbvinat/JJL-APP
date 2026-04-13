'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trophy, BookOpen, Flame, Star, Info } from 'lucide-react';

interface Notification {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leido: boolean;
  created_at: string;
}

const TIPO_ICONS: Record<string, typeof Trophy> = {
  belt: Trophy,
  module: BookOpen,
  streak: Flame,
  achievement: Star,
  system: Info,
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    // Poll every 60s for new notifications
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close panel on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch {}
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, leido: true })));
    setUnreadCount(0);
  }

  function formatTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-jjl-gray-light text-jjl-muted hover:text-white transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-jjl-red text-white text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 max-h-96 bg-jjl-dark border border-jjl-border rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-jjl-border">
            <span className="text-sm font-semibold">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-jjl-red hover:text-jjl-red/80"
              >
                Marcar todas leidas
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-jjl-muted">
                No hay notificaciones
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TIPO_ICONS[n.tipo] || Info;
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-jjl-border/50 hover:bg-jjl-gray-light/30 transition-colors ${
                      !n.leido ? 'bg-jjl-red/5' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`shrink-0 mt-0.5 ${!n.leido ? 'text-jjl-red' : 'text-jjl-muted'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-medium truncate ${!n.leido ? 'text-white' : 'text-jjl-muted'}`}>
                            {n.titulo}
                          </p>
                          <span className="text-[10px] text-jjl-muted shrink-0">{formatTime(n.created_at)}</span>
                        </div>
                        <p className="text-xs text-jjl-muted mt-0.5 line-clamp-2">{n.mensaje}</p>
                      </div>
                      {!n.leido && (
                        <div className="shrink-0 mt-1.5">
                          <div className="w-2 h-2 rounded-full bg-jjl-red" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
