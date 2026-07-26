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

    // Cargar overrides de video (cargados desde /admin/videos) para
    // aplicarlos arriba de los valores de la planilla del código — sino el
    // sync pisaría los videos que el coach cargó a mano.
    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
    const { data: overrideRows } = await adminClient
      .from('lesson_video_overrides')
      .select('module_id, lesson_key, youtube_id, titulo, descripcion');
    const overrideByModule = new Map<
      string,
      Map<string, { youtube_id?: string | null; titulo?: string | null; descripcion?: string | null }>
    >();
    for (const o of overrideRows || []) {
      if (!o?.module_id || !o?.lesson_key) continue;
      if (!overrideByModule.has(o.module_id)) overrideByModule.set(o.module_id, new Map());
      overrideByModule.get(o.module_id)!.set(o.lesson_key, o);
    }
    const applyOverrides = (moduleId: string, lessons: any[]): any[] => {
      const m = overrideByModule.get(moduleId);
      if (!m || !Array.isArray(lessons)) return lessons;
      return lessons.map((l) => {
        const ov = l && typeof l.titulo === 'string' ? m.get(norm(l.titulo)) : undefined;
        if (!ov) return l;
        return {
          ...l,
          ...(ov.youtube_id != null ? { youtube_id: ov.youtube_id } : {}),
          ...(ov.titulo != null ? { titulo: ov.titulo } : {}),
          ...(ov.descripcion != null ? { descripcion: ov.descripcion } : {}),
        };
      });
    };

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
        // UN upsert con las 26 filas del alumno, no una por módulo. Con 30
        // alumnos eso era 780 round-trips secuenciales (~60s) y la función
        // se pasaba de maxDuration: el admin veía "Error de conexión" y el
        // sync quedaba a medias. En lote son 30 requests y termina en segundos.
        const nowIso = new Date().toISOString();
        const rows = modules.map((mod) => ({
          user_id: student.id,
          module_id: mod.module_id,
          semana_numero: mod.semana_numero,
          titulo: mod.titulo,
          descripcion: mod.descripcion,
          lessons: applyOverrides(mod.module_id, mod.lessons),
          updated_at: nowIso,
        }));
        const { error: upsertErr } = await adminClient
          .from('course_data')
          .upsert(rows, { onConflict: 'user_id,module_id' });
        if (upsertErr) {
          studentErrors = rows.length;
          details.push(`${student.nombre}: ${upsertErr.message}`);
        }

        // Asegurar user_access de los módulos iniciales. El sync creaba las
        // filas de course_data pero NUNCA las de user_access: cuando se agregó
        // el módulo "Cómo usar la app" (semana -1), todos los alumnos
        // existentes lo recibieron sin desbloquear. `ignoreDuplicates` hace que
        // no pise desbloqueos ya otorgados a mano.
        try {
          const initial = modules.filter(
            (m) => m.semana_numero >= -1 && m.semana_numero <= 4,
          );
          if (initial.length > 0) {
            await adminClient.from('user_access').upsert(
              initial.map((m) => ({
                user_id: student.id,
                module_id: m.module_id,
                is_unlocked: true,
              })),
              { onConflict: 'user_id,module_id', ignoreDuplicates: true },
            );
          }
        } catch { /* best-effort: el course_data ya quedó sincronizado */ }

        // El detalle del error ya se agregó arriba con el mensaje real de la DB.
        if (studentErrors === 0) synced++;
        else errors++;
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
