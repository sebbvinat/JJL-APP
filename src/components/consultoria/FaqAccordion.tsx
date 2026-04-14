'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

export interface FaqItem {
  question: string;
  answer: string;
}

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open.has(i);
        return (
          <div
            key={i}
            className="bg-jjl-gray border border-jjl-border rounded-xl overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between p-5 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-white font-semibold">{item.question}</span>
              <ChevronDown
                className={clsx(
                  'h-5 w-5 text-jjl-muted transition-transform duration-200 flex-shrink-0',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
            {isOpen && (
              <div className="px-5 pb-5 border-t border-jjl-border pt-4 text-jjl-muted text-sm leading-relaxed">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
