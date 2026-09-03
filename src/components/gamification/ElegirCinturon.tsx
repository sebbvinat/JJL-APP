'use client';

import { useState } from 'react';
import { Award } from 'lucide-react';

const CINTURONES = [
  { value: 'white', label: 'Blanca', clase: 'bg-white' },
  { value: 'blue', label: 'Azul', clase: 'bg-blue-600' },
  { value: 'purple', label: 'Violeta', clase: 'bg-purple-600' },
  { value: 'brown', label: 'Marrón', clase: 'bg-amber-800' },
  { value: 'black', label: 'Negra', clase: 'bg-neutral-900 border border-white/25' },
] as const;

/**
 * Elegir el propio cinturón.
 *
 * Se usa en dos lados: el cartel que aparece una sola vez al abrir la app
 * (`titulo` visible) y el editor del perfil. Antes la app lo calculaba sola
 * por progreso y pisaba lo que hubiera — el cinturón se da en el tatami, no
 * completando videos.
 */
export default function ElegirCinturon({
  actual,
  onGuardado,
  compacto = false,
}: {
  actual?: string | null;
  onGuardado?: (cinturon: string) => void;
  compacto?: boolean;
}) {
  const [elegido, setElegido] = useState<string>(actual || 'white');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(valor: string) {
    setElegido(valor);
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/cinturon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cinturon: valor }),
      });
      if (!res.ok) throw new Error('no se pudo guardar');
      onGuardado?.(valor);
    } catch {
      setError('No se pudo guardar. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={compacto ? '' : 'space-y-4'}>
      <div className="grid grid-cols-5 gap-2">
        {CINTURONES.map((c) => (
          <button
            key={c.value}
            type="button"
            disabled={guardando}
            onClick={() => void guardar(c.value)}
            aria-pressed={elegido === c.value}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-colors disabled:opacity-60 ${
              elegido === c.value
                ? 'border-jjl-red bg-jjl-red/10'
                : 'border-jjl-border hover:border-white/25'
            }`}
          >
            <span className={`h-7 w-full rounded ${c.clase}`} />
            <span className="text-[11px] font-semibold text-white">{c.label}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-[12px] text-red-400">{error}</p>}
    </div>
  );
}

/** El cartel de la primera vez. */
export function CartelCinturon({ actual, onListo }: { actual?: string | null; onListo: () => void }) {
  const [guardado, setGuardado] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-jjl-border bg-jjl-gray p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-full bg-jjl-red/15 flex items-center justify-center shrink-0">
            <Award className="h-5 w-5 text-jjl-red" />
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-white">¿Cuál es tu cinturón?</h2>
            <p className="text-[12px] text-jjl-muted">Elegí el que tenés hoy en tu academia.</p>
          </div>
        </div>

        <ElegirCinturon actual={actual} onGuardado={() => setGuardado(true)} />

        <button
          type="button"
          disabled={!guardado}
          onClick={onListo}
          className="w-full h-11 rounded-xl bg-jjl-red text-white font-bold text-[14px] disabled:opacity-40 hover:bg-jjl-red/85 transition-colors"
        >
          {guardado ? 'Listo' : 'Elegí tu cinturón'}
        </button>

        <p className="text-[11px] text-jjl-muted/80 text-center">
          Lo podés cambiar cuando quieras desde tu perfil.
        </p>
      </div>
    </div>
  );
}
