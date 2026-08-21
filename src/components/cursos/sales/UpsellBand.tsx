import Link from 'next/link';
import type { CursosBundle, CursosCourse } from '@/lib/cursos/types';
import { priceLabel } from '@/lib/cursos/format';
import { lightButtonClasses } from '../ui/LightButton';

// Banda de upsell en la página de un curso que forma parte de un pack:
// ancla el precio individual total contra el precio del pack.
export default function UpsellBand({
  bundle,
  bundleCourses,
}: {
  bundle: CursosBundle;
  bundleCourses: CursosCourse[];
}) {
  const totalIndividual = bundleCourses.reduce((acc, c) => acc + (c.precio ?? 0), 0);
  const packPrice = priceLabel(bundle.precio_label, bundle.precio);
  const ahorro =
    bundle.precio != null && totalIndividual > 0
      ? Math.round((1 - bundle.precio / totalIndividual) * 100)
      : null;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-cursos-ink p-7 text-white sm:p-9">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(90% 130% at 100% 0%, rgba(220,38,38,0.4), transparent 55%)',
        }}
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="inline-flex items-center rounded-full bg-cursos-red px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white">
            Mejor precio en el pack
          </span>
          <h3 className="font-display mt-3 text-balance text-2xl font-extrabold tracking-[-0.02em] sm:text-[1.7rem]">
            Este instruccional es parte de {bundle.titulo}
          </h3>
          <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-white/70">
            Los {bundleCourses.length} fundamentos juntos —{' '}
            {bundleCourses.map((c) => c.titulo.replace('Fundamento ADN: ', '')).join(', ')}{' '}
            — por menos de la mitad de lo que cuestan por separado.
          </p>
        </div>
        <div className="shrink-0 lg:text-right">
          <p className="text-[13px] text-white/50">
            <span className="line-through">US$ {totalIndividual} por separado</span>
          </p>
          <p className="font-display mt-1 text-[2.2rem] font-black leading-none tracking-[-0.03em]">
            {packPrice}
          </p>
          {ahorro != null && (
            <p className="mt-1 text-[13px] font-semibold text-cursos-red">
              Ahorrás el {ahorro}%
            </p>
          )}
          <Link
            href={`/pack/${bundle.slug}`}
            className={`${lightButtonClasses('primary', 'md', false)} mt-4`}
          >
            Ver el pack completo →
          </Link>
        </div>
      </div>
    </div>
  );
}
