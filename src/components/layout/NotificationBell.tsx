'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Trophy, BookOpen, Flame, Star, Info } from 'lucide-react';

interface Notification {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  url: string | null;
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
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

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

  async function handleClickNotification(n: Notification) {
    setOpen(false);
    // Mark as read in background (don't await so the navigation feels
    // immediate — we update local state optimistically).
    if (!n.leido) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, leido: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: n.id }),
      }).catch(() => {});
    }
    if (n.url) {
      router.push(n.url);
    }
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
        aria-label="Notificaciones"
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

          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-jjl-muted">
                No hay notificaciones
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TIPO_ICONS[n.tipo] || Info;
                const clickable = !!n.url;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={`block w-full text-left px-4 py-3 border-b border-jjl-border/50 transition-colors ${
                      clickable ? 'hover:bg-jjl-gray-light/30 cursor-pointer' : 'cursor-default'
                    } ${!n.leido ? 'bg-jjl-red/5' : ''}`}
                    disabled={!clickable && n.leido}
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
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
