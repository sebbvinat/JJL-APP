'use client';

import { clsx } from 'clsx';
import { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/**
 * Textarea de marca — gemelo de Input. Mismo focus-ring jjl-red, mismos
 * tokens de color y borde. Reemplaza los ~36 <textarea> con clases ad-hoc
 * repartidos por journal/weekly/library/soporte/competitions.
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, rows = 3, ...props }, ref) => {
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
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-invalid={!!error || undefined}
          className={clsx(
            'w-full bg-white/[0.03] text-white text-base placeholder:text-jjl-muted/50 rounded-lg px-4 py-3 transition-colors resize-none',
            'border border-jjl-border hover:border-jjl-border-strong',
            'focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/25',
            className
          )}
          {...props}
        />
        {error ? (
          <p className="mt-1.5 text-xs text-red-400">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-jjl-muted">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
export default Textarea;
