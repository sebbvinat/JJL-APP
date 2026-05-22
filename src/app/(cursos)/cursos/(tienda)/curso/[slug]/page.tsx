import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import LightContainer from '@/components/cursos/ui/LightContainer';
import CourseCover from '@/components/cursos/CourseCover';
import BuyButton from '@/components/cursos/sales/BuyButton';
import FaqAccordion from '@/components/cursos/sales/FaqAccordion';
import { getCourseBySlug } from '@/lib/cursos/queries';
import { accesoLabel, priceLabel } from '@/lib/cursos/format';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: 'Curso no encontrado' };
  return {
    title: `${course.titulo} — Jiu Jitsu Latino`,
    description: course.subtitulo ?? course.descripcion ?? undefined,
  };
}

export default async function CursoPage({ params }: PageProps) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const sc = course.sales_copy ?? {};
  const precio = priceLabel(course.precio_label, course.precio);

  return (
    <article className="pb-24 lg:pb-0">
      {/* ---------- HERO ---------- */}
      <section className="border-b border-cursos-line">
        <LightContainer className="pt-9 pb-12 sm:pt-12">
          <Link
            href="/"
            className="text-[13px] font-semibold text-cursos-muted transition-colors hover:text-cursos-red"
          >
            ← Catálogo
          </Link>

          <div className="mt-7 grid gap-10 lg:grid-cols-3 lg:gap-14">
            {/* izquierda */}
            <div className="lg:col-span-2">
              <div className="flex flex-wrap items-center text-[12px] font-bold uppercase tracking-[0.12em]">
                {course.nivel && <span className="text-cursos-red">{course.nivel}</span>}
                {course.nivel && course.instructor && (
                  <span className="mx-2 text-cursos-line-strong">/</span>
                )}
                {course.instructor && (
                  <span className="text-cursos-muted">con {course.instructor}</span>
                )}
              </div>
              <h1 className="font-display mt-4 text-balance text-[2.4rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-cursos-ink sm:text-5xl lg:text-[3.3rem]">
                {course.titulo}
              </h1>
              {(sc.subheadline || course.subtitulo) && (
                <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-cursos-ink-soft sm:text-[18px]">
                  {sc.subheadline || course.subtitulo}
                </p>
              )}
              <div className="mt-8">
                <CourseCover
                  coverUrl={course.cover_url}
                  titulo={course.titulo}
                  ratio="16 / 9"
                  rounded="rounded-2xl"
                  showTitle={false}
                />
              </div>
            </div>

            {/* derecha — tarjeta de compra */}
            <aside>
              <div className="lg:sticky lg:top-24 rounded-2xl border border-cursos-line bg-cursos-surface p-6 shadow-[var(--shadow-cursos)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cursos-muted">
                  Precio
                </p>
                <p className="font-display mt-1.5 text-[2.4rem] font-extrabold leading-none tracking-[-0.03em] text-cursos-ink">
                  {precio}
                </p>
                <p className="mt-1.5 text-[13px] text-cursos-muted">Pago único</p>

                <div className="mt-5">
                  <BuyButton paymentUrl={course.payment_url} />
                </div>

                <ul className="mt-6 space-y-2.5 border-t border-cursos-line pt-5 text-[14px] text-cursos-ink-soft">
                  {[
                    accesoLabel(course.duracion_acceso_meses),
                    'Mirá desde cualquier dispositivo',
                    sc.garantia?.titulo ?? 'Contenido grabado, a tu ritmo',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-cursos-red">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </LightContainer>
      </section>

      {/* ---------- CUERPO ---------- */}
      <LightContainer size="narrow" className="py-14 sm:py-20">
        {course.descripcion && (
          <p className="text-[18px] leading-relaxed text-cursos-ink-soft">
            {course.descripcion}
          </p>
        )}

        {sc.solucion && sc.solucion.length > 0 && (
          <div className="mt-12 space-y-10">
            {sc.solucion.map((block) => (
              <section key={block.titulo}>
                <h2 className="font-display text-[1.6rem] font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-3xl">
                  {block.titulo}
                </h2>
                <p className="mt-3 text-[16px] leading-relaxed text-cursos-ink-soft">
                  {block.cuerpo}
                </p>
              </section>
            ))}
          </div>
        )}

        {sc.highlights && sc.highlights.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-[1.6rem] font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-3xl">
              Qué vas a trabajar
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {sc.highlights.map((h) => (
                <li
                  key={h}
                  className="flex items-start gap-3 rounded-xl border border-cursos-line bg-cursos-surface px-4 py-3.5 text-[15px] text-cursos-ink"
                >
                  <span className="mt-0.5 font-bold text-cursos-red">✓</span>
                  {h}
                </li>
              ))}
            </ul>
          </section>
        )}

        {sc.bonos && sc.bonos.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-[1.6rem] font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-3xl">
              Bonus incluidos
            </h2>
            <div className="mt-5 space-y-3">
              {sc.bonos.map((bono) => (
                <div
                  key={bono.titulo}
                  className="flex items-start justify-between gap-4 rounded-xl border border-cursos-line bg-cursos-surface p-5"
                >
                  <div>
                    <p className="text-[15px] font-bold text-cursos-ink">{bono.titulo}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-cursos-ink-soft">
                      {bono.descripcion}
                    </p>
                  </div>
                  {bono.valor && (
                    <span className="shrink-0 rounded-full bg-black/[0.05] px-3 py-1 text-[12px] font-bold text-cursos-ink-soft">
                      {bono.valor}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {sc.garantia && (
          <section className="mt-14">
            <div className="rounded-2xl border border-cursos-line-strong bg-cursos-surface p-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cursos-red">
                Garantía
              </p>
              <h3 className="font-display mt-2 text-xl font-extrabold text-cursos-ink">
                {sc.garantia.titulo}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-cursos-ink-soft">
                {sc.garantia.cuerpo}
              </p>
            </div>
          </section>
        )}

        {sc.faqs && sc.faqs.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-[1.6rem] font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-3xl">
              Preguntas frecuentes
            </h2>
            <div className="mt-5">
              <FaqAccordion faqs={sc.faqs} />
            </div>
          </section>
        )}

        {/* CTA final */}
        <section className="mt-16 overflow-hidden rounded-3xl bg-cursos-ink p-8 text-center text-white sm:p-12">
          <h2 className="font-display text-balance text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            {course.titulo}
          </h2>
          <p className="mt-3 text-[15px] text-white/65">
            {precio} · pago único · {accesoLabel(course.duracion_acceso_meses).toLowerCase()}
          </p>
          <div className="mx-auto mt-6 max-w-xs">
            <BuyButton paymentUrl={course.payment_url} label="Comprar ahora" />
          </div>
        </section>
      </LightContainer>

      {/* ---------- barra de compra fija (mobile) ---------- */}
      <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-cursos-line bg-cursos-surface/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-cursos-muted">
            Precio
          </p>
          <p className="font-display text-xl font-extrabold leading-none text-cursos-ink">
            {precio}
          </p>
        </div>
        <div className="flex-1">
          <BuyButton paymentUrl={course.payment_url} label="Comprar" size="md" />
        </div>
      </div>
    </article>
  );
}
