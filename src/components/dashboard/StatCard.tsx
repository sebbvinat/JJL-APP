import { type LucideIcon } from 'lucide-react';
import Card from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
}

export default function StatCard({ label, value, icon: Icon, color = 'text-jjl-red' }: StatCardProps) {
  return (
    <Card className="bg-gradient-to-br from-jjl-gray to-jjl-gray/80 backdrop-blur-sm hover:border-jjl-red/20 transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className={`${color} relative`}>
          <div className="absolute inset-0 rounded-lg scale-[2.2] opacity-10 bg-current" />
          <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-current/10">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{value}</p>
          <p className="text-xs text-jjl-muted">{label}</p>
        </div>
      </div>
    </Card>
  );
}
