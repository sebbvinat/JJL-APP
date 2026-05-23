import LightContainer from './ui/LightContainer';

const trust = ['+200 alumnos formados', 'Garantía de 7 días', 'Acceso por años'];

// Hero del catálogo de JJL Cursos. Editorial, tipográfico, con prueba social.
export default function CatalogHero() {
  return (
    <section className="relative overflow-hidden border-b border-cursos-line">
      <LightContainer className="pt-16 pb-12 text-center sm:pt-24 sm:pb-16">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="h-px w-7 bg-cursos-line-strong" />
          <span className="text-[11.5px] font-bold uppercase tracking-[0.24em] text-cursos-red">
            Instruccionales · Jiu Jitsu Latino
          </span>
          <span className="h-px w-7 bg-cursos-line-strong" />
        </div>

        <h1 className="mx-auto max-w-4xl text-4xl font-black leading-tight tracking-tight text-cursos-ink sm:text-5xl lg:text-6xl">
          <span className="block text-balance">Dejá de coleccionar técnicas.</span>
          <span className="mt-1 block text-cursos-red">Dominá la posición.</span>
        </h1>

        <p className="mx-auto mt-7 max-w-2xl text-balance text-[16px] leading-relaxed text-cursos-ink-soft sm:text-[18px]">
          Instruccionales enfocados, con un sistema de entrenamiento real, para que
          apliques lo que estudiás en el tatami — entrenes lo que entrenes.
        </p>

        <ul className="mt-9 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[13px] font-medium text-cursos-muted">
          {trust.map((item, i) => (
            <li key={item} className="flex items-center gap-3">
              {i > 0 && <span className="h-1 w-1 rounded-full bg-cursos-line-strong" />}
              {item}
            </li>
          ))}
        </ul>
      </LightContainer>
    </section>
  );
}
