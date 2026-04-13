import { clsx } from 'clsx';
import { BELT_COLORS, BELT_LABELS } from '@/lib/constants';

interface BadgeProps {
  children?: React.ReactNode;
  belt?: string;
  className?: string;
}

export default function Badge({ children, belt, className }: BadgeProps) {
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
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-jjl-gray-light text-jjl-muted border border-jjl-border',
        className
      )}
    >
      {children}
    </span>
  );
}
