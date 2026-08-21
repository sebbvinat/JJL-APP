import LightContainer from './ui/LightContainer';
import { catalogCopy } from '@/lib/cursos/catalog-copy';

// Sección "El Sistema Híbrido" del catálogo: el diferenciador central.
// 3 pasos editoriales con numeración grande.
export default function MethodSection() {
  const { kicker, titulo, intro, pasos } = catalogCopy.metodo;
  return (
    <section className="border-y border-cursos-line bg-cursos-paper">
      <LightContainer className="py-16 sm:py-24">
        <div className="max-w-2xl">
          <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-cursos-red">
            {kicker}
          </span>
          <h2 className="font-display mt-3 text-balance text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-cursos-ink sm:text-4xl">
            {titulo}
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-cursos-ink-soft sm:text-[17px]">
            {intro}
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:mt-14 sm:grid-cols-3 sm:gap-6 lg:gap-10">
          {pasos.map((paso, i) => (
            <div key={paso.titulo} className="relative">
              <span
                className="font-display block text-[3.4rem] font-black leading-none tracking-[-0.04em] text-cursos-red/15 sm:text-[4rem]"
                aria-hidden
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="font-display -mt-5 text-[19px] font-extrabold tracking-[-0.02em] text-cursos-ink sm:-mt-6">
                {paso.titulo}
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-cursos-ink-soft">
                {paso.cuerpo}
              </p>
            </div>
          ))}
        </div>
      </LightContainer>
    </section>
  );
}
