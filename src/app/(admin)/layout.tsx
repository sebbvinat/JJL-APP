'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Users, FileSpreadsheet, CalendarClock, Megaphone, Tag, Cloud,
  Video, LifeBuoy, BarChart3, NotebookPen, Film, ChevronDown, MoreHorizontal,
} from 'lucide-react';
import { fetcher } from '@/lib/fetcher';

// Tabs PRIMARIOS — lo que el admin/coach usa todos los días, siempre visible.
// Los que tienen badgeKey muestran un contador de pendientes.
const PRIMARY_TABS = [
  { label: 'Alumnos', href: '/admin', icon: Users },
  { label: 'Revisiones', href: '/admin/reviews', icon: Video, badgeKey: 'reviews' as const },
  { label: 'Soporte', href: '/admin/soporte', icon: LifeBuoy, badgeKey: 'soporte' as const },
  { label: 'Agendas', href: '/admin/agendas', icon: CalendarClock },
];

// Tabs SECUNDARIOS — bajo el menú "Más" para no saturar el header.
const MORE_TABS = [
  { label: 'Editor de videos', href: '/admin/videos', icon: Film },
  { label: 'Cursos / Planillas', href: '/admin/courses', icon: FileSpreadsheet },
  { label: 'Anuncios', href: '/admin/anuncios', icon: Megaphone },
  { label: 'Analíticas', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Diarios', href: '/admin/diaries', icon: NotebookPen },
  { label: 'Tags / Roles', href: '/admin/tags', icon: Tag },
  { label: 'Google Drive', href: '/admin/google-drive', icon: Cloud },
];

const ALL_HREFS = [...PRIMARY_TABS, ...MORE_TABS].map((t) => t.href);
// Sub-paths con tab propia. "Alumnos" (/admin) es activo solo cuando NO
// estamos en ninguna de estas.
const SUB_PATHS = ALL_HREFS.filter((h) => h !== '/admin');

// Setters (admins con tag='setter') solo pueden ver el Kanban de leads.
const SETTER_ALLOWED_PATH = '/admin/agendas';

interface MeResponse {
  user?: { id: string; nombre: string | null; tags?: string[] | null };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const inSubTab = SUB_PATHS.some((p) => pathname.startsWith(p));
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const { data: meData } = useSWR<MeResponse>('/api/auth/me', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const isSetter = !!meData?.user?.tags?.includes('setter');

  // Badges de pendientes (solo para admins no-setter). Refresh 2 min.
  const { data: reviewsData } = useSWR<{ pendingCount: number }>(
    isSetter ? null : '/api/videos?pendingCount=1',
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 120_000, dedupingInterval: 60_000 },
  );
  const { data: soporteData } = useSWR<{ threads?: { unread?: number }[] }>(
    isSetter ? null : '/api/admin/soporte',
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 120_000, dedupingInterval: 60_000 },
  );
  const badges: Record<string, number> = {
    reviews: reviewsData?.pendingCount ?? 0,
    soporte: (soporteData?.threads || []).reduce((s, t) => s + (t.unread || 0), 0),
  };

  // Redirección del setter a /admin/agendas.
  useEffect(() => {
    if (!meData?.user) return;
    if (!isSetter) return;
    if (!pathname.startsWith(SETTER_ALLOWED_PATH)) {
      router.replace(SETTER_ALLOWED_PATH);
    }
  }, [meData, isSetter, pathname, router]);

  // Cerrar el menú "Más" al clickear afuera.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    if (moreOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [moreOpen]);

  // Setter: solo ve la tab Agendas, sin "Más" ni badges.
  const primaryTabs = useMemo(
    () => (isSetter ? PRIMARY_TABS.filter((t) => t.href === SETTER_ALLOWED_PATH) : PRIMARY_TABS),
    [isSetter],
  );
  const moreActive = MORE_TABS.some((t) => pathname.startsWith(t.href));

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-jjl-gray border-b border-jjl-border sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white p-1 flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-jjl.png" alt="JJL" width={28} height={28} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate">
                {isSetter ? 'PANEL SETTER' : 'ADMIN PANEL'}
              </h1>
              <p className="text-xs text-jjl-red tracking-widest uppercase -mt-0.5 truncate">Jiu Jitsu Latino</p>
            </div>
          </div>
          {!isSetter && (
            <Link
              href="/dashboard"
              className="text-sm text-jjl-muted hover:text-white transition-colors shrink-0"
            >
              <span className="hidden sm:inline">Volver a la App</span>
              <span className="sm:hidden">← App</span>
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-stretch px-4 lg:px-6 gap-1 overflow-x-auto scrollbar-thin">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.href === '/admin' ? !inSubTab : pathname.startsWith(tab.href);
            const badge = tab.badgeKey ? badges[tab.badgeKey] : 0;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active ? 'border-jjl-red text-white' : 'border-transparent text-jjl-muted hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
                {badge > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-jjl-red text-white text-[10px] font-bold">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Menú "Más" — solo para admins no-setter */}
          {!isSetter && (
            <div ref={moreRef} className="relative shrink-0 flex items-stretch">
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  moreActive || moreOpen ? 'border-jjl-red text-white' : 'border-transparent text-jjl-muted hover:text-white'
                }`}
              >
                <MoreHorizontal className="h-4 w-4" />
                Más
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 rounded-xl border border-jjl-border bg-jjl-gray shadow-2xl py-1.5 z-50">
                  {MORE_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = pathname.startsWith(tab.href);
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors ${
                          active ? 'text-white bg-white/5' : 'text-jjl-muted hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {tab.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="p-4 lg:p-6">
        {children}
      </main>
    </div>
  );
}
