import Link from 'next/link';
import Image from 'next/image';
import LightContainer from './ui/LightContainer';

// Header del producto JJL Cursos (tema claro). Sticky, editorial.
// Las URLs son limpias: en producción el dominio es jiujitsulatino.com.
export default function CursosHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-cursos-line bg-cursos-paper/85 backdrop-blur-md">
      <LightContainer className="flex h-[68px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-jjl.png"
            alt="Jiu Jitsu Latino"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
          />
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-tight text-cursos-ink">
              Jiu Jitsu Latino
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cursos-red">
              Cursos
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/mis-cursos"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-cursos-ink transition-colors hover:bg-black/[0.05]"
          >
            Mis cursos
          </Link>
        </nav>
      </LightContainer>
    </header>
  );
}
