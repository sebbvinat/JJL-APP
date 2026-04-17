'use client';

import { clsx } from 'clsx';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, leading, trailing, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-jjl-muted mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leading && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-jjl-muted pointer-events-none">
              {leading}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            aria-invalid={!!error || undefined}
            className={clsx(
              'w-full bg-white/[0.03] text-white text-base placeholder:text-jjl-muted/50 rounded-lg px-4 py-3 transition-colors min-h-[48px]',
              'border border-jjl-border hover:border-jjl-border-strong',
              'focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              leading && 'pl-10',
              trailing && 'pr-10',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/25',
              className
            )}
            {...props}
          />
          {trailing && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-jjl-muted">
              {trailing}
            </div>
          )}
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-red-400">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-jjl-muted">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
