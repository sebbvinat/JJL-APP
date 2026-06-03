import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LightContainer from '@/components/cursos/ui/LightContainer';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import ChangePasswordForm from './ChangePasswordForm';

export const metadata: Metadata = { title: 'Tu cuenta — Jiu Jitsu Latino' };

export default async function CuentaPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('nombre')
    .eq('id', user.id)
    .single<{ nombre: string }>();
  const nombre = profile?.nombre ?? null;

  return (
    <LightContainer size="narrow" className="py-14 sm:py-20">
      <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-cursos-red">
        Tu cuenta
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-cursos-ink sm:text-4xl">
        Configuración
      </h1>

      {/* Datos */}
      <section className="mt-8 rounded-2xl border border-cursos-line bg-cursos-surface p-6 shadow-[var(--shadow-cursos-sm)] sm:p-8">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-cursos-muted">
          Datos de la cuenta
        </h2>
        <dl className="mt-3 space-y-2 text-[15px]">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-cursos-muted">Nombre</dt>
            <dd className="font-semibold text-cursos-ink">{nombre || '—'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-cursos-muted">Email</dt>
            <dd className="font-semibold text-cursos-ink">{user.email}</dd>
          </div>
        </dl>
      </section>

      {/* Cambio de password */}
      <section className="mt-6 rounded-2xl border border-cursos-line bg-cursos-surface p-6 shadow-[var(--shadow-cursos-sm)] sm:p-8">
        <h2 className="text-xl font-bold tracking-tight text-cursos-ink">
          Cambiar contraseña
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-cursos-ink-soft">
          Pedimos la contraseña actual por seguridad antes de cambiarla.
        </p>
        <ChangePasswordForm email={user.email ?? ''} />
      </section>
    </LightContainer>
  );
}
