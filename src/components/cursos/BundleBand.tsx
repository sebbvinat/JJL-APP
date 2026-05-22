import Link from 'next/link';
import { lightButtonClasses } from './ui/LightButton';
import type { CursosBundle } from '@/lib/cursos/types';

// Banda destacada para un pack/bundle. Panel oscuro: foco visual fuerte
// dentro del catálogo claro.
export default function BundleBand({ bundle }: { bundle: CursosBundle }) {
  const highlights = bundle.sales_copy?.highlights ?? [];
  const price = bundle.precio_label ?? (bundle.precio != null ? `$${bundle.precio}` : '');

  return (
    <div className="relative overflow-hidden rounded-3xl bg-cursos-ink text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(90% 120% at 100% 0%, rgba(220,38,38,0.35), transparent 55%)',
        }}
      />
      <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
        {/* Izquierda — info del pack */}
        <div>
          <span className="inline-flex items-center rounded-full bg-cursos-red px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
            Pack
          </span>
          <h2 className="font-display mt-5 text-balance text-4xl font-extrabold leading-[1.03] tracking-[-0.03em] sm:text-[3.1rem]">
            {bundle.titulo}
          </h2>
          {bundle.subtitulo && (
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
              {bundle.subtitulo}
            </p>
          )}
          {highlights.length > 0 && (
            <ul className="mt-7 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {highlights.map((h) => (
                <li key={h} className="flex items-center gap-2.5 text-[14px] text-white/85">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cursos-red" />
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Derecha — precio + CTA */}
        <div className="flex flex-col justify-center rounded-2xl bg-white/[0.04] p-7 ring-1 ring-white/10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Pack completo
          </p>
          <p className="font-display mt-2 text-5xl font-extrabold tracking-[-0.03em]">
            {price}
          </p>
          <p className="mt-1.5 text-[13px] text-white/55">
            Pago único · acceso por 2 años
          </p>
          <Link
            href={`/pack/${bundle.slug}`}
            className={`${lightButtonClasses('primary', 'lg', true)} mt-6`}
          >
            Ver el pack
          </Link>
        </div>
      </div>
    </div>
  );
}
