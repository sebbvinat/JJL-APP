'use client';

import { clsx } from 'clsx';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-jjl-muted mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={clsx(
            'w-full bg-jjl-gray-light border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-jjl-muted/60 focus:outline-none focus:ring-2 focus:ring-jjl-red/50 focus:border-jjl-red transition-colors',
            error ? 'border-red-500' : 'border-jjl-border',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
