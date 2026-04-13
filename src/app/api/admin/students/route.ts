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

    // 3. Get all users (students + admins)
    const { data: users } = await adminClient
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    // 4. Get unlocked module counts
    const { data: accessData } = await adminClient
      .from('user_access')
      .select('user_id, module_id')
      .eq('is_unlocked', true);

    const countMap: Record<string, number> = {};
    (accessData || []).forEach((row: any) => {
      countMap[row.user_id] = (countMap[row.user_id] || 0) + 1;
    });

    const students = (users || []).map((u: any) => ({
      ...u,
      unlocked_count: countMap[u.id] || 0,
    }));

    return NextResponse.json({ students });
  } catch (error) {
    console.error('Students list error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
