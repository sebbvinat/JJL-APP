import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify caller is admin
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Service role key no configurada' }, { status: 500 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check admin role using service client
    const { data: profile } = await adminClient
      .from('users')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (profile?.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // 2. Parse body
    const { userId, modules, action } = await request.json();
    // modules: array of { id: string, semana_numero: number, titulo: string, is_unlocked: boolean }
    // action: 'toggle' | 'batch'

    if (!userId || !modules || !Array.isArray(modules)) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }

    // 3. Upsert into user_access using service role (bypasses RLS + FK if column is TEXT)
    const rows = modules.map((m: { id: string; is_unlocked: boolean }) => ({
      user_id: userId,
      module_id: m.id,
      is_unlocked: m.is_unlocked,
    }));

    const { error: upsertError } = await adminClient
      .from('user_access')
      .upsert(rows, { onConflict: 'user_id,module_id' });

    if (upsertError) {
      console.error('Toggle access error:', upsertError);
      return NextResponse.json(
        { error: `Error al guardar acceso: ${upsertError.message}` },
        { status: 500 }
      );
    }

    // Notify user about newly unlocked modules
    const unlockedModules = modules.filter((m: any) => m.is_unlocked);
    if (unlockedModules.length > 0) {
      try {
        const { createNotification } = await import('@/lib/notifications');
        for (const mod of unlockedModules) {
          await createNotification(
            userId,
            'module',
            `Nuevo modulo desbloqueado`,
            `Se desbloqueo: ${mod.titulo || `Semana ${mod.semana_numero}`}. Ya podes empezar a entrenar!`
          );
        }
      } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Toggle access error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
