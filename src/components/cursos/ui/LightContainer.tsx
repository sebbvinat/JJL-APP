import { clsx } from 'clsx';

// Contenedor de ancho consistente para el tema claro de JJL Cursos.
interface LightContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'default' | 'narrow' | 'wide';
}

const sizes = {
  narrow: 'max-w-3xl',
  default: 'max-w-6xl',
  wide: 'max-w-[1320px]',
};

export default function LightContainer({
  className,
  size = 'default',
  children,
  ...props
}: LightContainerProps) {
  return (
    <div
      className={clsx('mx-auto w-full px-6 sm:px-8 lg:px-10', sizes[size], className)}
      {...props}
    >
      {children}
    </div>
  );
}
