import Link from 'next/link';
import LightContainer from './ui/LightContainer';

// Footer del producto JJL Cursos (tema claro).
export default function CursosFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-cursos-line bg-cursos-paper">
      <LightContainer className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[15px] font-extrabold tracking-[-0.02em] text-cursos-ink">
            Jiu Jitsu Latino
          </p>
          <p className="mt-1 text-[13px] text-cursos-muted">
            Instruccionales para mejorar tu Jiu Jitsu entrenes lo que entrenes.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] font-medium text-cursos-ink-soft">
          <Link href="/" className="transition-colors hover:text-cursos-red">
            Catálogo
          </Link>
          <Link href="/mis-cursos" className="transition-colors hover:text-cursos-red">
            Mis cursos
          </Link>
          <span className="text-cursos-muted">© {year}</span>
        </nav>
      </LightContainer>
    </footer>
  );
}
