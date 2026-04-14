import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

// Copy course_data from one student to another
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { admin: adminClient } = ctx;

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
