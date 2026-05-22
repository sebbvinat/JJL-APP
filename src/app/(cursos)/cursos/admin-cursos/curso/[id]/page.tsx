import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ensureAdmin } from '@/lib/cursos/admin';
import CourseEditor, { type EditorSection } from './CourseEditor';
import type { CursosCourse, CursosLesson, CursosSection } from '@/lib/cursos/types';

export const metadata = { title: 'Admin · Editar curso — JJL' };

type PageProps = { params: Promise<{ id: string }> };

export default async function CourseEditorPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await ensureAdmin();
  if (!ctx) redirect('/');

  const { data: courseData } = await ctx.admin
    .from('cursos_courses')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!courseData) notFound();
  const course = courseData as CursosCourse;

  const [sectionsRes, lessonsRes] = await Promise.all([
    ctx.admin.from('cursos_sections').select('*').eq('course_id', id).order('orden'),
    ctx.admin.from('cursos_lessons').select('*').eq('course_id', id).order('orden'),
  ]);
  const lessons = (lessonsRes.data ?? []) as CursosLesson[];
  const sections: EditorSection[] = ((sectionsRes.data ?? []) as CursosSection[]).map(
    (s) => ({
      id: s.id,
      titulo: s.titulo,
      lessons: lessons
        .filter((l) => l.section_id === s.id)
        .map((l) => ({
          id: l.id,
          titulo: l.titulo,
          tipo: l.tipo,
          youtube_id: l.youtube_id,
          contenido: l.contenido,
          duracion: l.duracion,
        })),
    })
  );

  return (
    <div>
      <Link
        href="/admin-cursos"
        className="text-[13px] font-semibold text-jjl-muted transition-colors hover:text-white"
      >
        ← Cursos
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{course.titulo}</h1>
        <Link
          href={`/curso/${course.slug}`}
          target="_blank"
          className="rounded-lg bg-white/5 px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-white/10"
        >
          Ver página de venta ↗
        </Link>
      </div>
      <div className="mt-6">
        <CourseEditor course={course} sections={sections} />
      </div>
    </div>
  );
}
