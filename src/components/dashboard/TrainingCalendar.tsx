'use client';

import { useMemo } from 'react';
import { format, subDays, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import Card from '@/components/ui/Card';

interface TrainingCalendarProps {
  trainedDays?: string[]; // ISO date strings
  days?: number;
}

export default function TrainingCalendar({ trainedDays = [], days = 90 }: TrainingCalendarProps) {
  const calendarData = useMemo(() => {
    const today = new Date();
    const trainedSet = new Set(trainedDays);
    const cells: { date: Date; trained: boolean }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(today, i);
      cells.push({
        date,
        trained: trainedSet.has(format(date, 'yyyy-MM-dd')),
      });
    }

    return cells;
  }, [trainedDays, days]);

  // Calculate streak
  const streak = useMemo(() => {
    let count = 0;
    const today = new Date();
    const trainedSet = new Set(trainedDays);

    for (let i = 0; i < 365; i++) {
      const date = format(subDays(today, i), 'yyyy-MM-dd');
      if (trainedSet.has(date)) {
        count++;
      } else if (i > 0) {
        break;
      }
    }
    return count;
  }, [trainedDays]);

  const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Calendario de Entrenamiento</h2>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-orange-400">{streak}</span>
          <span className="text-xs text-jjl-muted">dias<br />seguidos</span>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayLabels.map((d) => (
          <div key={d} className="text-[10px] text-jjl-muted text-center">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarData.map((cell, i) => (
          <div
            key={i}
            className={`aspect-square rounded-sm transition-colors ${
              cell.trained
                ? 'bg-green-500/70 hover:bg-green-500'
                : 'bg-jjl-gray-light hover:bg-jjl-border'
            }`}
            title={format(cell.date, 'dd MMM yyyy', { locale: es })}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-jjl-muted">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-jjl-gray-light" />
          No entreno
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-green-500/70" />
          Entreno
        </div>
      </div>
    </Card>
  );
}
