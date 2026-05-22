import type { ReactNode } from 'react';
import Link from 'next/link';

// Layout del panel admin de JJL Cursos. Tema oscuro.
export default function AdminCursosLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-jjl-dark text-white">
      <header className="border-b border-jjl-border bg-jjl-gray">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <span className="text-[15px] font-extrabold">
              JJL Cursos <span className="font-semibold text-jjl-muted">· Admin</span>
            </span>
            <nav className="flex gap-1 text-sm">
              <Link
                href="/admin-cursos"
                className="rounded-lg px-3 py-1.5 font-semibold text-jjl-muted transition-colors hover:bg-white/5 hover:text-white"
              >
                Cursos
              </Link>
              <Link
                href="/admin-cursos/accesos"
                className="rounded-lg px-3 py-1.5 font-semibold text-jjl-muted transition-colors hover:bg-white/5 hover:text-white"
              >
                Accesos
              </Link>
            </nav>
          </div>
          <Link
            href="/"
            className="text-[13px] font-semibold text-jjl-muted transition-colors hover:text-white"
          >
            Ver sitio →
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
