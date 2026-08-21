import Link from 'next/link';
import LightContainer from './ui/LightContainer';
import { lightButtonClasses } from './ui/LightButton';
import { catalogCopy } from '@/lib/cursos/catalog-copy';

// Hero del catálogo de JJL Cursos. Editorial y vendedor: promesa,
// mecanismo en una línea, doble CTA y banda de stats reales.
export default function CatalogHero() {
  const { kicker, headline_l1, headline_l2, subheadline, stats } = catalogCopy.hero;

  return (
    <section className="relative overflow-hidden border-b border-cursos-line">
      {/* glow sutil de marca */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(60% 45% at 50% 0%, rgba(220,38,38,0.06), transparent 70%)',
        }}
      />
      <LightContainer className="relative pt-16 pb-0 text-center sm:pt-24">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="h-px w-7 bg-cursos-line-strong" />
          <span className="text-[11.5px] font-bold uppercase tracking-[0.24em] text-cursos-red">
            {kicker}
          </span>
          <span className="h-px w-7 bg-cursos-line-strong" />
        </div>

        <h1 className="font-display mx-auto max-w-4xl text-[2.6rem] font-black leading-[1.04] tracking-[-0.035em] text-cursos-ink sm:text-6xl lg:text-[4.2rem]">
          <span className="block text-balance">{headline_l1}</span>
          <span className="mt-1 block text-balance text-cursos-red">{headline_l2}</span>
        </h1>

        <p className="mx-auto mt-7 max-w-2xl text-balance text-[16px] leading-relaxed text-cursos-ink-soft sm:text-[18px]">
          {subheadline}
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/pack/el-adn-del-jiu-jitsu" className={lightButtonClasses('primary', 'lg', false)}>
            Ver el pack El ADN del Jiu Jitsu
          </Link>
          <a href="#cursos" className={lightButtonClasses('outline', 'lg', false)}>
            Explorar los cursos
          </a>
        </div>
        <p className="mt-4 text-[12.5px] text-cursos-muted">
          Pago único · Garantía de 7 días · Sin suscripción
        </p>

        {/* stats band */}
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 border-t border-cursos-line sm:mt-16 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.etiqueta}
              className={`px-2 py-6 sm:py-7 ${i > 0 ? 'sm:border-l sm:border-cursos-line' : ''} ${i % 2 === 1 ? 'border-l border-cursos-line sm:border-l' : ''}`}
            >
              <p className="font-display text-[1.7rem] font-black leading-none tracking-[-0.03em] text-cursos-ink sm:text-[2rem]">
                {s.valor}
              </p>
              <p className="mt-1.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-cursos-muted">
                {s.etiqueta}
              </p>
            </div>
          ))}
        </div>
      </LightContainer>
    </section>
  );
}
