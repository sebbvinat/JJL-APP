import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
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
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return NextResponse.json({ error: 'Config error' }, { status: 500 });

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is admin
    const { data: profile } = await adminClient
      .from('users')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (profile?.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { userId, nombre, cinturon_actual, email, password } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });

    // Update profile fields
    const updates: Record<string, any> = {};
    if (nombre !== undefined) updates.nombre = nombre;
    if (cinturon_actual !== undefined) updates.cinturon_actual = cinturon_actual;

    if (Object.keys(updates).length > 0) {
      const { error } = await adminClient
        .from('users')
        .update(updates)
        .eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update email in auth if provided
    if (email) {
      const { error } = await adminClient.auth.admin.updateUserById(userId, { email });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // Also update in users table
      await adminClient.from('users').update({ email }).eq('id', userId);
    }

    // Update password if provided
    if (password && password.length >= 6) {
      const { error } = await adminClient.auth.admin.updateUserById(userId, { password });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
