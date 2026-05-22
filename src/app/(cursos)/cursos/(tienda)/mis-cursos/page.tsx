import type { Metadata } from 'next';
import Link from 'next/link';
import LightContainer from '@/components/cursos/ui/LightContainer';
import MyCourseCard from '@/components/cursos/MyCourseCard';
import { lightButtonClasses } from '@/components/cursos/ui/LightButton';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getMyCourses } from '@/lib/cursos/queries';

export const metadata: Metadata = { title: 'Mis cursos — Jiu Jitsu Latino' };

export default async function MisCursosPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const myCourses = user ? await getMyCourses(user.id) : [];

  return (
    <LightContainer className="py-14 sm:py-20">
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-cursos-red">
          Tu plataforma
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.025em] text-cursos-ink sm:text-4xl">
          Mis cursos
        </h1>
      </div>

      {myCourses.length > 0 ? (
        <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {myCourses.map((item) => (
            <MyCourseCard key={item.course.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-9 rounded-2xl border border-dashed border-cursos-line-strong bg-cursos-surface px-8 py-20 text-center">
          <p className="font-display text-xl font-extrabold text-cursos-ink">
            Todavía no tenés cursos
          </p>
          <p className="mx-auto mt-2 max-w-sm text-[14px] text-cursos-muted">
            Cuando compres un instruccional, va a aparecer acá para que lo veas
            cuando quieras.
          </p>
          <Link
            href="/"
            className={`${lightButtonClasses('primary', 'md')} mt-6`}
          >
            Ver el catálogo
          </Link>
        </div>
      )}
    </LightContainer>
  );
}
