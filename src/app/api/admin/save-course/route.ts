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

    const { data: profile } = await adminClient
      .from('users')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (profile?.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // 2. Parse body
    const { module_id, semana_numero, titulo, descripcion, lessons } = await request.json();

    if (!module_id || !titulo) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    // 3. Upsert into course_data
    const { error } = await adminClient
      .from('course_data')
      .upsert({
        module_id,
        semana_numero: semana_numero || 0,
        titulo,
        descripcion: descripcion || '',
        lessons: lessons || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'module_id' });

    if (error) {
      console.error('Save course error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save course error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
