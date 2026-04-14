import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
  tone?: 'neutral' | 'red';
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = 'neutral',
}: EmptyStateProps) {
  const accent =
    tone === 'red'
      ? 'bg-jjl-red/10 border-jjl-red/25 text-jjl-red'
      : 'bg-white/5 border-white/10 text-jjl-muted';

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center py-16 px-6 animate-fade-in',
        className
      )}
    >
      {Icon && (
        <div
          className={clsx(
            'h-16 w-16 rounded-2xl border flex items-center justify-center mb-5',
            accent
          )}
        >
          <Icon className="h-7 w-7" strokeWidth={1.75} />
        </div>
      )}
      <h3 className="text-lg font-bold text-white text-balance max-w-sm">{title}</h3>
      {description && (
        <p className="text-sm text-jjl-muted mt-2 max-w-sm text-balance leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-2 px-4 py-2 bg-jjl-red hover:bg-jjl-red-hover text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 bg-jjl-red hover:bg-jjl-red-hover text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
