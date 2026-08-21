import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import LightContainer from '@/components/cursos/ui/LightContainer';
import CourseCover from '@/components/cursos/CourseCover';
import BuyButton from '@/components/cursos/sales/BuyButton';
import FaqAccordion from '@/components/cursos/sales/FaqAccordion';
import CurriculumAccordion from '@/components/cursos/sales/CurriculumAccordion';
import GuaranteeBand from '@/components/cursos/GuaranteeBand';
import { getBundleBySlug } from '@/lib/cursos/queries';
import { accesoLabel, priceLabel, countLessons } from '@/lib/cursos/format';
import type { CurriculumPreviewSection } from '@/lib/cursos/types';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBundleBySlug(slug);
  if (!data) return { title: 'Pack no encontrado' };
  return {
    title: `${data.bundle.titulo} — Jiu Jitsu Latino`,
    description: data.bundle.sales_copy?.subheadline ?? data.bundle.subtitulo ?? undefined,
  };
}

export default async function PackPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getBundleBySlug(slug);
  if (!data) notFound();

  const { bundle, courses } = data;
  const sc = bundle.sales_copy ?? {};
  const precio = priceLabel(bundle.precio_label, bundle.precio);
  const totalIndividual = courses.reduce((acc, c) => acc + (c.precio ?? 0), 0);
  const ahorro =
    bundle.precio != null && totalIndividual > bundle.precio
      ? Math.round((1 - bundle.precio / totalIndividual) * 100)
      : null;
  const totalLecciones = courses.reduce(
    (acc, c) => acc + countLessons(c.curriculum_preview),
    0
  );

  // Currículum agregado: cada curso como "módulo" del pack, con sus
  // módulos internos como items.
  const packCurriculum: CurriculumPreviewSection[] = courses.map((c) => ({
    titulo: c.titulo.replace('Fundamento ADN: ', ''),
    lecciones: (c.curriculum_preview ?? []).map((s) =>
      s.lecciones.length > 1 ? `${s.titulo} (${s.lecciones.length} clases)` : s.titulo
    ),
  }));

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
            <div className="lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-cursos-red px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                  Pack · {courses.length} instruccionales
                </span>
                {totalLecciones > 0 && (
                  <span className="inline-flex items-center rounded-full bg-black/[0.05] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-cursos-ink-soft">
                    {totalLecciones} lecciones
                  </span>
                )}
              </div>
              <h1 className="font-display mt-4 text-balance text-[2.4rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-cursos-ink sm:text-5xl lg:text-[3.3rem]">
                {sc.headline || bundle.titulo}
              </h1>
              {(sc.subheadline || bundle.subtitulo) && (
                <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-cursos-ink-soft sm:text-[18px]">
                  {sc.subheadline || bundle.subtitulo}
                </p>
              )}

              {/* las 4 situaciones */}
              <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
                {courses.map((c) => {
                  const n = countLessons(c.curriculum_preview);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-cursos-line bg-cursos-surface px-4 py-3"
                    >
                      <span className="text-[14px] font-semibold text-cursos-ink">
                        {c.titulo.replace('Fundamento ADN: ', '')}
                      </span>
                      {n > 1 && (
                        <span className="shrink-0 text-[12px] font-bold tabular-nums text-cursos-muted">
                          {n} clases
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* tarjeta de compra con anchor */}
            <aside>
              <div className="lg:sticky lg:top-24 rounded-2xl border border-cursos-line bg-cursos-surface p-6 shadow-[var(--shadow-cursos)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cursos-muted">
                  Pack completo
                </p>
                {totalIndividual > 0 && (
                  <p className="mt-2 text-[14px] text-cursos-muted">
                    <span className="line-through">US$ {totalIndividual}</span> por
                    separado
                  </p>
                )}
                <p className="font-display mt-1 text-[2.4rem] font-extrabold leading-none tracking-[-0.03em] text-cursos-ink">
                  {precio}
                </p>
                {ahorro != null && (
                  <p className="mt-2">
                    <span className="rounded-full bg-cursos-red/10 px-2.5 py-1 text-[12px] font-bold text-cursos-red">
                      Ahorrás el {ahorro}%
                    </span>
                  </p>
                )}
                <div className="mt-5">
                  <BuyButton paymentUrl={bundle.payment_url} label="Comprar el pack" />
                </div>
                <p className="mt-3 text-center text-[12px] text-cursos-muted">
                  Garantía de devolución de 7 días
                </p>
                <ul className="mt-5 space-y-2.5 border-t border-cursos-line pt-5 text-[14px] text-cursos-ink-soft">
                  {[
                    `${courses.length} instruccionales completos`,
                    totalLecciones > 0 ? `${totalLecciones} lecciones en video` : null,
                    'Material de estudio en las clases técnicas',
                    'Planes de entrenamiento y juegos ecológicos',
                    accesoLabel(bundle.duracion_acceso_meses),
                  ]
                    .filter((x): x is string => Boolean(x))
                    .map((item) => (
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
        {/* problema */}
        {sc.problema && sc.problema.length > 0 && (
          <div className="space-y-8">
            {sc.problema.map((block) => (
              <section
                key={block.titulo}
                className="rounded-2xl border-l-4 border-cursos-red bg-cursos-paper p-6 sm:p-8"
              >
                <h2 className="font-display text-[1.4rem] font-extrabold tracking-[-0.02em] text-cursos-ink sm:text-2xl">
                  {block.titulo}
                </h2>
                <p className="mt-3 text-[16px] leading-relaxed text-cursos-ink-soft">
                  {block.cuerpo}
                </p>
              </section>
            ))}
          </div>
        )}

        {bundle.descripcion && !sc.problema?.length && (
          <p className="text-[18px] leading-relaxed text-cursos-ink-soft">
            {bundle.descripcion}
          </p>
        )}

        {/* solución */}
        {sc.solucion && sc.solucion.length > 0 && (
          <div className="mt-12 space-y-10">
            {sc.solucion.map((block, i) => (
              <section key={block.titulo} className="flex gap-5">
                <span
                  className="font-display hidden shrink-0 text-[2rem] font-black leading-none tracking-[-0.03em] text-cursos-red/20 sm:block"
                  aria-hidden
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h2 className="font-display text-[1.5rem] font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-[1.7rem]">
                    {block.titulo}
                  </h2>
                  <p className="mt-3 text-[16px] leading-relaxed text-cursos-ink-soft">
                    {block.cuerpo}
                  </p>
                </div>
              </section>
            ))}
          </div>
        )}
      </LightContainer>

      {/* qué incluye — cards de cursos (ancho completo) */}
      {courses.length > 0 && (
        <LightContainer className="pb-4">
          <h2 className="font-display text-[1.7rem] font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-3xl">
            Qué incluye el pack
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {courses.map((course, i) => {
              const n = countLessons(course.curriculum_preview);
              return (
                <div
                  key={course.id}
                  className="flex gap-4 rounded-2xl border border-cursos-line bg-cursos-surface p-4"
                >
                  <div className="w-28 shrink-0 sm:w-32">
                    <CourseCover
                      coverUrl={course.cover_url}
                      titulo={course.titulo}
                      ratio="1 / 1"
                      rounded="rounded-xl"
                      showTitle={false}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-cursos-muted">
                      Instruccional {i + 1}
                      {course.precio != null && (
                        <span className="ml-2 text-cursos-red">
                          US$ {course.precio} suelto
                        </span>
                      )}
                    </span>
                    <h3 className="font-display mt-1 text-[17px] font-extrabold leading-snug tracking-[-0.02em] text-cursos-ink">
                      {course.titulo.replace('Fundamento ADN: ', '')}
                    </h3>
                    {(course.sales_copy?.subheadline || course.subtitulo) && (
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-cursos-ink-soft">
                        {course.sales_copy?.subheadline || course.subtitulo}
                      </p>
                    )}
                    {n > 1 && (
                      <p className="mt-auto pt-2 text-[12px] font-bold tabular-nums text-cursos-muted">
                        {n} lecciones
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </LightContainer>
      )}

      <LightContainer size="narrow" className="py-10 sm:py-14">
        {/* value stack */}
        {totalIndividual > 0 && bundle.precio != null && (
          <section className="overflow-hidden rounded-2xl border border-cursos-line bg-cursos-surface">
            <div className="divide-y divide-cursos-line">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 px-6 py-3.5"
                >
                  <span className="text-[14.5px] font-medium text-cursos-ink">
                    {c.titulo.replace('Fundamento ADN: ', '')}
                  </span>
                  <span className="text-[14.5px] font-semibold tabular-nums text-cursos-ink-soft">
                    US$ {c.precio ?? 0}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 px-6 py-3.5">
                <span className="text-[14.5px] font-bold text-cursos-ink">
                  Total por separado
                </span>
                <span className="text-[15px] font-bold tabular-nums text-cursos-muted line-through">
                  US$ {totalIndividual}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 bg-cursos-ink px-6 py-4 text-white">
                <span className="font-display text-[16px] font-extrabold tracking-[-0.01em]">
                  El pack completo
                </span>
                <span className="flex items-center gap-3">
                  {ahorro != null && (
                    <span className="rounded-full bg-cursos-red px-2.5 py-1 text-[11px] font-bold">
                      −{ahorro}%
                    </span>
                  )}
                  <span className="font-display text-[20px] font-extrabold tabular-nums tracking-[-0.02em]">
                    {precio}
                  </span>
                </span>
              </div>
            </div>
          </section>
        )}

        {/* currículum agregado */}
        {packCurriculum.length > 0 && totalLecciones > 0 && (
          <section className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-[1.6rem] font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-3xl">
                Todo el contenido del pack
              </h2>
              <p className="text-[13px] font-semibold text-cursos-muted">
                {courses.length} instruccionales · {totalLecciones} lecciones
              </p>
            </div>
            <div className="mt-5">
              <CurriculumAccordion sections={packCurriculum} unitLabel="módulo" />
            </div>
          </section>
        )}

        {/* para quién */}
        {sc.para_quien && sc.para_quien.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-[1.6rem] font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-3xl">
              Para quién es
            </h2>
            <ul className="mt-5 space-y-3">
              {sc.para_quien.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-3 text-[15.5px] leading-relaxed text-cursos-ink-soft"
                >
                  <span className="mt-1 font-bold text-cursos-red">→</span>
                  {p}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* garantía */}
        {sc.garantia && (
          <section className="mt-14">
            <GuaranteeBand titulo={sc.garantia.titulo} cuerpo={sc.garantia.cuerpo} />
          </section>
        )}

        {/* FAQs */}
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
        <section className="relative mt-16 overflow-hidden rounded-3xl bg-cursos-ink p-8 text-center text-white sm:p-12">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(70% 100% at 50% 0%, rgba(220,38,38,0.28), transparent 60%)',
            }}
          />
          <div className="relative">
            <h2 className="font-display text-balance text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              {bundle.titulo}
            </h2>
            <p className="mt-3 text-[15px] text-white/65">
              {courses.length} instruccionales · {precio} ·{' '}
              {accesoLabel(bundle.duracion_acceso_meses).toLowerCase()}
            </p>
            {totalIndividual > 0 && (
              <p className="mt-1.5 text-[13px] text-white/45">
                <span className="line-through">US$ {totalIndividual} por separado</span>
                {ahorro != null && <span> · ahorrás el {ahorro}%</span>}
              </p>
            )}
            <div className="mx-auto mt-6 max-w-xs">
              <BuyButton paymentUrl={bundle.payment_url} label="Comprar el pack" />
            </div>
          </div>
        </section>
      </LightContainer>

      {/* barra de compra fija (mobile) */}
      <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-cursos-line bg-cursos-surface/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-cursos-muted">
            {totalIndividual > 0 ? (
              <span className="line-through">US$ {totalIndividual}</span>
            ) : (
              'Pack'
            )}
          </p>
          <p className="font-display text-xl font-extrabold leading-none text-cursos-ink">
            {precio}
          </p>
        </div>
        <div className="flex-1">
          <BuyButton paymentUrl={bundle.payment_url} label="Comprar pack" size="md" />
        </div>
      </div>
    </article>
  );
}
