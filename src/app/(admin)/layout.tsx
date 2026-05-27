'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, FileSpreadsheet, CalendarClock, Megaphone, Tag, Cloud } from 'lucide-react';

const ADMIN_TABS = [
  { label: 'Alumnos', href: '/admin', icon: Users },
  { label: 'Cursos', href: '/admin/courses', icon: FileSpreadsheet },
  { label: 'Agendas', href: '/admin/agendas', icon: CalendarClock },
  { label: 'Anuncios', href: '/admin/anuncios', icon: Megaphone },
  { label: 'Tags', href: '/admin/tags', icon: Tag },
  { label: 'Drive', href: '/admin/google-drive', icon: Cloud },
];

// Sub-paths con tab propia. "Alumnos" (/admin) es activo solo cuando NO
// estamos en ninguna de estas. (Antes /admin matcheaba cualquier cosa
// que no fuera courses/agendas, por eso "Alumnos" se quedaba activo
// en /admin/reviews, /admin/anuncios, /admin/tags, etc.)
const SUB_PATHS = ADMIN_TABS.filter((t) => t.href !== '/admin').map((t) => t.href);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inSubTab = SUB_PATHS.some((p) => pathname.startsWith(p));

  return (
    <div className="min-h-screen bg-black">
      {/* Admin Header */}
      <header className="bg-jjl-gray border-b border-jjl-border sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white p-1 flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-jjl.png" alt="JJL" width={28} height={28} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate">ADMIN PANEL</h1>
              <p className="text-xs text-jjl-red tracking-widest uppercase -mt-0.5 truncate">Jiu Jitsu Latino</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-jjl-muted hover:text-white transition-colors shrink-0"
          >
            <span className="hidden sm:inline">Volver a la App</span>
            <span className="sm:hidden">← App</span>
          </Link>
        </div>
        {/* Tabs — scrollables en horizontal cuando no entran (mobile) */}
        <div className="flex px-4 lg:px-6 gap-1 overflow-x-auto scrollbar-thin">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.href === '/admin' ? !inSubTab : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-jjl-red text-white'
                    : 'border-transparent text-jjl-muted hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="p-4 lg:p-6">
        {children}
      </main>
    </div>
  );
}
