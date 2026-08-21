import Link from 'next/link';
import CourseCover from './CourseCover';
import type { CursosCourse } from '@/lib/cursos/types';
import { countLessons, priceLabel } from '@/lib/cursos/format';

// Tarjeta de curso del catálogo (tema claro, editorial). Muestra los
// números reales del curso: lecciones y módulos venden más que adjetivos.
export default function CourseCard({ course }: { course: CursosCourse }) {
  const lecciones = countLessons(course.curriculum_preview);
  const modulos = (course.curriculum_preview ?? []).length;

  return (
    <Link
      href={`/curso/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-cursos-line bg-cursos-surface shadow-[var(--shadow-cursos-sm)] transition-all duration-200 hover:-translate-y-1 hover:border-cursos-line-strong hover:shadow-[var(--shadow-cursos)]"
    >
      <div className="relative">
        <CourseCover coverUrl={course.cover_url} titulo={course.titulo} />
        {course.nivel && (
          <span
            className="absolute inline-flex items-center rounded-full bg-cursos-paper/95 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-cursos-ink"
            style={{ top: '0.875rem', left: '0.875rem' }}
          >
            {course.nivel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-extrabold leading-snug tracking-[-0.02em] text-cursos-ink">
          {course.titulo}
        </h3>
        {course.instructor && (
          <p className="mt-1.5 text-[13px] font-medium text-cursos-muted">
            con {course.instructor}
          </p>
        )}
        {(course.sales_copy?.subheadline || course.subtitulo) && (
          <p className="mt-3 line-clamp-2 text-[14px] leading-relaxed text-cursos-ink-soft">
            {course.sales_copy?.subheadline || course.subtitulo}
          </p>
        )}

        {lecciones > 1 && (
          <p className="mt-3.5 flex items-center gap-2 text-[12.5px] font-semibold text-cursos-muted">
            <span className="tabular-nums">{lecciones} lecciones</span>
            <span className="h-1 w-1 rounded-full bg-cursos-line-strong" />
            <span className="tabular-nums">{modulos} módulos</span>
          </p>
        )}

        <div className="mt-auto flex items-end justify-between pt-5">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-cursos-muted">
              Pago único
            </span>
            <span className="font-display text-xl font-extrabold tracking-[-0.02em] text-cursos-ink">
              {priceLabel(course.precio_label, course.precio)}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-cursos-ink px-3.5 py-2 text-[13px] font-semibold text-white transition-all group-hover:bg-cursos-red">
            Ver curso
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
