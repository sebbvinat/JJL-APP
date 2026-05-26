'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { LogOut, User } from 'lucide-react';

// Menu de usuario para el header de cursos. Muestra el primer nombre
// (o inicial del email) con un dropdown para "Mis cursos" y "Cerrar sesion".
export default function UserMenu({
  nombre,
  email,
}: {
  nombre: string | null;
  email: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const first =
    (nombre && nombre.trim().split(/\s+/)[0]) ||
    (email && email.split('@')[0]) ||
    'Vos';
  const initial = first.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-cursos-line bg-cursos-surface px-1.5 py-1 pr-3 text-sm font-semibold text-cursos-ink transition-colors hover:border-cursos-line-strong"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cursos-red text-[12px] font-bold text-white">
          {initial}
        </span>
        <span className="hidden sm:inline">{first}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-cursos-line bg-cursos-surface shadow-[var(--shadow-cursos)]">
          <div className="border-b border-cursos-line px-4 py-3">
            <p className="truncate text-[13px] font-bold text-cursos-ink">
              {nombre || 'Sesión iniciada'}
            </p>
            {email && (
              <p className="truncate text-[12px] text-cursos-muted">{email}</p>
            )}
          </div>
          <Link
            href="/mis-cursos"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-medium text-cursos-ink hover:bg-black/[0.04]"
          >
            <User size={15} /> Mis cursos
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 border-t border-cursos-line px-4 py-2.5 text-left text-[13.5px] font-medium text-cursos-red hover:bg-cursos-red/[0.05]"
          >
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
