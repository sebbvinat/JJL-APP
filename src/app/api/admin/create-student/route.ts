import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the caller is authenticated and is an admin
    const ctx = await requireAdmin(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { admin: adminClient } = ctx;

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
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // 4. Ensure users row exists. program_member=true por default porque
    //    crearlos manualmente desde Admin = es para el programa de 6
    //    meses. Los compradores de cursos sueltos se autoregistran por
    //    otro flujo y caen como rol='cliente_cursos' + program_member=false.
    if (newUser.user) {
      const baseRow = { id: newUser.user.id, nombre, email, rol: 'alumno' };
      let upsertError = null;
      const r = await adminClient.from('users').upsert({ ...baseRow, program_member: true } as any);
      upsertError = r.error;
      // Fallback pre-migración si la columna program_member no existe
      if (upsertError && /column .* does not exist|program_member.*schema cache/i.test(upsertError.message)) {
        const fb = await adminClient.from('users').upsert(baseRow as any);
        upsertError = fb.error;
      }

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
