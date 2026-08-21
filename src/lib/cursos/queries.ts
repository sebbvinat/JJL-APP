import { createServerSupabaseClient } from '@/lib/supabase/server';
import type {
  CursosCourse,
  CursosBundle,
  CursosSection,
  CursosLesson,
} from './types';

// Lecturas server-side del catálogo de JJL Cursos.

export interface CatalogBundle extends CursosBundle {
  /** Cursos incluidos en el bundle, en orden. */
  courses: CursosCourse[];
}

export interface CatalogData {
  bundles: CatalogBundle[];
  /** Cursos publicados que NO forman parte de ningún bundle. */
  courses: CursosCourse[];
}

/** Catálogo público: bundles (con sus cursos) + cursos sueltos. */
export async function getCatalog(): Promise<CatalogData> {
  const supabase = await createServerSupabaseClient();
  const [coursesRes, bundlesRes, itemsRes] = await Promise.all([
    supabase.from('cursos_courses').select('*').eq('publicado', true).order('orden'),
    supabase.from('cursos_bundles').select('*').eq('publicado', true).order('orden'),
    supabase.from('cursos_bundle_items').select('bundle_id, course_id, orden'),
  ]);

  const items = (itemsRes.data ?? []) as {
    bundle_id: string;
    course_id: string;
    orden: number;
  }[];
  const bundledIds = new Set(items.map((r) => r.course_id));
  const allCourses = (coursesRes.data ?? []) as CursosCourse[];

  const bundles = ((bundlesRes.data ?? []) as CursosBundle[]).map((b) => {
    const ids = items
      .filter((i) => i.bundle_id === b.id)
      .sort((a, z) => a.orden - z.orden)
      .map((i) => i.course_id);
    return {
      ...b,
      courses: ids
        .map((id) => allCourses.find((c) => c.id === id))
        .filter((c): c is CursosCourse => Boolean(c)),
    };
  });

  return {
    bundles,
    courses: allCourses.filter((c) => !bundledIds.has(c.id)),
  };
}

/** Bundle publicado al que pertenece un curso (para el upsell), o null. */
export async function getBundleForCourse(
  courseId: string
): Promise<{ bundle: CursosBundle; courses: CursosCourse[] } | null> {
  const supabase = await createServerSupabaseClient();
  const { data: item } = await supabase
    .from('cursos_bundle_items')
    .select('bundle_id')
    .eq('course_id', courseId)
    .maybeSingle();
  if (!item) return null;

  const { data: bundle } = await supabase
    .from('cursos_bundles')
    .select('*')
    .eq('id', (item as { bundle_id: string }).bundle_id)
    .eq('publicado', true)
    .maybeSingle();
  if (!bundle) return null;

  const { data: items } = await supabase
    .from('cursos_bundle_items')
    .select('course_id, orden')
    .eq('bundle_id', (bundle as CursosBundle).id)
    .order('orden');
  const ids = ((items ?? []) as { course_id: string }[]).map((i) => i.course_id);
  const { data: courses } = await supabase
    .from('cursos_courses')
    .select('*')
    .in('id', ids);
  const ordered = ((courses ?? []) as CursosCourse[]).sort(
    (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)
  );

  return { bundle: bundle as CursosBundle, courses: ordered };
}

/** Un curso por slug (solo publicado, salvo que el lector sea admin vía RLS). */
export async function getCourseBySlug(slug: string): Promise<CursosCourse | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('cursos_courses')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return (data as CursosCourse) ?? null;
}

/** Un bundle por slug junto con sus cursos incluidos. */
export async function getBundleBySlug(
  slug: string
): Promise<{ bundle: CursosBundle; courses: CursosCourse[] } | null> {
  const supabase = await createServerSupabaseClient();
  const { data: bundle } = await supabase
    .from('cursos_bundles')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!bundle) return null;

  const { data: items } = await supabase
    .from('cursos_bundle_items')
    .select('course_id, orden')
    .eq('bundle_id', (bundle as CursosBundle).id)
    .order('orden');

  const ids = ((items ?? []) as { course_id: string }[]).map((i) => i.course_id);
  let courses: CursosCourse[] = [];
  if (ids.length) {
    const { data } = await supabase.from('cursos_courses').select('*').in('id', ids);
    courses = (data as CursosCourse[]) ?? [];
    // respetar el orden del bundle
    courses.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  }
  return { bundle: bundle as CursosBundle, courses };
}

// ---- Área de cliente ----

export interface MyCourse {
  course: CursosCourse;
  expiresAt: string | null;
  revoked: boolean;
  completed: number;
  total: number;
}

/** Cursos del usuario (con acceso, vencimiento y progreso). */
export async function getMyCourses(userId: string): Promise<MyCourse[]> {
  const supabase = await createServerSupabaseClient();
  const { data: accessRows } = await supabase
    .from('cursos_access')
    .select('course_id, expires_at, revoked')
    .eq('user_id', userId);

  const access = (accessRows ?? []) as {
    course_id: string;
    expires_at: string | null;
    revoked: boolean;
  }[];
  if (access.length === 0) return [];

  const courseIds = access.map((a) => a.course_id);
  const [coursesRes, lessonsRes, progressRes] = await Promise.all([
    supabase.from('cursos_courses').select('*').in('id', courseIds),
    supabase.from('cursos_lessons').select('id, course_id').in('course_id', courseIds),
    supabase
      .from('cursos_progress')
      .select('lesson_id')
      .eq('user_id', userId)
      .eq('completado', true),
  ]);

  const courses = (coursesRes.data ?? []) as CursosCourse[];
  const lessons = (lessonsRes.data ?? []) as { id: string; course_id: string }[];
  const doneIds = new Set(
    ((progressRes.data ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id)
  );

  return access
    .map((a) => {
      const course = courses.find((c) => c.id === a.course_id);
      if (!course) return null;
      const courseLessons = lessons.filter((l) => l.course_id === a.course_id);
      return {
        course,
        expiresAt: a.expires_at,
        revoked: a.revoked,
        total: courseLessons.length,
        completed: courseLessons.filter((l) => doneIds.has(l.id)).length,
      };
    })
    .filter((x): x is MyCourse => x !== null)
    .sort((a, b) => a.course.titulo.localeCompare(b.course.titulo));
}

// ---- Visor de curso ----

export interface ViewerSection extends CursosSection {
  lessons: CursosLesson[];
}
export interface ViewerData {
  course: CursosCourse;
  sections: ViewerSection[];
}

/** Curso completo con secciones y lecciones ordenadas, para el visor. */
export async function getCourseViewerData(slug: string): Promise<ViewerData | null> {
  const supabase = await createServerSupabaseClient();
  const { data: course } = await supabase
    .from('cursos_courses')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!course) return null;

  const courseId = (course as CursosCourse).id;
  const [sectionsRes, lessonsRes] = await Promise.all([
    supabase.from('cursos_sections').select('*').eq('course_id', courseId).order('orden'),
    supabase.from('cursos_lessons').select('*').eq('course_id', courseId).order('orden'),
  ]);

  const lessons = (lessonsRes.data ?? []) as CursosLesson[];
  const sections = ((sectionsRes.data ?? []) as CursosSection[]).map((s) => ({
    ...s,
    lessons: lessons.filter((l) => l.section_id === s.id),
  }));

  return { course: course as CursosCourse, sections };
}
