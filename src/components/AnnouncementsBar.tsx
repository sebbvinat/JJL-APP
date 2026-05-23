'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Megaphone, AlertTriangle, Info } from 'lucide-react';

type Ann = {
  id: string;
  titulo: string;
  mensaje: string;
  importancia: 'info' | 'warning' | 'critical';
  url: string | null;
  created_at: string;
  expires_at: string | null;
};

const STYLES: Record<Ann['importancia'], { bg: string; border: string; text: string; icon: typeof Info }> = {
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-200', icon: Info },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-200', icon: AlertTriangle },
  critical: { bg: 'bg-jjl-red/15', border: 'border-jjl-red/40', text: 'text-red-100', icon: Megaphone },
};

export default function AnnouncementsBar() {
  const [items, setItems] = useState<Ann[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.announcements || []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000); // chequea cada minuto si hay nuevos
    return () => clearInterval(t);
  }, [load]);

  async function dismiss(id: string) {
    setHidden((prev) => new Set(prev).add(id));   // optimista
    try {
      await fetch(`/api/announcements/${id}/dismiss`, { method: 'POST' });
    } catch { /* silencioso, ya se oculto */ }
  }

  const visible = items.filter((a) => !hidden.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((a) => {
        const s = STYLES[a.importancia] || STYLES.info;
        const Icon = s.icon;
        const body = (
          <div className={`flex items-start gap-3 rounded-xl border ${s.border} ${s.bg} px-4 py-3`}>
            <Icon className={`h-5 w-5 ${s.text} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-semibold ${s.text}`}>{a.titulo}</p>
              <p className="text-[12px] text-white/80 mt-0.5 whitespace-pre-wrap">{a.mensaje}</p>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void dismiss(a.id); }}
              aria-label="Cerrar"
              className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
        return a.url ? (
          <Link key={a.id} href={a.url} className="block hover:opacity-95 transition-opacity">{body}</Link>
        ) : (
          <div key={a.id}>{body}</div>
        );
      })}
    </div>
  );
}
