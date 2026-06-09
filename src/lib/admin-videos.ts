import type { Planilla, PlanillaLesson, PlanillaWeek } from '@/lib/planillas';

/** Normaliza titulo para usarlo como lesson_key (igual que en el backend). */
export function normTitle(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

/** Lecciones de las semanas -1..8 son SHARED entre las 4 planillas
 *  (-1 = "Cómo usar la app", igual en las 4). */
export function isSharedSemana(semana_numero: number): boolean {
  return semana_numero >= -1 && semana_numero <= 8;
}

/** Mapea semana_numero -> número de mes (0=Fundamentos, 1-6 meses). */
export function mesFromSemana(n: number): number {
  if (n <= 0) return 0;
  if (n <= 4) return 1;
  if (n <= 8) return 2;
  if (n <= 12) return 3;
  if (n <= 16) return 4;
  if (n <= 20) return 5;
  return 6;
}

export const MES_LABELS: Record<number, string> = {
  0: 'Fundamentos',
  1: 'Mes 1 · Guardia Cerrada + Toreos',
  2: 'Mes 2 · Escapes 100KG + Kimura/Armbar',
  3: 'Mes 3',
  4: 'Mes 4',
  5: 'Mes 5',
  6: 'Mes 6',
};

/** Override del backend: una entrada por (module_id, lesson_key). */
export interface VideoOverride {
  module_id: string;
  lesson_key: string;     // normTitle del titulo original
  youtube_id?: string | null;
  titulo?: string | null;
  descripcion?: string | null;
}

/**
 * Aplica un override sobre una PlanillaLesson canónica.
 * Devuelve la lección "efectiva" — lo que el alumno ve en el endpoint
 * /api/course-data después del merge.
 */
export function applyOverride(lesson: PlanillaLesson, ov: VideoOverride | null | undefined): PlanillaLesson {
  if (!ov) return lesson;
  return {
    ...lesson,
    ...(ov.titulo != null ? { titulo: ov.titulo } : {}),
    ...(ov.youtube_id != null ? { youtube_id: ov.youtube_id } : {}),
  };
}

/**
 * Indexa overrides por lesson_key (normalizado) para lookup O(1).
 * Múltiples module_ids pueden tener override para el mismo lesson_key —
 * tomamos el primero (read-merge prefiere module match cuando aplica).
 */
export function indexOverridesByKey(overrides: VideoOverride[]): Map<string, VideoOverride> {
  const m = new Map<string, VideoOverride>();
  for (const o of overrides) {
    if (!o?.lesson_key) continue;
    if (!m.has(o.lesson_key)) m.set(o.lesson_key, o);
  }
  return m;
}

/** Compute video status for UI dots. */
export type LessonStatus = 'has_video' | 'no_video' | 'reflection';
export function lessonStatus(lesson: PlanillaLesson): LessonStatus {
  if (lesson.tipo === 'reflection') return 'reflection';
  return lesson.youtube_id && lesson.youtube_id.length > 0 ? 'has_video' : 'no_video';
}

/** Stats de completitud por planilla (excluye reflections). */
export interface PlanillaStats {
  total: number;       // total video lessons
  filled: number;      // con youtube_id (post-override)
  percent: number;     // 0-100
  byMes: Record<number, { total: number; filled: number }>;
}

export function computePlanillaStats(planilla: Planilla, ovByKey: Map<string, VideoOverride>): PlanillaStats {
  let total = 0, filled = 0;
  const byMes: Record<number, { total: number; filled: number }> = {};
  for (const week of planilla.weeks) {
    const mes = mesFromSemana(week.semana_numero);
    byMes[mes] = byMes[mes] || { total: 0, filled: 0 };
    for (const lesson of week.lessons) {
      if (lesson.tipo === 'reflection') continue;
      const eff = applyOverride(lesson, ovByKey.get(normTitle(lesson.titulo)));
      total++;
      byMes[mes].total++;
      if (eff.youtube_id) { filled++; byMes[mes].filled++; }
    }
  }
  return { total, filled, percent: total === 0 ? 0 : Math.round((filled / total) * 100), byMes };
}

/** Agrupa weeks por mes para render. */
export function groupWeeksByMes(weeks: PlanillaWeek[]): Map<number, PlanillaWeek[]> {
  const m = new Map<number, PlanillaWeek[]>();
  for (const w of weeks) {
    const mes = mesFromSemana(w.semana_numero);
    if (!m.has(mes)) m.set(mes, []);
    m.get(mes)!.push(w);
  }
  return m;
}

/** Valida y extrae un YouTube ID de un input arbitrario (URL o ID). */
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
export function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  if (YT_ID_RE.test(s)) return s;
  return null;
}
