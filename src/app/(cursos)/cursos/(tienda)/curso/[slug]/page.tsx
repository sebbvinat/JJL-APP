import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import LightContainer from '@/components/cursos/ui/LightContainer';
import CourseCover from '@/components/cursos/CourseCover';
import BuyButton from '@/components/cursos/sales/BuyButton';
import FaqAccordion from '@/components/cursos/sales/FaqAccordion';
import CurriculumAccordion from '@/components/cursos/sales/CurriculumAccordion';
import UpsellBand from '@/components/cursos/sales/UpsellBand';
import GuaranteeBand from '@/components/cursos/GuaranteeBand';
import { getCourseBySlug, getBundleForCourse } from '@/lib/cursos/queries';
import {
  accesoLabel,
  priceLabel,
  countLessons,
  countStudyMaterial,
} from '@/lib/cursos/format';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: 'Curso no encontrado' };
  return {
    title: `${course.titulo} — Jiu Jitsu Latino`,
    description: course.sales_copy?.subheadline ?? course.subtitulo ?? undefined,
  };
}

export default async function CursoPage({ params }: PageProps) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const bundleData = await getBundleForCourse(course.id);

  const sc = course.sales_copy ?? {};
  const precio = priceLabel(course.precio_label, course.precio);
  const lecciones = countLessons(course.curriculum_preview);
  const modulos = (course.curriculum_preview ?? []).length;
  const conMaterial = countStudyMaterial(course.curriculum_preview);
  const showNumbers = lecciones > 3;

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
              <div className="flex flex-wrap items-center gap-x-2 text-[12px] font-bold uppercase tracking-[0.12em]">
                {sc.headline && <span className="text-cursos-ink">{course.titulo}</span>}
                {course.nivel && (
                  <>
                    {sc.headline && <span className="text-cursos-line-strong">/</span>}
                    <span className="text-cursos-red">{course.nivel}</span>
                  </>
                )}
                {course.instructor && (
                  <>
                    <span className="text-cursos-line-strong">/</span>
                    <span className="text-cursos-muted">con {course.instructor}</span>
                  </>
                )}
              </div>
              <h1 className="font-display mt-4 text-balance text-[2.4rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-cursos-ink sm:text-5xl lg:text-[3.3rem]">
                {sc.headline || course.titulo}
              </h1>
              {(sc.subheadline || course.subtitulo) && (
                <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-cursos-ink-soft sm:text-[18px]">
                  {sc.subheadline || course.subtitulo}
                </p>
              )}

              {/* números del curso */}
              {showNumbers && (
                <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] font-semibold text-cursos-ink-soft">
                  <li className="tabular-nums">{lecciones} lecciones en video</li>
                  <li className="flex items-center gap-5">
                    <span className="h-1 w-1 rounded-full bg-cursos-line-strong" />
                    <span className="tabular-nums">{modulos} módulos</span>
                  </li>
                  {conMaterial > 0 && (
                    <li className="flex items-center gap-5">
                      <span className="h-1 w-1 rounded-full bg-cursos-line-strong" />
                      <span className="tabular-nums">
                        {conMaterial} clases con material de estudio
                      </span>
                    </li>
                  )}
                </ul>
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
                  Pago único
                </p>
                <p className="font-display mt-1.5 text-[2.4rem] font-extrabold leading-none tracking-[-0.03em] text-cursos-ink">
                  {precio}
                </p>
                <p className="mt-1.5 text-[13px] text-cursos-muted">
                  Sin suscripción · sin cargos ocultos
                </p>

                <div className="mt-5">
                  <BuyButton paymentUrl={course.payment_url} />
                </div>
                <p className="mt-3 text-center text-[12px] text-cursos-muted">
                  Garantía de devolución de 7 días
                </p>

                <ul className="mt-5 space-y-2.5 border-t border-cursos-line pt-5 text-[14px] text-cursos-ink-soft">
                  {[
                    showNumbers ? `${lecciones} lecciones en ${modulos} módulos` : null,
                    conMaterial > 0
                      ? 'Material de estudio en las clases técnicas'
                      : null,
                    'Planes de entrenamiento para el tatami',
                    accesoLabel(course.duracion_acceso_meses),
                    'Mirá desde cualquier dispositivo',
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
        {/* problema — agitación */}
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

        {course.descripcion && !sc.problema?.length && (
          <p className="text-[18px] leading-relaxed text-cursos-ink-soft">
            {course.descripcion}
          </p>
        )}

        {/* solución — el mecanismo */}
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

        {/* highlights */}
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

        {/* currículum — contenido real */}
        {modulos > 0 && showNumbers && (
          <section className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-[1.6rem] font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-3xl">
                El contenido, módulo por módulo
              </h2>
              <p className="text-[13px] font-semibold text-cursos-muted">
                {modulos} módulos · {lecciones} lecciones
              </p>
            </div>
            <div className="mt-5">
              <CurriculumAccordion sections={course.curriculum_preview} />
            </div>
          </section>
        )}

        {/* para quién es */}
        {sc.para_quien && sc.para_quien.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-[1.6rem] font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-3xl">
              Para quién es este curso
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

        {/* bonos */}
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

        {/* upsell al pack */}
        {bundleData && (
          <section className="mt-14">
            <UpsellBand bundle={bundleData.bundle} bundleCourses={bundleData.courses} />
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
              {course.titulo}
            </h2>
            <p className="mt-3 text-[15px] text-white/65">
              {precio} · pago único ·{' '}
              {accesoLabel(course.duracion_acceso_meses).toLowerCase()}
            </p>
            {showNumbers && (
              <p className="mt-1.5 text-[13px] text-white/45">
                {lecciones} lecciones · {modulos} módulos · garantía de 7 días
              </p>
            )}
            <div className="mx-auto mt-6 max-w-xs">
              <BuyButton paymentUrl={course.payment_url} label="Comprar ahora" />
            </div>
          </div>
        </section>
      </LightContainer>

      {/* ---------- barra de compra fija (mobile) ---------- */}
      <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-cursos-line bg-cursos-surface/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-cursos-muted">
            Pago único
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
