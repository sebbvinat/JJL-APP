'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import type { SalesFaq } from '@/lib/cursos/types';

// Acordeón de preguntas frecuentes (tema claro de JJL Cursos).
export default function FaqAccordion({ faqs }: { faqs: SalesFaq[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-cursos-line border-y border-cursos-line">
      {faqs.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div key={faq.pregunta}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span className="text-[16px] font-bold tracking-[-0.01em] text-cursos-ink">
                {faq.pregunta}
              </span>
              <span
                className={clsx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cursos-line-strong text-cursos-ink transition-transform duration-200',
                  isOpen && 'rotate-45'
                )}
                aria-hidden
              >
                +
              </span>
            </button>
            {isOpen && (
              <p className="-mt-1 pb-5 pr-11 text-[15px] leading-relaxed text-cursos-ink-soft">
                {faq.respuesta}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
