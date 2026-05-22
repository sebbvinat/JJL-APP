import { clsx } from 'clsx';

// Portada de un curso. Si hay cover_url muestra la imagen; si no, un
// placeholder oscuro tipo póster: aro de marca (eco del logo JJL) +
// el título en tipografía display. Aspecto 3:2 por defecto.
interface CourseCoverProps {
  coverUrl?: string | null;
  titulo: string;
  className?: string;
  /** aspect-ratio CSS (default '3 / 2') */
  ratio?: string;
  rounded?: string;
  /** mostrar el título sobre el placeholder (default true) */
  showTitle?: boolean;
}

export default function CourseCover({
  coverUrl,
  titulo,
  className,
  ratio = '3 / 2',
  rounded = 'rounded-none',
  showTitle = true,
}: CourseCoverProps) {
  return (
    <div
      className={clsx('relative overflow-hidden bg-cursos-ink', rounded, className)}
      style={{ aspectRatio: ratio }}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={titulo}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(115% 90% at 88% 6%, rgba(220,38,38,0.32), transparent 58%), linear-gradient(158deg, #2a2a2a 0%, #0a0a0a 78%)',
            }}
          />
          {/* aro de marca — eco del logo JJL */}
          <div
            className="absolute h-44 w-44 rounded-full border border-white/[0.09]"
            style={{ top: '-3rem', right: '-3rem' }}
          />
          <div
            className="absolute h-28 w-28 rounded-full border border-cursos-red/25"
            style={{ top: '-1.25rem', right: '-1.25rem' }}
          />

          <div className="absolute inset-0 flex flex-col p-5">
            <div className="flex flex-1 items-center justify-center">
              {showTitle && (
                <span className="font-display text-balance text-center text-[1.35rem] font-extrabold uppercase leading-[1.1] tracking-[-0.01em] text-white sm:text-2xl">
                  {titulo}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-[3px] bg-cursos-red" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                Instruccional JJL
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
