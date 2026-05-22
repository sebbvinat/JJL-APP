import type { ReactNode } from 'react';
import { Bricolage_Grotesque } from 'next/font/google';
import CursosHeader from '@/components/cursos/CursosHeader';
import CursosFooter from '@/components/cursos/CursosFooter';

// Tipografía display de marca para los titulares de JJL Cursos.
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-cursos-display',
  display: 'swap',
});

// Layout claro de la tienda JJL Cursos: catálogo y páginas de venta.
// Pinta una superficie clara editorial sobre el <body> oscuro global.
// El visor de curso y el admin definen su propio layout oscuro.
export default function TiendaLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-theme="cursos-light"
      className={`${display.variable} flex min-h-screen flex-col bg-cursos-paper text-cursos-ink antialiased`}
    >
      <CursosHeader />
      <div className="flex-1">{children}</div>
      <CursosFooter />
    </div>
  );
}
