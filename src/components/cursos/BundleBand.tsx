import Link from 'next/link';
import { lightButtonClasses } from './ui/LightButton';
import type { CursosBundle, CursosCourse } from '@/lib/cursos/types';
import { countLessons, priceLabel } from '@/lib/cursos/format';

// Banda destacada del pack en el catálogo. Panel oscuro con anchor de
// precio (suma individual tachada vs precio del pack) y los cursos
// incluidos con sus números reales.
export default function BundleBand({
  bundle,
  courses,
}: {
  bundle: CursosBundle;
  courses: CursosCourse[];
}) {
  const price = priceLabel(bundle.precio_label, bundle.precio);
  const totalIndividual = courses.reduce((acc, c) => acc + (c.precio ?? 0), 0);
  const ahorro =
    bundle.precio != null && totalIndividual > bundle.precio
      ? Math.round((1 - bundle.precio / totalIndividual) * 100)
      : null;
  const totalLecciones = courses.reduce(
    (acc, c) => acc + countLessons(c.curriculum_preview),
    0
  );

  return (
    <div className="relative overflow-hidden rounded-3xl bg-cursos-ink text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(90% 120% at 100% 0%, rgba(220,38,38,0.35), transparent 55%)',
        }}
      />
      <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
        {/* Izquierda — info del pack */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-cursos-red px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
              El más elegido
            </span>
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
              {courses.length} instruccionales
            </span>
          </div>
          <h2 className="font-display mt-5 text-balance text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">
            {bundle.titulo}
          </h2>
          {bundle.subtitulo && (
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
              {bundle.subtitulo}
            </p>
          )}

          {/* cursos incluidos con números reales */}
          <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
            {courses.map((c) => {
              const n = countLessons(c.curriculum_preview);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/10"
                >
                  <span className="text-[13.5px] font-semibold text-white/90">
                    {c.titulo.replace('Fundamento ADN: ', '')}
                  </span>
                  {n > 1 && (
                    <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-white/45">
                      {n} clases
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {totalLecciones > 0 && (
            <p className="mt-5 text-[13px] font-medium text-white/50">
              {totalLecciones} lecciones en video · material de estudio · planes de
              entrenamiento y juegos ecológicos
            </p>
          )}
        </div>

        {/* Derecha — precio anclado + CTA */}
        <div className="flex flex-col justify-center rounded-2xl bg-white/[0.04] p-7 ring-1 ring-white/10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Pack completo
          </p>
          {totalIndividual > 0 && (
            <p className="mt-3 text-[14px] text-white/45">
              <span className="line-through">US$ {totalIndividual}</span>{' '}
              <span className="text-white/55">por separado</span>
            </p>
          )}
          <p className="font-display mt-1 text-[2.9rem] font-black leading-none tracking-[-0.03em]">
            {price}
          </p>
          {ahorro != null && (
            <p className="mt-2 inline-flex">
              <span className="rounded-full bg-cursos-red/20 px-2.5 py-1 text-[12px] font-bold text-red-300">
                Ahorrás el {ahorro}%
              </span>
            </p>
          )}
          <p className="mt-3 text-[13px] text-white/55">Pago único · acceso por 2 años</p>
          <Link
            href={`/pack/${bundle.slug}`}
            className={`${lightButtonClasses('primary', 'lg', true)} mt-6`}
          >
            Ver el pack completo
          </Link>
          <p className="mt-3 text-center text-[12px] text-white/45">
            Garantía de devolución de 7 días
          </p>
        </div>
      </div>
    </div>
  );
}
