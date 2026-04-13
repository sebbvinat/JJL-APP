import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export default function Card({ className, hover, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-jjl-gray rounded-xl border border-jjl-border p-5',
        hover && 'transition-all hover:border-jjl-red/40 hover:shadow-lg hover:shadow-jjl-red/5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
