'use client';

import { Link2 } from 'lucide-react';

/**
 * Badge "compartida x4" — indica que la lección está en SHARED_MONTH_*
 * y editarla afecta las 4 planillas (Livianos + Medios + Simbio + Atléticos).
 */
export default function SharedBadge() {
  return (
    <span
      title="Esta lección es compartida — está en las 4 planillas (Livianos, Medios, Simbio, Atléticos). Cualquier edición acá aplica a todas."
      className="inline-flex items-center gap-1 h-5 px-1.5 rounded border text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 border-blue-500/30 text-blue-300 shrink-0"
    >
      <Link2 className="h-3 w-3" />
      Compartida ×4
    </span>
  );
}
