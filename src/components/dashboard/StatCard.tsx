import { type LucideIcon } from 'lucide-react';
import Card from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  color = 'text-jjl-red',
}: StatCardProps) {
  return (
    <Card className="group relative overflow-hidden bg-gradient-to-br from-jjl-gray to-jjl-gray/60 hover:border-jjl-red/30 transition-all duration-300">
      {/* accent line on hover */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-jjl-red/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center gap-4">
        <div
          className={`relative flex h-11 w-11 items-center justify-center rounded-xl bg-current/10 ring-1 ring-current/10 shadow-inner ${color}`}
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
