'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

import { NAV_ITEMS, ADMIN_NAV } from '@/lib/constants';
import { useUser } from '@/hooks/useUser';

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useUser();
  const isAdmin = profile?.rol === 'admin';

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-gradient-to-b from-jjl-gray to-black border-r border-jjl-border h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-jjl-border">
        <div className="w-9 h-9 rounded-full bg-white p-1 flex items-center justify-center shrink-0">
          <img src="/logo-jjl.png" alt="JJL" width={28} height={28} />
        </div>
        <div>
          <h1 className="text-base font-bold text-white leading-tight">JIU JITSU</h1>
          <p className="text-xs font-semibold text-jjl-red tracking-[0.2em] uppercase -mt-0.5">Latino</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-jjl-red/10 text-jjl-red border-l-[3px] border-l-jjl-red border-y border-r border-y-jjl-red/20 border-r-jjl-red/20'
                  : 'text-jjl-muted hover:text-white hover:bg-jjl-gray-light hover:translate-x-0.5'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Admin link */}
      {isAdmin && (
        <div className="px-3 pb-2">
          {ADMIN_NAV.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-yellow-500/10 text-yellow-400 border-l-[3px] border-l-yellow-400 border-y border-r border-y-yellow-500/20 border-r-yellow-500/20'
                    : 'text-yellow-500/70 hover:text-yellow-400 hover:bg-jjl-gray-light hover:translate-x-0.5'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-4 border-t border-jjl-border">
        <p className="text-[10px] text-jjl-muted/40 text-center tracking-widest uppercase font-medium">JJL Platform <span className="text-jjl-red/50">v1.0</span></p>
      </div>
    </aside>
  );
}
