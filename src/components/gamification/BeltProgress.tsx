'use client';

import { BELT_PROGRESSION, BELT_COLORS, BELT_LABELS } from '@/lib/constants';
import type { BeltLevel } from '@/lib/supabase/types';

interface BeltProgressProps {
  currentBelt: BeltLevel;
  progressToNext?: number; // 0-100
}

export default function BeltProgress({ currentBelt, progressToNext = 0 }: BeltProgressProps) {
  const currentIdx = BELT_PROGRESSION.findIndex((b) => b.key === currentBelt);

  return (
    <div className="space-y-4">
      {/* Belt stepper */}
      <div className="flex items-center justify-between relative px-2">
        {/* Connection line */}
        <div className="absolute left-6 right-6 top-5 h-0.5 bg-jjl-border z-0" />

        {/* Progress line */}
        <div
          className="absolute left-6 top-5 h-0.5 bg-jjl-red z-0 transition-all duration-700"
          style={{
            width: `${(currentIdx / (BELT_PROGRESSION.length - 1)) * 100}%`,
            maxWidth: 'calc(100% - 48px)',
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
                    ? 'ring-4 ring-jjl-red/30 scale-110 border-jjl-red'
                    : isPast
                    ? 'border-transparent'
                    : 'border-jjl-border'
                }`}
                style={{
                  backgroundColor: isFuture ? '#1A1A1A' : color,
                }}
              >
                {isPast && (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke={belt.key === 'white' ? '#000' : '#fff'} strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isFuture && (
                  <svg className="h-4 w-4 text-jjl-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </div>

              <span
                className={`text-xs mt-1.5 font-medium ${
                  isActive ? 'text-jjl-red' : isPast ? 'text-white' : 'text-jjl-muted/50'
                }`}
              >
                {BELT_LABELS[belt.key]}
              </span>
              <span className={`text-[9px] ${isActive ? 'text-jjl-muted' : 'text-jjl-muted/40'}`}>
                {belt.week === 0 ? 'Inicio' : `S${belt.week}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress to next belt */}
      {currentIdx < BELT_PROGRESSION.length - 1 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-jjl-muted">
              Progreso a {BELT_LABELS[BELT_PROGRESSION[currentIdx + 1].key]}
            </span>
            <span className="text-jjl-red font-medium">{progressToNext}%</span>
          </div>
          <div className="w-full bg-jjl-gray-light rounded-full h-2">
            <div
              className="bg-jjl-red h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
