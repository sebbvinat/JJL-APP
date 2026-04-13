'use client';

import { useMemo } from 'react';
import { format, subDays, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import Card from '@/components/ui/Card';

interface TrainingCalendarProps {
  trainedDays?: string[]; // ISO date strings
  weeks?: number;
}

export default function TrainingCalendar({ trainedDays = [], weeks = 13 }: TrainingCalendarProps) {
  // Build a grid aligned to weekdays: columns = weeks, rows = days (Mon-Sun)
  const { grid, streak } = useMemo(() => {
    const today = new Date();
    const trainedSet = new Set(trainedDays);

    // getDay: 0=Sun, 1=Mon ... 6=Sat
    // We want Mon=0, Tue=1 ... Sun=6
    const todayDow = (getDay(today) + 6) % 7; // Mon-based day of week

    // Total days to show: fill complete weeks + days in current week
    const totalDays = (weeks - 1) * 7 + todayDow + 1;

    // Build grid: array of weeks, each week has 7 cells
    const gridWeeks: ({ date: Date; trained: boolean; dateStr: string } | null)[][] = [];

    for (let w = 0; w < weeks; w++) {
      const week: ({ date: Date; trained: boolean; dateStr: string } | null)[] = [];
      for (let d = 0; d < 7; d++) {
        const daysAgo = totalDays - 1 - (w * 7 + d);
        if (daysAgo < 0) {
          week.push(null); // future day
        } else {
          const date = subDays(today, daysAgo);
          const dateStr = format(date, 'yyyy-MM-dd');
          week.push({
            date,
            trained: trainedSet.has(dateStr),
            dateStr,
          });
        }
      }
      gridWeeks.push(week);
    }

    // Calculate streak
    let streakCount = 0;
    for (let i = 0; i < 365; i++) {
      const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
      if (trainedSet.has(dateStr)) {
        streakCount++;
      } else if (i > 0) {
        break;
      }
    }

    return { grid: gridWeeks, streak: streakCount };
  }, [trainedDays, weeks]);

  const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Calendario de Entrenamiento</h2>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-orange-400">{streak}</span>
          <span className="text-xs text-jjl-muted">dias<br />seguidos</span>
        </div>
      </div>

      <div className="flex gap-1">
        {/* Day labels column */}
        <div className="flex flex-col gap-1 mr-1">
          {dayLabels.map((d) => (
            <div key={d} className="h-[14px] flex items-center">
              <span className="text-xs text-jjl-muted leading-none">{d}</span>
            </div>
          ))}
        </div>

        {/* Weeks columns */}
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 flex-1">
            {week.map((cell, di) => (
              <div
                key={di}
                className={`h-[14px] rounded-sm transition-colors ${
                  !cell
                    ? 'bg-transparent'
                    : cell.dateStr === todayStr
                    ? cell.trained
                      ? 'bg-green-400 ring-1 ring-green-300'
                      : 'bg-jjl-border ring-1 ring-jjl-muted/50'
                    : cell.trained
                    ? 'bg-green-500/70 hover:bg-green-500'
                    : 'bg-jjl-gray-light hover:bg-jjl-border'
                }`}
                title={cell ? format(cell.date, 'EEEE dd MMM', { locale: es }) : ''}
              />
            ))}
          </div>
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
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-jjl-border ring-1 ring-jjl-muted/50" />
          Hoy
        </div>
      </div>
    </Card>
  );
}
