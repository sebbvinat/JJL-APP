import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ensureAdmin } from '@/lib/cursos/admin';
import { PublishToggle, NewCourseButton } from './AdminControls';
import type { CursosCourse, CursosBundle } from '@/lib/cursos/types';

export const metadata = { title: 'Admin · Cursos — JJL' };

export default async function AdminDashboard() {
  const ctx = await ensureAdmin();
  if (!ctx) redirect('/');

  const [coursesRes, bundlesRes] = await Promise.all([
    ctx.admin.from('cursos_courses').select('*').order('orden'),
    ctx.admin.from('cursos_bundles').select('*').order('orden'),
  ]);
  const courses = (coursesRes.data ?? []) as CursosCourse[];
  const bundles = (bundlesRes.data ?? []) as CursosBundle[];

  return (
    <div className="space-y-12">
      {/* Cursos */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Cursos</h1>
            <p className="mt-1 text-[13px] text-jjl-muted">
              {courses.length} {courses.length === 1 ? 'curso' : 'cursos'}
            </p>
          </div>
          <NewCourseButton />
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-jjl-border">
          {courses.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-jjl-muted">
              Todavía no hay cursos. Creá el primero.
            </p>
          )}
          {courses.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-4 px-5 py-3.5 ${
                i > 0 ? 'border-t border-jjl-border' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.titulo}</p>
                <p className="truncate text-[12px] text-jjl-muted">
                  /{c.slug}
                  {c.precio_label ? ` · ${c.precio_label}` : ''}
                </p>
              </div>
              <PublishToggle id={c.id} tipo="curso" publicado={c.publicado} />
              <Link
                href={`/admin-cursos/curso/${c.id}`}
                className="rounded-lg bg-white/5 px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-white/10"
              >
                Editar
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Packs */}
      <section>
        <h2 className="text-xl font-extrabold tracking-tight">Packs</h2>
        <div className="mt-5 overflow-hidden rounded-xl border border-jjl-border">
          {bundles.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-jjl-muted">
              No hay packs.
            </p>
          )}
          {bundles.map((b, i) => (
            <div
              key={b.id}
              className={`flex items-center gap-4 px-5 py-3.5 ${
                i > 0 ? 'border-t border-jjl-border' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{b.titulo}</p>
                <p className="truncate text-[12px] text-jjl-muted">
                  /{b.slug}
                  {b.precio_label ? ` · ${b.precio_label}` : ''}
                </p>
              </div>
              <PublishToggle id={b.id} tipo="bundle" publicado={b.publicado} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
