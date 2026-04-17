'use client';

import { useMemo } from 'react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import Card from '@/components/ui/Card';

interface TrainingCalendarProps {
  trainedDays?: string[];
}

export default function TrainingCalendar({ trainedDays = [] }: TrainingCalendarProps) {
  const { days, streak } = useMemo(() => {
    const today = new Date();
    const trainedSet = new Set(trainedDays);

    // Build monthly calendar grid
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calDays: { date: Date; dateStr: string; trained: boolean; inMonth: boolean }[] = [];
    let d = calStart;
    while (d <= calEnd) {
      const dateStr = format(d, 'yyyy-MM-dd');
      calDays.push({
        date: new Date(d),
        dateStr,
        trained: trainedSet.has(dateStr),
        inMonth: isSameMonth(d, today),
      });
      d = addDays(d, 1);
    }

    // Streak
    let streakCount = 0;
    for (let i = 0; i < 365; i++) {
      const ds = format(subDays(today, i), 'yyyy-MM-dd');
      if (trainedSet.has(ds)) {
        streakCount++;
      } else if (i > 0) {
        break;
      }
    }

    return { days: calDays, streak: streakCount };
  }, [trainedDays]);

  const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const monthLabel = format(new Date(), 'MMMM yyyy', { locale: es });

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-white">Calendario</h2>
          <p className="text-[11px] text-jjl-muted mt-0.5 capitalize">{monthLabel}</p>
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

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayLabels.map((d) => (
          <div key={d} className="text-center text-[10px] text-jjl-muted/60 font-semibold py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isToday = day.dateStr === todayStr;
          const isPast = day.date <= new Date();
          return (
            <div
              key={day.dateStr}
              className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
                !day.inMonth
                  ? 'text-jjl-muted/20'
                  : isToday
                    ? day.trained
                      ? 'bg-green-500 text-white ring-2 ring-green-300 ring-offset-1 ring-offset-jjl-gray'
                      : 'bg-jjl-gray-light text-white ring-2 ring-jjl-red/60 ring-offset-1 ring-offset-jjl-gray'
                    : day.trained
                      ? 'bg-green-500/70 text-white'
                      : isPast
                        ? 'bg-white/5 text-jjl-muted/60'
                        : 'text-jjl-muted/30'
              }`}
              title={format(day.date, 'EEEE dd MMM', { locale: es })}
            >
              {day.date.getDate()}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-jjl-muted">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-white/5" />
          No entreno
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-green-500/70" />
          Entreno
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-jjl-gray-light ring-1 ring-jjl-red/60" />
          Hoy
        </div>
      </div>
    </Card>
  );
}
