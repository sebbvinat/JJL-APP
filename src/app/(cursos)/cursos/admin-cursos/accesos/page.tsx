import { redirect } from 'next/navigation';
import { ensureAdmin } from '@/lib/cursos/admin';
import AccessManager from './AccessManager';

export const metadata = { title: 'Admin · Accesos — JJL' };

export default async function AccesosPage() {
  const ctx = await ensureAdmin();
  if (!ctx) redirect('/');

  const [coursesRes, bundlesRes] = await Promise.all([
    ctx.admin.from('cursos_courses').select('id, titulo').order('orden'),
    ctx.admin.from('cursos_bundles').select('id, titulo').order('orden'),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Accesos</h1>
      <p className="mt-1 text-[13px] text-jjl-muted">
        Buscá un cliente por email y habilitale los cursos que compró.
      </p>
      <div className="mt-6">
        <AccessManager
          courses={(coursesRes.data ?? []) as { id: string; titulo: string }[]}
          bundles={(bundlesRes.data ?? []) as { id: string; titulo: string }[]}
        />
      </div>
    </div>
  );
}
