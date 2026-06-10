import type { LucideIcon } from 'lucide-react';

interface SectionHeadingProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Acción opcional alineada a la derecha (botón, link, etc.) */
  action?: React.ReactNode;
}

/**
 * Encabezado de sección de marca: ícono rojo + título + subtítulo opcional.
 * Extraído del patrón inline del diario para usarlo consistente en todas
 * las páginas (dashboard, weekly, library, modules…).
 */
export default function SectionHeading({ icon: Icon, title, subtitle, action }: SectionHeadingProps) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <Icon className="h-4 w-4 text-jjl-red shrink-0" strokeWidth={2.2} />
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-bold text-white leading-none">{title}</h2>
        {subtitle && <p className="text-[11px] text-jjl-muted mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
