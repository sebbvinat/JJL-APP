import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { clsx } from 'clsx';
import CourseCover from './CourseCover';
import { lightButtonClasses } from './ui/LightButton';
import type { MyCourse } from '@/lib/cursos/queries';

// Tarjeta de un curso comprado, en el área "Mis cursos".
export default function MyCourseCard({ item }: { item: MyCourse }) {
  const { course, expiresAt, revoked, completed, total } = item;
  const expired = expiresAt != null && new Date(expiresAt).getTime() < Date.now();
  const inactive = revoked || expired;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const accesoTxt = revoked
    ? 'Acceso revocado'
    : expired
      ? 'Acceso vencido'
      : expiresAt
        ? `Acceso hasta el ${format(new Date(expiresAt), "d 'de' MMMM yyyy", { locale: es })}`
        : 'Acceso de por vida';

  return (
    <div
      className={clsx(
        'flex flex-col overflow-hidden rounded-2xl border border-cursos-line bg-cursos-surface',
        inactive && 'opacity-70'
      )}
    >
      <CourseCover
        coverUrl={course.cover_url}
        titulo={course.titulo}
        ratio="16 / 9"
        showTitle={!course.cover_url}
      />

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-[19px] font-extrabold leading-snug tracking-[-0.02em] text-cursos-ink">
          {course.titulo}
        </h3>

        {/* progreso */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[12px] font-semibold text-cursos-muted">
            <span>
              {completed} de {total} {total === 1 ? 'lección' : 'lecciones'}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
            <div
              className="h-full rounded-full bg-cursos-red"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <p className="mt-4 text-[12.5px] text-cursos-muted">{accesoTxt}</p>

        <div className="mt-auto pt-5">
          {inactive ? (
            <Link
              href={`/curso/${course.slug}`}
              className={lightButtonClasses('outline', 'md', true)}
            >
              Renovar acceso
            </Link>
          ) : (
            <Link
              href={`/ver/${course.slug}`}
              className={lightButtonClasses('ink', 'md', true)}
            >
              {completed > 0 ? 'Continuar' : 'Empezar curso'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
