import type { ReactNode } from 'react';

interface PageHeroProps {
  /** Texto chico arriba del título (ej: "Curriculum", "Ranking"). */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Bloque alineado a la derecha (ej: % grande, botón, stat). */
  right?: ReactNode;
  /** Contenido extra debajo del header (ej: barra de progreso). */
  children?: ReactNode;
}

/**
 * Hero de página con la identidad de marca: gradiente rojo→gris + glow
 * radial. Es el mismo patrón que ya usan /modules y /weekly, extraído a
 * componente para que todas las páginas del alumno lo compartan sin
 * copy-paste.
 */
export default function PageHero({ eyebrow, title, subtitle, right, children }: PageHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-jjl-red/15 via-jjl-gray/40 to-transparent p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-10 h-56 w-56 rounded-full blur-3xl opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.5), transparent 70%)' }}
      />
      <div className="relative flex items-end justify-between flex-wrap gap-4">
        <div>
          {eyebrow && (
            <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold mb-1.5">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl font-black text-white tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-jjl-muted mt-1.5">{subtitle}</p>}
        </div>
        {right && <div className="text-right shrink-0">{right}</div>}
      </div>
      {children && <div className="relative mt-5">{children}</div>}
    </div>
  );
}
