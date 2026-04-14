'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

import { NAV_ITEMS, ADMIN_NAV } from '@/lib/constants';
import { useUser } from '@/hooks/useUser';

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useUser();
  const isAdmin = profile?.rol === 'admin';

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-gradient-to-b from-jjl-gray via-jjl-gray/95 to-black border-r border-jjl-border h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-jjl-border">
        <div className="relative w-9 h-9 rounded-full bg-white p-1 flex items-center justify-center shrink-0 ring-1 ring-white/20">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full blur-md opacity-40 -z-0"
            style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.6), transparent 70%)' }}
          />
          <Image src="/logo-jjl.png" alt="JJL" width={28} height={28} className="relative z-10" />
        </div>
        <div>
          <h1 className="text-[13px] font-black text-white leading-none tracking-[0.12em]">
            JIU JITSU
          </h1>
          <p className="text-[10px] font-bold text-jjl-red tracking-[0.3em] uppercase mt-1">
            Latino
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.18em] text-jjl-muted/50 font-semibold">
          Entrenamiento
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'text-white bg-white/[0.04]'
                  : 'text-jjl-muted hover:text-white hover:bg-white/[0.03]'
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-jjl-red"
                />
              )}
              <Icon
                className={clsx(
                  'h-[18px] w-[18px] shrink-0 transition-colors',
                  isActive ? 'text-jjl-red' : 'text-jjl-muted group-hover:text-white'
                )}
                strokeWidth={isActive ? 2.2 : 1.9}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="my-4 border-t border-jjl-border/60" />
            <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.18em] text-amber-500/70 font-semibold">
              Admin
            </p>
            {ADMIN_NAV.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'text-amber-400 bg-amber-500/[0.08]'
                      : 'text-amber-500/70 hover:text-amber-400 hover:bg-white/[0.03]'
                  )}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-amber-400"
                    />
                  )}
                  <Icon
                    className="h-[18px] w-[18px] shrink-0"
                    strokeWidth={isActive ? 2.2 : 1.9}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-jjl-border/60">
        <p className="text-[10px] text-jjl-muted/40 text-center tracking-[0.25em] uppercase font-medium">
          JJL Platform <span className="text-jjl-red/60">v1.0</span>
        </p>
      </div>
    </aside>
  );
}
