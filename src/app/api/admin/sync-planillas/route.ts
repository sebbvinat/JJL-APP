import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getPlanillaForSave } from '@/lib/planillas';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Syncs planilla youtube_ids to ALL students who have that planilla assigned.
// Preserves lesson IDs so user_progress is not lost.
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

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    // Get all students with a planilla assigned
    const { data: students } = await adminClient
      .from('users')
      .select('id, nombre, planilla_id')
      .not('planilla_id', 'is', null);

    if (!students || students.length === 0) {
      return NextResponse.json({ message: 'No hay alumnos con planilla asignada', synced: 0 });
    }

    let synced = 0;
    let errors = 0;
    const details: string[] = [];

    // Group students by planilla
    const byPlanilla = new Map<string, typeof students>();
    for (const s of students) {
      const list = byPlanilla.get(s.planilla_id!) || [];
      list.push(s);
      byPlanilla.set(s.planilla_id!, list);
    }

    for (const [planillaId, planillaStudents] of byPlanilla) {
      const modules = getPlanillaForSave(planillaId);
      if (!modules) {
        details.push(`Planilla "${planillaId}" no encontrada`);
        errors += planillaStudents.length;
        continue;
      }

      for (const student of planillaStudents) {
        let studentErrors = 0;
        for (const mod of modules) {
          const { error } = await adminClient
            .from('course_data')
            .upsert(
              {
                user_id: student.id,
                module_id: mod.module_id,
                semana_numero: mod.semana_numero,
                titulo: mod.titulo,
                descripcion: mod.descripcion,
                lessons: mod.lessons,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,module_id' }
            );
          if (error) studentErrors++;
        }

        if (studentErrors === 0) {
          synced++;
        } else {
          errors++;
          details.push(`${student.nombre}: ${studentErrors} errores`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      errors,
      total: students.length,
      details: details.length > 0 ? details : undefined,
      message: `${synced} alumnos sincronizados`,
    });
  } catch (err: any) {
    console.error('[sync-planillas] failed', err);
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}
