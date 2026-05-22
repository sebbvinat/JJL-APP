import { clsx } from 'clsx';
import { forwardRef } from 'react';

// Primitiva de botón para el tema claro de JJL Cursos. Usa los tokens
// --color-cursos-*. lightButtonClasses() se exporta aparte para reusar
// los estilos en <a>/<Link> sin duplicar.

export type LightButtonVariant = 'primary' | 'ink' | 'outline' | 'ghost';
export type LightButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<LightButtonVariant, string> = {
  primary:
    'bg-cursos-red text-white shadow-[0_10px_26px_-12px_rgba(220,38,38,0.6)] hover:bg-cursos-red-dark active:translate-y-px',
  ink: 'bg-cursos-ink text-white hover:bg-black active:translate-y-px',
  outline:
    'bg-cursos-surface text-cursos-ink border border-cursos-line-strong hover:border-cursos-ink active:translate-y-px',
  ghost: 'text-cursos-ink hover:bg-black/[0.05] active:translate-y-px',
};

const sizes: Record<LightButtonSize, string> = {
  sm: 'h-9 px-4 text-[13px] rounded-lg gap-1.5',
  md: 'h-11 px-5 text-sm rounded-[10px] gap-2',
  lg: 'h-[52px] px-7 text-[15px] rounded-xl gap-2',
};

export function lightButtonClasses(
  variant: LightButtonVariant = 'primary',
  size: LightButtonSize = 'md',
  fullWidth = false
) {
  return clsx(
    'inline-flex items-center justify-center font-semibold tracking-[-0.01em] transition-all duration-150 select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cursos-red/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cursos-paper',
    variants[variant],
    sizes[size],
    fullWidth && 'w-full'
  );
}

interface LightButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: LightButtonVariant;
  size?: LightButtonSize;
  fullWidth?: boolean;
}

const LightButton = forwardRef<HTMLButtonElement, LightButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth, children, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(lightButtonClasses(variant, size, fullWidth), className)}
      {...props}
    >
      {children}
    </button>
  )
);

LightButton.displayName = 'LightButton';
export default LightButton;
