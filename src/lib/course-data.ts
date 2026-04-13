import { MOCK_MODULES, MOCK_LESSONS, type MockLesson } from './mock-data';

export interface ModuleData {
  id: string;
  semana_numero: number;
  titulo: string;
  descripcion: string;
  lessons: LessonData[];
}

export interface LessonData {
  id: string;
  titulo: string;
  youtube_id: string;
  descripcion: string;
  orden: number;
  duracion: string;
  tipo: 'video' | 'reflection';
}

/**
 * Get module data: checks Supabase overrides first, falls back to mock data.
 * Uses a simple fetch to the API route.
 */
export async function getModuleData(moduleId: string): Promise<ModuleData | null> {
  // Try to load from API (which checks Supabase)
  try {
    const res = await fetch(`/api/course-data?moduleId=${moduleId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.module) return data.module;
    }
  } catch {
    // Fall through to mock data
  }

  return getModuleFromMock(moduleId);
}

/**
 * Get module data from mock data only (no network)
 */
export function getModuleFromMock(moduleId: string): ModuleData | null {
  const mod = MOCK_MODULES.find((m) => m.id === moduleId);
  if (!mod) return null;

  const mockLessons = MOCK_LESSONS[moduleId] || [];
  return {
    id: mod.id,
    semana_numero: mod.semana_numero,
    titulo: mod.titulo,
    descripcion: mod.descripcion,
    lessons: mockLessons.map((l) => ({
      id: l.id,
      titulo: l.titulo,
      youtube_id: l.youtube_id,
      descripcion: l.descripcion,
      orden: l.orden,
      duracion: l.duracion,
      tipo: l.tipo,
    })),
  };
}

/**
 * Get all modules with their lesson counts
 */
export function getAllModulesWithCounts(): { id: string; semana_numero: number; titulo: string; descripcion: string; lessonCount: number; videoCount: number }[] {
  return MOCK_MODULES.map((mod) => {
    const lessons = MOCK_LESSONS[mod.id] || [];
    return {
      id: mod.id,
      semana_numero: mod.semana_numero,
      titulo: mod.titulo,
      descripcion: mod.descripcion,
      lessonCount: lessons.length,
      videoCount: lessons.filter((l) => l.tipo !== 'reflection').length,
    };
  });
}
