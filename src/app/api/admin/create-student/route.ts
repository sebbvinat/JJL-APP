import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the caller is authenticated and is an admin
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('rol')
      .eq('id', user.id)
      .single();

    if ((profile as { rol: string } | null)?.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // 2. Parse request body
    const { email, password, nombre } = await request.json();

    if (!email || !password || !nombre) {
      return NextResponse.json(
        { error: 'Email, nombre y contraseña son requeridos' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // 3. Use service role key to create user (bypasses email confirmation)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Service role key no configurada' },
        { status: 500 }
      );
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // 4. Ensure users row exists
    if (newUser.user) {
      const { error: upsertError } = await adminClient.from('users').upsert({
        id: newUser.user.id,
        nombre,
        email,
        rol: 'alumno',
      } as any);

      if (upsertError) {
        console.error('Users table upsert error:', upsertError);
        return NextResponse.json(
          { error: `Usuario creado en auth pero fallo la tabla users: ${upsertError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, userId: newUser.user?.id });
  } catch (error) {
    console.error('Create student error:', error);
    return NextResponse.json(
      { error: 'Error al crear alumno' },
      { status: 500 }
    );
  }
}
