import { clsx } from 'clsx';
import { BELT_COLORS, BELT_LABELS } from '@/lib/constants';

type BadgeVariant = 'default' | 'admin' | 'success' | 'warning' | 'error' | 'info';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-jjl-gray-light text-jjl-muted border border-jjl-border',
  admin: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  success: 'bg-green-500/15 text-green-400 border border-green-500/30',
  warning: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  error: 'bg-red-500/15 text-red-400 border border-red-500/30',
  info: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
};

interface BadgeProps {
  children?: React.ReactNode;
  belt?: string;
  variant?: BadgeVariant;
  className?: string;
}

export default function Badge({ children, belt, variant = 'default', className }: BadgeProps) {
  if (belt) {
    const color = BELT_COLORS[belt] || '#FFFFFF';
    const label = BELT_LABELS[belt] || belt;
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold',
          belt === 'white' ? 'text-black' : 'text-white',
          className
        )}
        style={{ backgroundColor: color }}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
