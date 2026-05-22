import { createServerSupabaseClient } from '@/lib/supabase/server';

// Control de acceso a los cursos sueltos. Server-side.

export interface CourseAccessRow {
  course_id: string;
  expires_at: string | null;
}

/** Cursos a los que el usuario tiene acceso vigente (no revocado, no vencido). */
export async function getUserCourseAccess(userId: string): Promise<CourseAccessRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('cursos_access')
    .select('course_id, expires_at')
    .eq('user_id', userId)
    .eq('revoked', false);

  const now = Date.now();
  return ((data ?? []) as CourseAccessRow[]).filter(
    (a) => !a.expires_at || new Date(a.expires_at).getTime() > now
  );
}

/** ¿El usuario puede ver este curso? Los admin siempre pueden (preview). */
export async function hasCourseAccess(
  userId: string,
  courseId: string,
  isAdmin = false
): Promise<boolean> {
  if (isAdmin) return true;
  const access = await getUserCourseAccess(userId);
  return access.some((a) => a.course_id === courseId);
}
