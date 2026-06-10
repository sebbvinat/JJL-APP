import { type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import Card from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  /** Destaca la card con gradiente + glow rojo. Para la métrica estrella
   *  (racha) que queremos que "tire" visualmente. */
  highlight?: boolean;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  color = 'text-jjl-red',
  highlight = false,
}: StatCardProps) {
  return (
    <Card
      className={clsx(
        'group relative overflow-hidden transition-all duration-300',
        highlight
          ? 'bg-gradient-to-br from-jjl-red/15 via-jjl-gray to-jjl-gray/60 border-jjl-red/30'
          : 'bg-gradient-to-br from-jjl-gray to-jjl-gray/60 hover:border-jjl-red/30'
      )}
    >
      {/* glow de fondo solo en highlight */}
      {highlight && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-8 -right-6 h-24 w-24 rounded-full blur-2xl opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.55), transparent 70%)' }}
        />
      )}
      {/* accent line on hover */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-jjl-red/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex items-center gap-4">
        <div
          className={clsx(
            'relative flex h-11 w-11 items-center justify-center rounded-xl bg-current/10 ring-1 ring-current/10 shadow-inner',
            color
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="text-[26px] font-black text-white tracking-tight leading-none">
            {value}
          </p>
          <p className="text-[11px] text-jjl-muted mt-1.5 uppercase tracking-wider font-medium">
            {label}
          </p>
        </div>
      </div>
    </Card>
  );
}
