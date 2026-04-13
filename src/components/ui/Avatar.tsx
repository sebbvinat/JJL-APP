import { clsx } from 'clsx';
import { User } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-lg',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={clsx('rounded-full object-cover', sizeClasses[size], className)}
      />
    );
  }

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : null;

  return (
    <div
      className={clsx(
        'rounded-full bg-jjl-gray-light border border-jjl-border flex items-center justify-center font-semibold text-jjl-muted',
        sizeClasses[size],
        className
      )}
    >
      {initials || <User className="h-4 w-4" />}
    </div>
  );
}
