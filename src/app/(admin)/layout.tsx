'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, FileSpreadsheet } from 'lucide-react';

const ADMIN_TABS = [
  { label: 'Alumnos', href: '/admin', icon: Users },
  { label: 'Cursos', href: '/admin/courses', icon: FileSpreadsheet },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-black">
      {/* Admin Header */}
      <header className="bg-jjl-gray border-b border-jjl-border sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white p-1 flex items-center justify-center shrink-0">
              <img src="/logo-jjl.png" alt="JJL" width={28} height={28} />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">ADMIN PANEL</h1>
              <p className="text-xs text-jjl-red tracking-widest uppercase -mt-0.5">Jiu Jitsu Latino</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-jjl-muted hover:text-white transition-colors"
          >
            Volver a la App
          </Link>
        </div>
        {/* Tabs */}
        <div className="flex px-6 gap-1">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.href === '/admin'
              ? !pathname.startsWith('/admin/courses')
              : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-jjl-red text-white'
                    : 'border-transparent text-jjl-muted hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
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
