import type { ReactNode } from 'react';
import CursosHeader from '@/components/cursos/CursosHeader';
import CursosFooter from '@/components/cursos/CursosFooter';

// Layout claro de la tienda JJL Cursos. Usa Inter (la misma tipografia
// que la app de alumnos) sobre superficie blanca.
export default function TiendaLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-theme="cursos-light"
      className="flex min-h-screen flex-col bg-cursos-paper text-cursos-ink antialiased"
    >
      <CursosHeader />
      <div className="flex-1">{children}</div>
      <CursosFooter />
    </div>
  );
}
