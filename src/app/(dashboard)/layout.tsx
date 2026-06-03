import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import MobileNav from '@/components/layout/MobileNav';
import { UserProvider } from '@/providers/UserProvider';
import PushPrompt from '@/components/PushPrompt';
import VersionCheck from '@/components/VersionCheck';
import SessionTracker from '@/components/SessionTracker';
import AnnouncementsBar from '@/components/AnnouncementsBar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate: solo program_member o admin acceden al dashboard.
  // Pre-migración (columna program_member no existe) NO bloqueamos —
  // dejamos pasar y seguimos sirviendo como antes.
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Gate de seguridad — defensa en capas con el middleware. Bloqueamos
  // a cualquier 'cliente_cursos' (clientes migrados de cursos sueltos)
  // del programa de 6 meses. NO debe tocar ninguna pagina del dashboard.
  try {
    const { data: profile } = await supabase
      .from('users')
      .select('rol, program_member, tags')
      .eq('id', user.id)
      .single();
    type Prof = { rol?: string; program_member?: boolean; tags?: string[] };
    const rol = (profile as Prof | null)?.rol;
    const isAdmin = rol === 'admin';
    const tags = (profile as Prof | null)?.tags || [];

    // 1) Bloqueo duro por rol — los admins pasan; cliente_cursos NUNCA.
    if (rol === 'cliente_cursos') {
      redirect('https://jiujitsulatino.com/mis-cursos');
    }

    // 2) Bloqueo secundario por program_member (refuerzo).
    const programMember = (profile as Prof | null)?.program_member;
    if (programMember === false && !isAdmin) {
      redirect('https://jiujitsulatino.com/mis-cursos');
    }

    // 3) Setters (admins con tag='setter') solo ven /admin/agendas. Si
    // entran por error al dashboard de alumno, los redirigimos. Coach y
    // admins sin ese tag siguen viendo el dashboard normal.
    if (isAdmin && tags.includes('setter')) {
      redirect('/admin/agendas');
    }
  } catch {
    // Si falla el query (red, RLS, etc.) permitimos — fail-open para no
    // dejar gente afuera por bugs. El middleware ya hace el chequeo de
    // rol = 'cliente_cursos' antes de llegar aca.
  }

  return (
    <UserProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
            <AnnouncementsBar />
            {children}
          </main>
        </div>
        <MobileNav />
        <PushPrompt />
        <VersionCheck />
        <SessionTracker />
      </div>
    </UserProvider>
  );
}
