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

  try {
    const { data: profile } = await supabase
      .from('users')
      .select('rol, program_member')
      .eq('id', user.id)
      .single();
    type Prof = { rol?: string; program_member?: boolean };
    const isAdmin = (profile as Prof | null)?.rol === 'admin';
    const programMember = (profile as Prof | null)?.program_member;
    // Solo redirigimos si tenemos FALSE explicito + no es admin.
    // Si la columna no existe todavia, programMember = undefined -> permitimos.
    if (programMember === false && !isAdmin) {
      redirect('/cursos');
    }
  } catch {
    // Si falla el query (red, RLS, etc.) permitimos — fail-open para no
    // dejar gente afuera por bugs.
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
