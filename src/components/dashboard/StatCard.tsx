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
    <Card>
      <div className="flex items-center gap-3">
        <div className={color}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-jjl-muted">{label}</p>
        </div>
      </div>
    </Card>
  );
}
