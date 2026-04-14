import { NextResponse, type NextRequest } from 'next/server';
import { getPlanillaForSave } from '@/lib/planillas';
import { requireAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { admin: adminClient } = ctx;

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
