import type { BeltLevel } from '@/lib/supabase/types';
import { BELT_PROGRESSION } from '@/lib/constants';

interface GamificationInput {
  completedWeeks: number[]; // semana_numero values of fully completed modules
  totalTrainingDays: number;
  totalLessonsCompleted: number;
}

interface GamificationResult {
  newBelt: BeltLevel;
  puntos: number;
  nextBelt: { key: string; week: number } | null;
  progressToNext: number; // 0-100
}

/**
 * Calcula el cinturon y puntos basado en progreso.
 *
 * Reglas de progresion:
 * - Semana 4 completada → Cinturón Azul
 * - Semana 8 completada → Cinturón Púrpura
 * - Semana 16 completada → Cinturón Marrón
 * - Semana 24 completada → Cinturón Negro
 */
export function calculateGamification(input: GamificationInput): GamificationResult {
  const { completedWeeks, totalTrainingDays, totalLessonsCompleted } = input;

  const maxCompletedWeek = completedWeeks.length > 0 ? Math.max(...completedWeeks) : 0;

  // Determine belt
  let newBelt: BeltLevel = 'white';
  for (const belt of BELT_PROGRESSION) {
    if (belt.week > 0 && maxCompletedWeek >= belt.week) {
      newBelt = belt.key as BeltLevel;
    }
  }

  // Calculate points
  const puntos =
    totalLessonsCompleted * 10 + // 10 pts per lesson
    totalTrainingDays * 5 +      // 5 pts per training day
    completedWeeks.length * 50;  // 50 pts per completed week

  // Next belt
  const currentIndex = BELT_PROGRESSION.findIndex((b) => b.key === newBelt);
  const nextBeltInfo = BELT_PROGRESSION[currentIndex + 1] || null;

  // Progress to next belt (0-100)
  let progressToNext = 100;
  if (nextBeltInfo) {
    const currentWeek = BELT_PROGRESSION[currentIndex].week;
    const targetWeek = nextBeltInfo.week;
    const weeksNeeded = targetWeek - currentWeek;
    const weeksDone = Math.min(maxCompletedWeek - currentWeek, weeksNeeded);
    progressToNext = Math.round((Math.max(weeksDone, 0) / weeksNeeded) * 100);
  }

  return {
    newBelt,
    puntos,
    nextBelt: nextBeltInfo ? { key: nextBeltInfo.key, week: nextBeltInfo.week } : null,
    progressToNext,
  };
}

/**
 * Points breakdown for display
 */
export function getPointsBreakdown(lessons: number, trainingDays: number, weeks: number) {
  return [
    { label: 'Lecciones completadas', value: lessons, points: lessons * 10 },
    { label: 'Dias entrenados', value: trainingDays, points: trainingDays * 5 },
    { label: 'Semanas completadas', value: weeks, points: weeks * 50 },
  ];
}
