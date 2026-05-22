import type { Metadata } from 'next';
import LightContainer from '@/components/cursos/ui/LightContainer';
import CatalogHero from '@/components/cursos/CatalogHero';
import BundleBand from '@/components/cursos/BundleBand';
import CourseCard from '@/components/cursos/CourseCard';
import { getCatalog } from '@/lib/cursos/queries';

export const metadata: Metadata = {
  title: 'Cursos de Jiu Jitsu — Jiu Jitsu Latino',
  description:
    'Instruccionales de Jiu Jitsu Latino: aprendé y dominá posiciones con un sistema de entrenamiento real.',
};

export default async function CatalogoPage() {
  const { bundles, courses } = await getCatalog();
  const isEmpty = bundles.length === 0 && courses.length === 0;

  return (
    <>
      <CatalogHero />

      <LightContainer className="py-16 sm:py-20">
        {bundles.map((bundle) => (
          <div key={bundle.id} className="mb-16 sm:mb-20">
            <BundleBand bundle={bundle} />
          </div>
        ))}

        {courses.length > 0 && (
          <section>
            <div className="mb-8 flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-cursos-red">
                Instruccionales
              </span>
              <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-4xl">
                Cursos sueltos
              </h2>
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
      </LightContainer>
    </>
  );
}
