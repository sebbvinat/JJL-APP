import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import Orchestrator from '@/components/onboarding/Orchestrator';

export default async function BienvenidaPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, nombre, email, rol, cinturon_actual, onboarding_step, onboarding_completed_at')
    .eq('id', user.id)
    .single<{
      id: string;
      nombre: string;
      email: string | null;
      rol: string;
      cinturon_actual: string;
      onboarding_step: number;
      onboarding_completed_at: string | null;
    }>();

  if (profile?.onboarding_completed_at) redirect('/dashboard');

  return (
    <Orchestrator
      initialStep={profile?.onboarding_step ?? 1}
      userName={profile?.nombre ?? 'Guerrero'}
      userRole={profile?.rol ?? 'alumno'}
      userBelt={profile?.cinturon_actual ?? 'white'}
    />
  );
}
