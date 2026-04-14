import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padded?: boolean;
  tone?: 'default' | 'glass' | 'solid';
}

export default function Card({
  className,
  hover,
  padded = true,
  tone = 'default',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border relative',
        tone === 'glass' &&
          'border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-sm',
        tone === 'solid' && 'border-jjl-border bg-jjl-gray',
        tone === 'default' &&
          'border-jjl-border bg-gradient-to-b from-jjl-gray to-jjl-gray/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]',
        padded && 'p-5',
        hover &&
          'transition-all duration-200 hover:border-jjl-red/35 hover:shadow-[0_18px_40px_-24px_rgba(220,38,38,0.35)] hover:-translate-y-0.5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
