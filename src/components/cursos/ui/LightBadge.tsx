import { clsx } from 'clsx';

// Etiqueta / chip para el tema claro de JJL Cursos.
type LightBadgeVariant = 'default' | 'red' | 'ink' | 'outline';

const variants: Record<LightBadgeVariant, string> = {
  default: 'bg-black/[0.05] text-cursos-ink-soft',
  red: 'bg-cursos-red text-white',
  ink: 'bg-cursos-ink text-white',
  outline: 'border border-cursos-line-strong text-cursos-ink-soft',
};

interface LightBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: LightBadgeVariant;
}

export default function LightBadge({
  className,
  variant = 'default',
  children,
  ...props
}: LightBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.07em]',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
