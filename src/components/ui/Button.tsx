'use client';

import { clsx } from 'clsx';
import { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-jjl-red text-white shadow-[0_8px_24px_-8px_rgba(220,38,38,0.5)] hover:bg-jjl-red-hover hover:shadow-[0_12px_28px_-8px_rgba(220,38,38,0.6)] active:translate-y-px',
  secondary:
    'bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20 active:translate-y-px',
  outline:
    'bg-transparent text-white border border-jjl-border hover:border-jjl-red/50 hover:text-jjl-red active:translate-y-px',
  ghost: 'text-jjl-muted hover:text-white hover:bg-white/5',
  danger: 'bg-red-900/30 text-red-400 border border-red-500/20 hover:bg-red-900/50 active:translate-y-px',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px] rounded-lg gap-1.5',
  md: 'h-11 px-5 text-sm rounded-lg gap-2',
  lg: 'h-12 px-6 text-[15px] rounded-xl gap-2',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading,
      disabled,
      fullWidth,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center font-semibold transition-all duration-150 select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jjl-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-jjl-dark',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:hover:shadow-none',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-0.5 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
