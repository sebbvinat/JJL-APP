'use server';

import { ensureAdmin } from '@/lib/cursos/admin';

type Result = { error?: string; id?: string };

function expiresFromMonths(meses: number | null): string | null {
  if (!meses || meses <= 0) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  return d.toISOString();
}

// ---------- Publicar ----------

export async function setCoursePublished(id: string, publicado: boolean): Promise<Result> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };
  const { error } = await ctx.admin
    .from('cursos_courses')
    .update({ publicado })
    .eq('id', id);
  return error ? { error: error.message } : {};
}

export async function setBundlePublished(id: string, publicado: boolean): Promise<Result> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };
  const { error } = await ctx.admin
    .from('cursos_bundles')
    .update({ publicado })
    .eq('id', id);
  return error ? { error: error.message } : {};
}

// ---------- Cursos ----------

export async function createCourse(): Promise<Result> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };
  const slug = `curso-nuevo-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await ctx.admin
    .from('cursos_courses')
    .insert({ slug, titulo: 'Curso nuevo', publicado: false })
    .select('id')
    .single();
  if (error) return { error: error.message };
  return { id: (data as { id: string }).id };
}

export async function updateCourse(
  id: string,
  fields: Record<string, unknown>
): Promise<Result> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };
  const { error } = await ctx.admin.from('cursos_courses').update(fields).eq('id', id);
  return error ? { error: error.message } : {};
}

// ---------- Secciones ----------

export async function createSection(courseId: string, titulo: string): Promise<Result> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };
  const { count } = await ctx.admin
    .from('cursos_sections')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId);
  const { error } = await ctx.admin
    .from('cursos_sections')
    .insert({ course_id: courseId, titulo, orden: count ?? 0 });
  return error ? { error: error.message } : {};
}

export async function updateSection(
  id: string,
  fields: Record<string, unknown>
): Promise<Result> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };
  const { error } = await ctx.admin.from('cursos_sections').update(fields).eq('id', id);
  return error ? { error: error.message } : {};
}

export async function deleteSection(id: string): Promise<Result> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };
  const { error } = await ctx.admin.from('cursos_sections').delete().eq('id', id);
  return error ? { error: error.message } : {};
}

// ---------- Lecciones ----------

export async function createLesson(
  sectionId: string,
  courseId: string,
  titulo: string,
  tipo: 'video' | 'texto'
): Promise<Result> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };
  const { count } = await ctx.admin
    .from('cursos_lessons')
    .select('id', { count: 'exact', head: true })
    .eq('section_id', sectionId);
  const { error } = await ctx.admin
    .from('cursos_lessons')
    .insert({ section_id: sectionId, course_id: courseId, titulo, tipo, orden: count ?? 0 });
  return error ? { error: error.message } : {};
}

export async function updateLesson(
  id: string,
  fields: Record<string, unknown>
): Promise<Result> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };
  const { error } = await ctx.admin.from('cursos_lessons').update(fields).eq('id', id);
  return error ? { error: error.message } : {};
}

export async function deleteLesson(id: string): Promise<Result> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };
  const { error } = await ctx.admin.from('cursos_lessons').delete().eq('id', id);
  return error ? { error: error.message } : {};
}

// ---------- Accesos ----------

export async function grantAccess(input: {
  email: string;
  courseId?: string;
  bundleId?: string;
  meses: number | null;
}): Promise<Result> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };

  const { data: userRow } = await ctx.admin
    .from('users')
    .select('id')
    .ilike('email', input.email.trim())
    .maybeSingle();
  if (!userRow) {
    return { error: 'No existe una cuenta con ese email. El cliente debe registrarse primero.' };
  }
  const userId = (userRow as { id: string }).id;

  let courseIds: string[] = [];
  if (input.bundleId) {
    const { data: items } = await ctx.admin
      .from('cursos_bundle_items')
      .select('course_id')
      .eq('bundle_id', input.bundleId);
    courseIds = ((items ?? []) as { course_id: string }[]).map((i) => i.course_id);
  } else if (input.courseId) {
    courseIds = [input.courseId];
  }
  if (courseIds.length === 0) return { error: 'Elegí un curso o un pack.' };

  const expires_at = expiresFromMonths(input.meses);
  const rows = courseIds.map((course_id) => ({
    user_id: userId,
    course_id,
    source_bundle_id: input.bundleId ?? null,
    granted_by: ctx.userId,
    expires_at,
    revoked: false,
  }));
  const { error } = await ctx.admin
    .from('cursos_access')
    .upsert(rows, { onConflict: 'user_id,course_id' });
  return error ? { error: error.message } : {};
}

export async function revokeAccess(accessId: string, revoked: boolean): Promise<Result> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };
  const { error } = await ctx.admin
    .from('cursos_access')
    .update({ revoked })
    .eq('id', accessId);
  return error ? { error: error.message } : {};
}

export interface CustomerGrant {
  id: string;
  courseTitulo: string;
  expires_at: string | null;
  revoked: boolean;
  granted_at: string;
}
export interface CustomerLookup {
  error?: string;
  customer?: { id: string; nombre: string; email: string | null };
  grants?: CustomerGrant[];
}

/** Busca un cliente por email y devuelve sus accesos. */
export async function lookupCustomer(email: string): Promise<CustomerLookup> {
  const ctx = await ensureAdmin();
  if (!ctx) return { error: 'No autorizado' };

  const { data: user } = await ctx.admin
    .from('users')
    .select('id, nombre, email')
    .ilike('email', email.trim())
    .maybeSingle();
  if (!user) {
    return { error: 'No se encontró ninguna cuenta con ese email.' };
  }
  const customer = user as { id: string; nombre: string; email: string | null };

  const { data: accessRows } = await ctx.admin
    .from('cursos_access')
    .select('id, course_id, expires_at, revoked, granted_at')
    .eq('user_id', customer.id);
  const access = (accessRows ?? []) as {
    id: string;
    course_id: string;
    expires_at: string | null;
    revoked: boolean;
    granted_at: string;
  }[];

  let titles: Record<string, string> = {};
  if (access.length) {
    const { data: courses } = await ctx.admin
      .from('cursos_courses')
      .select('id, titulo')
      .in(
        'id',
        access.map((a) => a.course_id)
      );
    titles = Object.fromEntries(
      ((courses ?? []) as { id: string; titulo: string }[]).map((c) => [c.id, c.titulo])
    );
  }

  return {
    customer,
    grants: access.map((a) => ({
      id: a.id,
      courseTitulo: titles[a.course_id] ?? '(curso eliminado)',
      expires_at: a.expires_at,
      revoked: a.revoked,
      granted_at: a.granted_at,
    })),
  };
}
