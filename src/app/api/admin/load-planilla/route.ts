import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { getPlanillaForSave } from '@/lib/planillas';

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 });
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
    return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  }

  const { planillaId, userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const modules = getPlanillaForSave(planillaId);
  if (!modules) {
    return NextResponse.json({ error: 'Planilla not found' }, { status: 404 });
  }

  // Bulk upsert into course_data for this specific user
  const errors: string[] = [];
  let saved = 0;

  for (const mod of modules) {
    const { error } = await adminClient
      .from('course_data')
      .upsert(
        {
          user_id: userId,
          module_id: mod.module_id,
          semana_numero: mod.semana_numero,
          titulo: mod.titulo,
          descripcion: mod.descripcion,
          lessons: mod.lessons,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,module_id' }
      );

    if (error) {
      errors.push(`${mod.module_id}: ${error.message}`);
    } else {
      saved++;
    }
  }

  // Also create user_access entries so the admin can toggle them
  for (const mod of modules) {
    await adminClient
      .from('user_access')
      .upsert(
        {
          user_id: userId,
          module_id: mod.module_id,
          is_unlocked: false,
        },
        { onConflict: 'user_id,module_id' }
      );
  }

  // Save which planilla was loaded for this user
  await adminClient
    .from('users')
    .update({ planilla_id: planillaId })
    .eq('id', userId);

  if (errors.length > 0) {
    return NextResponse.json({
      success: false,
      saved,
      errors,
      message: `${saved} guardados, ${errors.length} errores`,
    }, { status: 207 });
  }

  return NextResponse.json({ success: true, saved });
}
