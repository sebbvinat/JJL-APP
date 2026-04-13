import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // 1. Verify caller is authenticated
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

    // 2. Check admin role
    const { data: callerProfile } = await adminClient
      .from('users')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (callerProfile?.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // 3. Get student data
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    const { data: student } = await adminClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // 4. Get unlocked module IDs
    const { data: accessData } = await adminClient
      .from('user_access')
      .select('module_id')
      .eq('user_id', userId)
      .eq('is_unlocked', true);

    const unlockedModuleIds = (accessData || []).map((r: any) => r.module_id);

    return NextResponse.json({ student, unlockedModuleIds });
  } catch (error) {
    console.error('Student data error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
