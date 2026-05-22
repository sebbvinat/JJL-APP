import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import LightContainer from '@/components/cursos/ui/LightContainer';
import CourseCover from '@/components/cursos/CourseCover';
import BuyButton from '@/components/cursos/sales/BuyButton';
import FaqAccordion from '@/components/cursos/sales/FaqAccordion';
import { getBundleBySlug } from '@/lib/cursos/queries';
import { accesoLabel, priceLabel } from '@/lib/cursos/format';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBundleBySlug(slug);
  if (!data) return { title: 'Pack no encontrado' };
  return {
    title: `${data.bundle.titulo} — Jiu Jitsu Latino`,
    description: data.bundle.subtitulo ?? undefined,
  };
}

export default async function PackPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getBundleBySlug(slug);
  if (!data) notFound();

  const { bundle, courses } = data;
  const sc = bundle.sales_copy ?? {};
  const precio = priceLabel(bundle.precio_label, bundle.precio);

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
              <span className="inline-flex items-center rounded-full bg-cursos-red px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                Pack · {courses.length} cursos
              </span>
              <h1 className="font-display mt-4 text-balance text-[2.4rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-cursos-ink sm:text-5xl lg:text-[3.3rem]">
                {bundle.titulo}
              </h1>
              {(sc.subheadline || bundle.subtitulo) && (
                <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-cursos-ink-soft sm:text-[18px]">
                  {sc.subheadline || bundle.subtitulo}
                </p>
              )}
            </div>

            <aside>
              <div className="lg:sticky lg:top-24 rounded-2xl border border-cursos-line bg-cursos-surface p-6 shadow-[var(--shadow-cursos)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cursos-muted">
                  Pack completo
                </p>
                <p className="font-display mt-1.5 text-[2.4rem] font-extrabold leading-none tracking-[-0.03em] text-cursos-ink">
                  {precio}
                </p>
                <p className="mt-1.5 text-[13px] text-cursos-muted">
                  Pago único · {courses.length} instruccionales
                </p>
                <div className="mt-5">
                  <BuyButton paymentUrl={bundle.payment_url} />
                </div>
                <ul className="mt-6 space-y-2.5 border-t border-cursos-line pt-5 text-[14px] text-cursos-ink-soft">
                  {[
                    accesoLabel(bundle.duracion_acceso_meses),
                    `${courses.length} cursos en un solo programa`,
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
      <LightContainer className="py-14 sm:py-20">
        {bundle.descripcion && (
          <p className="max-w-2xl text-[18px] leading-relaxed text-cursos-ink-soft">
            {bundle.descripcion}
          </p>
        )}

        {/* cursos incluidos */}
        {courses.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-[1.7rem] font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-3xl">
              Qué incluye el pack
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {courses.map((course, i) => (
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
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-cursos-muted">
                      Módulo {i + 1}
                    </span>
                    <h3 className="font-display mt-1 text-[17px] font-extrabold leading-snug tracking-[-0.02em] text-cursos-ink">
                      {course.titulo}
                    </h3>
                    {course.subtitulo && (
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-cursos-ink-soft">
                        {course.subtitulo}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mx-auto mt-14 max-w-2xl">
          {sc.garantia && (
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

          <section className="mt-16 overflow-hidden rounded-3xl bg-cursos-ink p-8 text-center text-white sm:p-12">
            <h2 className="font-display text-balance text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              {bundle.titulo}
            </h2>
            <p className="mt-3 text-[15px] text-white/65">
              {precio} · {courses.length} cursos ·{' '}
              {accesoLabel(bundle.duracion_acceso_meses).toLowerCase()}
            </p>
            <div className="mx-auto mt-6 max-w-xs">
              <BuyButton paymentUrl={bundle.payment_url} label="Comprar el pack" />
            </div>
          </section>
        </div>
      </LightContainer>

      {/* barra de compra fija (mobile) */}
      <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-cursos-line bg-cursos-surface/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-cursos-muted">
            Pack
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
