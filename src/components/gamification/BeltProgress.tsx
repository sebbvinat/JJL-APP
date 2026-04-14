'use client';

import { Check, Lock } from 'lucide-react';
import { BELT_PROGRESSION, BELT_COLORS, BELT_LABELS } from '@/lib/constants';
import type { BeltLevel } from '@/lib/supabase/types';

interface BeltProgressProps {
  currentBelt: BeltLevel;
  progressToNext?: number;
}

export default function BeltProgress({ currentBelt, progressToNext = 0 }: BeltProgressProps) {
  const currentIdx = BELT_PROGRESSION.findIndex((b) => b.key === currentBelt);
  const nextBelt = BELT_PROGRESSION[currentIdx + 1];

  return (
    <div className="space-y-5">
      {/* Belt stepper */}
      <div className="flex items-start justify-between relative px-1">
        {/* Connection line (background) */}
        <div className="absolute left-5 right-5 top-5 h-[2px] bg-jjl-border z-0" />

        {/* Progress line */}
        <div
          className="absolute left-5 top-5 h-[2px] bg-gradient-to-r from-jjl-red via-jjl-red to-orange-500 z-0 transition-all duration-700 rounded-full"
          style={{
            width: `calc((100% - 40px) * ${currentIdx / (BELT_PROGRESSION.length - 1)})`,
          }}
        />

        {BELT_PROGRESSION.map((belt, idx) => {
          const isActive = belt.key === currentBelt;
          const isPast = idx < currentIdx;
          const isFuture = idx > currentIdx;
          const color = BELT_COLORS[belt.key];

          return (
            <div key={belt.key} className="flex flex-col items-center z-10 relative">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                  isActive
                    ? 'ring-4 ring-jjl-red/25 scale-110 border-jjl-red shadow-[0_0_18px_-2px_rgba(220,38,38,0.55)]'
                    : isPast
                      ? 'border-transparent'
                      : 'border-jjl-border'
                }`}
                style={{
                  backgroundColor: isFuture ? 'rgba(255,255,255,0.02)' : color,
                }}
              >
                {isPast && (
                  <Check
                    className="h-4 w-4"
                    strokeWidth={3}
                    stroke={belt.key === 'white' ? '#000' : '#fff'}
                  />
                )}
                {isFuture && <Lock className="h-3.5 w-3.5 text-jjl-muted/60" strokeWidth={2} />}
              </div>

              <span
                className={`text-[11px] mt-2 font-semibold tracking-wide uppercase ${
                  isActive ? 'text-jjl-red' : isPast ? 'text-white' : 'text-jjl-muted/50'
                }`}
              >
                {BELT_LABELS[belt.key]}
              </span>
              <span
                className={`text-[9px] tracking-wider uppercase mt-0.5 ${
                  isActive ? 'text-jjl-muted' : 'text-jjl-muted/40'
                }`}
              >
                {belt.week === 0 ? 'Inicio' : `S${belt.week}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress to next belt */}
      {nextBelt && (
        <div>
          <div className="flex items-baseline justify-between text-xs mb-1.5">
            <span className="text-jjl-muted">
              Camino a{' '}
              <span className="text-white font-semibold">{BELT_LABELS[nextBelt.key]}</span>
            </span>
            <span className="text-jjl-red font-bold tabular-nums">{progressToNext}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-jjl-red to-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
