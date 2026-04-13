'use client';

import { useState } from 'react';
import Link from 'next/link';

import { LogOut, Settings, Menu, X, RefreshCw } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import NotificationBell from '@/components/layout/NotificationBell';
import { NAV_ITEMS, ADMIN_NAV } from '@/lib/constants';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useUser } from '@/hooks/useUser';

export default function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const { profile, signOut } = useUser();
  const isAdmin = profile?.rol === 'admin';

  return (
    <>
      <header className="h-16 bg-jjl-gray border-b border-jjl-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
        {/* Mobile menu button + Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden p-2 text-jjl-muted hover:text-white rounded-lg hover:bg-jjl-gray-light transition-colors"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-full bg-white p-0.5 flex items-center justify-center">
              <img src="/logo-jjl.png" alt="JJL" width={26} height={26} />
            </div>
            <span className="font-bold text-sm">JJL</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { window.location.reload(); }}
            className="p-2 rounded-lg hover:bg-jjl-gray-light text-jjl-muted hover:text-white transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <NotificationBell />
          <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-jjl-gray-light transition-colors"
          >
            <Avatar name={profile?.nombre || 'Usuario'} size="sm" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-12 w-48 bg-jjl-gray border border-jjl-border rounded-xl shadow-xl z-50 py-1">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-jjl-muted hover:text-white hover:bg-jjl-gray-light transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  Configuracion
                </Link>
                <button
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-jjl-gray-light transition-colors w-full"
                  onClick={() => { setMenuOpen(false); signOut(); }}
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesion
                </button>
              </div>
            </>
          )}
        </div>
        </div>
      </header>

      {/* Mobile slide-out nav */}
      {mobileNavOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMobileNavOpen(false)} />
          <nav className="fixed left-0 top-16 bottom-0 w-64 bg-jjl-gray border-r border-jjl-border z-30 lg:hidden px-3 py-4 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-jjl-red/10 text-jjl-red border border-jjl-red/20'
                      : 'text-jjl-muted hover:text-white hover:bg-jjl-gray-light'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
            {isAdmin && ADMIN_NAV.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-2 border-t border-jjl-border pt-3',
                    isActive
                      ? 'bg-yellow-500/10 text-yellow-400 border-t border-jjl-border border-b-0 border-l-0 border-r-0'
                      : 'text-yellow-500/70 hover:text-yellow-400 hover:bg-jjl-gray-light'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </>
      )}
    </>
  );
}
