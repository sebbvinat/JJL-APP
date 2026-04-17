'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { LogOut, Settings, Menu, X, RefreshCw } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import NotificationBell from '@/components/layout/NotificationBell';
import { NAV_ITEMS, ADMIN_NAV } from '@/lib/constants';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';

export default function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const pathname = usePathname();
  const { profile, authUser, signOut } = useUser();
  const isAdmin = profile?.rol === 'admin';

  useEffect(() => {
    if (!authUser) return;
    const supabase = createClient();
    supabase
      .from('users')
      .select('avatar_url')
      .eq('id', authUser.id)
      .single()
      .then(({ data }: { data: { avatar_url?: string } | null }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      });
  }, [authUser]);

  return (
    <>
      <header className="h-16 bg-jjl-gray/80 backdrop-blur-md border-b border-jjl-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
        {/* Mobile menu button + Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label={mobileNavOpen ? 'Cerrar menu' : 'Abrir menu'}
            className="lg:hidden h-11 w-11 flex items-center justify-center text-jjl-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
            <div className="relative w-8 h-8 rounded-full bg-white p-0.5 flex items-center justify-center ring-1 ring-white/20">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur opacity-40"
                style={{
                  background: 'radial-gradient(circle, rgba(220,38,38,0.6), transparent 70%)',
                }}
              />
              <Image
                src="/logo-jjl.png"
                alt="JJL"
                width={26}
                height={26}
                className="relative z-10"
              />
            </div>
            <span className="font-black text-sm tracking-[0.08em]">JJL</span>
          </Link>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => window.location.reload()}
            aria-label="Actualizar"
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-jjl-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <NotificationBell />
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu de usuario"
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <Avatar
                src={avatarUrl || profile?.avatar_url}
                name={profile?.nombre || 'Usuario'}
                size="sm"
              />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-12 w-56 bg-jjl-gray border border-jjl-border rounded-xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] z-50 py-1.5 animate-scale-in origin-top-right">
                  <div className="px-4 py-2.5 border-b border-jjl-border/60">
                    <p className="text-sm font-semibold text-white truncate">
                      {profile?.nombre || 'Usuario'}
                    </p>
                    <p className="text-xs text-jjl-muted truncate">
                      {authUser?.email || ''}
                    </p>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-jjl-muted hover:text-white hover:bg-white/5 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Configuracion
                  </Link>
                  <button
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors w-full"
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesion
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
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden animate-fade-in"
            onClick={() => setMobileNavOpen(false)}
          />
          <nav className="fixed left-0 top-16 bottom-0 w-64 bg-jjl-gray border-r border-jjl-border z-30 lg:hidden px-3 py-4 space-y-0.5 overflow-y-auto animate-slide-in-right">
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
                  onClick={() => setMobileNavOpen(false)}
                  className={clsx(
                    'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
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
                      'h-[18px] w-[18px] shrink-0',
                      isActive ? 'text-jjl-red' : ''
                    )}
                    strokeWidth={isActive ? 2.2 : 1.9}
                  />
                  {item.label}
                </Link>
              );
            })}

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
                      onClick={() => setMobileNavOpen(false)}
                      className={clsx(
                        'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
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
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>
        </>
      )}
    </>
  );
}
