import type { Metadata } from 'next';
import Link from 'next/link';
import LightContainer from '@/components/cursos/ui/LightContainer';
import CatalogHero from '@/components/cursos/CatalogHero';
import BundleBand from '@/components/cursos/BundleBand';
import CourseCard from '@/components/cursos/CourseCard';
import MethodSection from '@/components/cursos/MethodSection';
import GuaranteeBand from '@/components/cursos/GuaranteeBand';
import FaqAccordion from '@/components/cursos/sales/FaqAccordion';
import { lightButtonClasses } from '@/components/cursos/ui/LightButton';
import { getCatalog } from '@/lib/cursos/queries';
import { catalogCopy } from '@/lib/cursos/catalog-copy';

export const metadata: Metadata = {
  title: 'Cursos de Jiu Jitsu — Jiu Jitsu Latino',
  description:
    'Instruccionales de Jiu Jitsu con sistema de entrenamiento: video + material de estudio + planes para el tatami. Garantía de 7 días.',
};

export default async function CatalogoPage() {
  const { bundles, courses } = await getCatalog();
  const isEmpty = bundles.length === 0 && courses.length === 0;
  const mainBundle = bundles[0] ?? null;

  return (
    <>
      {/* 1 — HERO: promesa + mecanismo + stats */}
      <CatalogHero />

      {/* 2 — OFERTA ESTRELLA: el pack con anchor de precio */}
      {bundles.length > 0 && (
        <LightContainer className="pt-14 sm:pt-20">
          {bundles.map((bundle) => (
            <div key={bundle.id}>
              <BundleBand bundle={bundle} courses={bundle.courses} />
            </div>
          ))}
        </LightContainer>
      )}

      {/* 3 — MÉTODO: el diferenciador (Sistema Híbrido) */}
      <div className="mt-16 sm:mt-24">
        <MethodSection />
      </div>

      {/* 4 — CATÁLOGO de cursos sueltos */}
      <LightContainer className="py-16 sm:py-24" id="cursos">
        {courses.length > 0 && (
          <section>
            <div className="mb-8 flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-cursos-red">
                Instruccionales
              </span>
              <h2 className="font-display text-2xl font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-3xl">
                Elegí la posición que te está costando
              </h2>
              <p className="max-w-2xl text-[15px] leading-relaxed text-cursos-ink-soft">
                Cada instruccional ataca una situación puntual del juego, con el
                mismo sistema: clases en video, material de estudio y planes para
                entrenarlo en tu academia.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </section>
        )}

        {isEmpty && (
          <div className="rounded-2xl border border-dashed border-cursos-line-strong bg-cursos-surface px-8 py-20 text-center">
            <p className="text-lg font-bold text-cursos-ink">
              Todavía no hay cursos publicados
            </p>
            <p className="mt-2 text-[14px] text-cursos-muted">
              Cargá los cursos desde el panel de administración para que aparezcan acá.
            </p>
          </div>
        )}

        {/* 5 — GARANTÍA: risk reversal */}
        {!isEmpty && (
          <div className="mt-16 sm:mt-20">
            <GuaranteeBand
              titulo={catalogCopy.garantia.titulo}
              cuerpo={catalogCopy.garantia.cuerpo}
            />
          </div>
        )}
      </LightContainer>

      {/* 6 — FAQ */}
      {!isEmpty && (
        <LightContainer size="narrow" className="pb-16 sm:pb-20">
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-3xl">
            Preguntas frecuentes
          </h2>
          <div className="mt-6">
            <FaqAccordion faqs={catalogCopy.faqs} />
          </div>
        </LightContainer>
      )}

      {/* 7 — CTA FINAL */}
      {!isEmpty && (
        <LightContainer className="pb-20 sm:pb-28">
          <section className="relative overflow-hidden rounded-3xl bg-cursos-ink p-9 text-center text-white sm:p-14">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(70% 100% at 50% 0%, rgba(220,38,38,0.28), transparent 60%)',
              }}
            />
            <div className="relative">
              <h2 className="font-display mx-auto max-w-2xl text-balance text-3xl font-black tracking-[-0.03em] sm:text-4xl">
                {catalogCopy.cta_final.titulo}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
                {catalogCopy.cta_final.cuerpo}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {mainBundle && (
                  <Link
                    href={`/pack/${mainBundle.slug}`}
                    className={lightButtonClasses('primary', 'lg', false)}
                  >
                    {catalogCopy.cta_final.boton}
                  </Link>
                )}
                <a
                  href="#cursos"
                  className="text-[14px] font-semibold text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  o mirá los cursos sueltos
                </a>
              </div>
              <p className="mt-5 text-[12.5px] text-white/45">
                Garantía de 7 días · Pago único · Acceso por 2 años
              </p>
            </div>
          </section>
        </LightContainer>
      )}
    </>
  );
}
