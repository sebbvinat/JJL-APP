import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCourseViewerData } from '@/lib/cursos/queries';
import { hasCourseAccess } from '@/lib/cursos/access';
import CourseViewer from '@/components/cursos/viewer/CourseViewer';

type PageProps = { params: Promise<{ slug: string }> };

function LockedState({ slug, titulo }: { slug: string; titulo: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-jjl-dark px-6">
      <div className="max-w-md rounded-2xl border border-jjl-border bg-jjl-gray p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-jjl-red/15 text-jjl-red-soft">
          <Lock size={22} />
        </div>
        <h1 className="mt-5 text-xl font-extrabold text-white">
          No tenés acceso a este curso
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-jjl-muted">
          Para ver <span className="text-white">{titulo}</span> necesitás comprarlo
          o renovar tu acceso.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            href={`/curso/${slug}`}
            className="inline-flex h-11 items-center rounded-lg bg-jjl-red px-5 text-sm font-semibold text-white hover:bg-jjl-red-hover"
          >
            Ver el curso
          </Link>
          <Link
            href="/mis-cursos"
            className="inline-flex h-11 items-center rounded-lg bg-white/5 px-5 text-sm font-semibold text-white"
          >
            Mis cursos
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function VerPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getCourseViewerData(slug);
  if (!data) notFound();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single();
  const isAdmin = (profile as { rol?: string } | null)?.rol === 'admin';

  const allowed = await hasCourseAccess(user.id, data.course.id, isAdmin);
  if (!allowed) {
    return <LockedState slug={slug} titulo={data.course.titulo} />;
  }

  return <CourseViewer course={data.course} sections={data.sections} />;
}
