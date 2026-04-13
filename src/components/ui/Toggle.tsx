'use client';

import { clsx } from 'clsx';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function Toggle({ checked, onChange, label, disabled, size = 'md' }: ToggleProps) {
  const sizes = {
    sm: { track: 'h-5 w-9', thumb: 'h-3.5 w-3.5', translate: 'translate-x-4' },
    md: { track: 'h-6 w-11', thumb: 'h-4 w-4', translate: 'translate-x-5' },
    lg: { track: 'h-8 w-14', thumb: 'h-6 w-6', translate: 'translate-x-6' },
  };

  const s = sizes[size];

  return (
    <label className={clsx('inline-flex items-center gap-3', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-jjl-red/50',
          s.track,
          checked ? 'bg-jjl-red' : 'bg-jjl-gray-light border border-jjl-border'
        )}
      >
        <span
          className={clsx(
            'inline-block rounded-full bg-white shadow transform transition-transform duration-200 mt-[3px] ml-[3px]',
            s.thumb,
            checked ? s.translate : 'translate-x-0'
          )}
        />
      </button>
      {label && <span className="text-sm text-jjl-muted">{label}</span>}
    </label>
  );
}
