import { clsx } from 'clsx';

interface SpinnerProps {
  /** sm = botones/inline, md = secciones, lg = página completa */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
};

/** Spinner de marca (rojo JJL). Único lugar donde vive el patrón
 *  border-t-transparent + animate-spin — no copiarlo a mano en páginas. */
export default function Spinner({ size = 'lg', className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={clsx(
        'border-jjl-red border-t-transparent rounded-full animate-spin',
        SIZES[size],
        className,
      )}
    />
  );
}

/** Spinner centrado a pantalla/sección completa — el caso más común. */
export function FullScreenSpinner({ minHeight = 'min-h-[60vh]' }: { minHeight?: string }) {
  return (
    <div className={`flex items-center justify-center ${minHeight}`}>
      <Spinner size="lg" />
    </div>
  );
}
