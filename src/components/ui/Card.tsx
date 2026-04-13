import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export default function Card({ className, hover, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-gradient-to-br from-jjl-gray to-jjl-gray/80 rounded-xl border border-jjl-border p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]',
        hover && 'transition-all duration-300 hover:border-jjl-red/40 hover:shadow-lg hover:shadow-jjl-red/5 hover:scale-[1.01]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
