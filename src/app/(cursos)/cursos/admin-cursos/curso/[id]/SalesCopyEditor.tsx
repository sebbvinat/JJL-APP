'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { updateCourse } from '../../actions';
import type { SalesCopy } from '@/lib/cursos/types';

// Editor del copy de la página de venta de un curso.
// Cubre los campos más visibles: subheadline, highlights y garantía.
// Los bloques de "solución" y FAQs se cargan por seed/migración.

const inputCls =
  'w-full rounded-lg border border-jjl-border bg-jjl-gray-light px-3 py-2 text-sm text-white outline-none focus:border-jjl-red';

export default function SalesCopyEditor({
  courseId,
  initial,
}: {
  courseId: string;
  initial: SalesCopy;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  const [subheadline, setSubheadline] = useState(initial.subheadline ?? '');
  const [highlights, setHighlights] = useState(
    (initial.highlights ?? []).join('\n')
  );
  const [garTitulo, setGarTitulo] = useState(initial.garantia?.titulo ?? '');
  const [garCuerpo, setGarCuerpo] = useState(initial.garantia?.cuerpo ?? '');

  const save = () =>
    start(async () => {
      setMsg('');
      const sales_copy: SalesCopy = {
        ...initial,
        subheadline: subheadline || undefined,
        highlights: highlights
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        garantia:
          garTitulo || garCuerpo
            ? { titulo: garTitulo, cuerpo: garCuerpo }
            : undefined,
      };
      const r = await updateCourse(courseId, { sales_copy });
      setMsg(r.error ?? 'Página de venta guardada.');
      router.refresh();
    });

  return (
    <section className="rounded-xl border border-jjl-border bg-jjl-gray p-6">
      <h2 className="text-lg font-extrabold">Página de venta</h2>
      <p className="mt-1 text-[13px] text-jjl-muted">
        Lo que ve quien todavía no compró el curso.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-jjl-muted">
            Frase principal (subheadline)
          </span>
          <input
            className={inputCls}
            value={subheadline}
            onChange={(e) => setSubheadline(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-jjl-muted">
            Qué vas a lograr — uno por línea
          </span>
          <textarea
            className={clsx(inputCls, 'min-h-[110px] resize-y')}
            value={highlights}
            onChange={(e) => setHighlights(e.target.value)}
            placeholder={'Controlar la posición\nFinalizar con más porcentaje\n…'}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-jjl-muted">
              Garantía — título
            </span>
            <input
              className={inputCls}
              value={garTitulo}
              onChange={(e) => setGarTitulo(e.target.value)}
              placeholder="Garantía de 7 días"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-jjl-muted">
              Garantía — texto
            </span>
            <input
              className={inputCls}
              value={garCuerpo}
              onChange={(e) => setGarCuerpo(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-10 rounded-lg bg-jjl-red px-5 text-sm font-semibold transition-colors hover:bg-jjl-red-hover disabled:opacity-50"
        >
          Guardar página de venta
        </button>
        {msg && <span className="text-[13px] text-jjl-muted">{msg}</span>}
      </div>
    </section>
  );
}
