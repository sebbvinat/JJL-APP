'use client';

import { useMemo } from 'react';
import { format, subDays, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import Card from '@/components/ui/Card';

interface TrainingCalendarProps {
  trainedDays?: string[]; // ISO date strings
  weeks?: number;
}

export default function TrainingCalendar({ trainedDays = [], weeks: weeksProp = 13 }: TrainingCalendarProps) {
  // Use fewer weeks on mobile for better cell size
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const weeks = isMobile ? Math.min(weeksProp, 8) : weeksProp;
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
        <div>
          <h2 className="text-[15px] font-semibold text-white">Calendario de Entrenamiento</h2>
          <p className="text-[11px] text-jjl-muted mt-0.5 uppercase tracking-[0.12em]">
            Ultimas {weeks} semanas
          </p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-black text-orange-400 tabular-nums leading-none">
            {streak}
          </span>
          <span className="text-[10px] text-jjl-muted uppercase tracking-wider font-semibold">
            dias<br />seguidos
          </span>
        </div>
      </div>

      <div className="flex gap-1">
        {/* Day labels column */}
        <div className="flex flex-col gap-1 mr-1">
          {dayLabels.map((d) => (
            <div key={d} className="h-[14px] flex items-center">
              <span className="text-[10px] text-jjl-muted/60 leading-none font-semibold">{d}</span>
            </div>
          ))}
        </div>

        {/* Weeks columns */}
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 flex-1">
            {week.map((cell, di) => (
              <div
                key={di}
                className={`h-[14px] rounded-[3px] transition-colors ${
                  !cell
                    ? 'bg-transparent'
                    : cell.dateStr === todayStr
                      ? cell.trained
                        ? 'bg-green-400 ring-1 ring-green-300 ring-offset-1 ring-offset-jjl-gray'
                        : 'bg-white/10 ring-1 ring-jjl-red/60'
                      : cell.trained
                        ? 'bg-green-500/75 hover:bg-green-500'
                        : 'bg-white/5 hover:bg-white/10'
                }`}
                title={cell ? format(cell.date, 'EEEE dd MMM', { locale: es }) : ''}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-[11px] text-jjl-muted">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-[3px] bg-white/5" />
          No entreno
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-[3px] bg-green-500/75" />
          Entreno
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-[3px] bg-white/10 ring-1 ring-jjl-red/60" />
          Hoy
        </div>
      </div>
    </Card>
  );
}
