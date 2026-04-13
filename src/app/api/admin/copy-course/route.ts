import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

// Copy course_data from one student to another
export async function POST(request: NextRequest) {
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

  const { fromUserId, toUserId } = await request.json();

  if (!fromUserId || !toUserId) {
    return NextResponse.json({ error: 'fromUserId and toUserId required' }, { status: 400 });
  }

  // Get source student's course data
  const { data: sourceModules, error: fetchError } = await adminClient
    .from('course_data')
    .select('*')
    .eq('user_id', fromUserId);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!sourceModules || sourceModules.length === 0) {
    return NextResponse.json({ error: 'El alumno origen no tiene curso cargado' }, { status: 404 });
  }

  // Copy to target student
  let saved = 0;
  const errors: string[] = [];

  for (const mod of sourceModules) {
    const { error } = await adminClient
      .from('course_data')
      .upsert(
        {
          user_id: toUserId,
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

  // Also create user_access entries
  for (const mod of sourceModules) {
    await adminClient
      .from('user_access')
      .upsert(
        {
          user_id: toUserId,
          module_id: mod.module_id,
          is_unlocked: false,
        },
        { onConflict: 'user_id,module_id' }
      );
  }

  if (errors.length > 0) {
    return NextResponse.json({ success: false, saved, errors }, { status: 207 });
  }

  return NextResponse.json({ success: true, saved });
}
