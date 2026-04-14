'use client';

import { clsx } from 'clsx';
import Button from '@/components/ui/Button';

interface ShellProps {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  primaryLabel?: string | null;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  onPrimary?: () => void | Promise<void>;
  onSkip?: (() => void) | null;
  skipLabel?: string;
}

export default function Shell({
  step,
  total,
  title,
  subtitle,
  children,
  primaryLabel = 'Siguiente',
  primaryDisabled,
  primaryLoading,
  onPrimary,
  onSkip,
  skipLabel = 'Despues',
}: ShellProps) {
  return (
    <div className="mx-auto max-w-xl px-5 pt-10 pb-16 flex flex-col min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <span className="text-[11px] uppercase tracking-[0.22em] text-jjl-muted font-semibold">
          Paso {step} de {total}
        </span>
        <div className="flex-1 ml-4 h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-jjl-red to-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
      </div>

      <header className="mb-6">
        <h1 className="text-[28px] font-black tracking-tight text-white leading-tight text-balance">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[14px] text-jjl-muted mt-2 leading-relaxed text-balance">
            {subtitle}
          </p>
        )}
      </header>

      <div className={clsx('flex-1', 'animate-fade-in')}>{children}</div>

      <div className="mt-8 flex items-center gap-3">
        {primaryLabel && (
          <Button
            variant="primary"
            size="lg"
            onClick={onPrimary}
            disabled={primaryDisabled}
            loading={primaryLoading}
            fullWidth
          >
            {primaryLabel}
          </Button>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-[13px] text-jjl-muted hover:text-white px-3 py-2 rounded-lg transition-colors"
          >
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}
