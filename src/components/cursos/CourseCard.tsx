import Link from 'next/link';
import CourseCover from './CourseCover';
import type { CursosCourse } from '@/lib/cursos/types';

function formatPrice(course: CursosCourse): string {
  if (course.precio_label) return course.precio_label;
  if (course.precio != null) return `$${course.precio}`;
  return '';
}

// Tarjeta de curso del catálogo (tema claro, editorial).
export default function CourseCard({ course }: { course: CursosCourse }) {
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
        <h3 className="text-lg font-bold leading-snug tracking-tight text-cursos-ink">
          {course.titulo}
        </h3>
        {course.instructor && (
          <p className="mt-1.5 text-[13px] font-medium text-cursos-muted">
            con {course.instructor}
          </p>
        )}
        {course.subtitulo && (
          <p className="mt-3 line-clamp-2 text-[14px] leading-relaxed text-cursos-ink-soft">
            {course.subtitulo}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between pt-5">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-cursos-muted">
              Precio
            </span>
            <span className="text-lg font-bold tracking-tight text-cursos-ink">
              {formatPrice(course)}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-cursos-ink px-3.5 py-2 text-[13px] font-semibold text-white transition-transform group-hover:translate-x-0.5">
            Ver curso
            <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
