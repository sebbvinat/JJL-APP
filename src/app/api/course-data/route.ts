import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser, createAdminSupabaseClient } from '@/lib/supabase/server';
import { getPlanillaForSave } from '@/lib/planillas';

// Mes 0/1/2 (mod-0..mod-8) son idénticos en las 4 planillas (FUNDAMENTOS +
// SHARED_MONTH_1 + SHARED_MONTH_2), así que cualquiera sirve como fuente
// canónica de fallback. Para Mes 3+ esto puede no ser exacto por planilla,
// pero es infinitamente mejor que mostrar el editor vacío.
function planillaModuleFallback(moduleId: string) {
  const mods = getPlanillaForSave('livianos');
  if (!mods) return null;
  const m = mods.find((x) => x.module_id === moduleId);
  if (!m) return null;
  return {
    id: m.module_id,
    semana_numero: m.semana_numero,
    titulo: m.titulo,
    descripcion: m.descripcion,
    lessons: m.lessons,
  };
}

// GET: Load course data for the logged-in user
// ?all=true → all modules for this user (listing page)
// ?moduleId=xxx → single module for this user
// ?userId=xxx → admin override: load that student's row (admin only)
export async function GET(request: NextRequest) {
  const moduleId = request.nextUrl.searchParams.get('moduleId');
  const all = request.nextUrl.searchParams.get('all');
  const requestedUserId = request.nextUrl.searchParams.get('userId');

  const { user, supabase } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ module: null, modules: [] });
  }

  // Prefer service role client to bypass RLS; fall back to session client.
  let adminClient: ReturnType<typeof createAdminSupabaseClient> | typeof supabase;
  try {
    adminClient = createAdminSupabaseClient();
  } catch {
    adminClient = supabase;
  }

  // Look up the requester's role once. Admins get two affordances:
  //  1) honor a `userId` override and load that student's row;
  //  2) when their own row is missing for a single-module query, fall back
  //     to any row of that module so the editor doesn't show stale mock.
  const { data: profile } = await adminClient
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single();
  const isAdmin = (profile as { rol?: string } | null)?.rol === 'admin';

  let targetUserId = user.id;
  if (requestedUserId && requestedUserId !== user.id && isAdmin) {
    targetUserId = requestedUserId;
  }

  // Return all modules for this user
  if (all === 'true') {
    const { data, error } = await adminClient
      .from('course_data')
      .select('module_id, semana_numero, titulo, descripcion, lessons')
      .eq('user_id', targetUserId)
      .order('semana_numero', { ascending: true });

    if (error) {
      console.error('course-data fetch all error:', error.message);
    }

    const modules = (data || []).map((row: any) => ({
      id: row.module_id,
      semana_numero: row.semana_numero,
      titulo: row.titulo,
      descripcion: row.descripcion,
      lessonCount: Array.isArray(row.lessons) ? row.lessons.length : 0,
      videoCount: Array.isArray(row.lessons)
        ? row.lessons.filter((l: any) => l.tipo !== 'reflection').length
        : 0,
      lessons: Array.isArray(row.lessons)
        ? row.lessons.map((l: any) => ({ id: l.id, tipo: l.tipo }))
        : [],
    }));

    return NextResponse.json({ modules });
  }

  // Return single module for this user
  if (!moduleId) {
    return NextResponse.json({ error: 'moduleId requerido' }, { status: 400 });
  }

  const normKey = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

  // Overrides canónicos de video (cargados desde /admin/videos). Históricamente
  // se filtraban por module_id, pero el module_id quedó desalineado entre la
  // planilla del código, el editor (mock-data) y los course_data viejos de los
  // alumnos (el "Mes 2" se reordenó y nunca se re-sincronizó). Por eso ahora
  // matcheamos por titulo normalizado: si hay un override para ese module_id lo
  // preferimos; si no, y el titulo identifica un único override, lo aplicamos
  // igual. Si el titulo es ambiguo (varios módulos), exigimos match exacto de
  // module_id para no pisar la lección equivocada.
  type Override = {
    module_id: string;
    youtube_id?: string | null;
    titulo?: string | null;
    descripcion?: string | null;
  };
  const { data: overrideRows } = await adminClient
    .from('lesson_video_overrides')
    .select('module_id, lesson_key, youtube_id, titulo, descripcion');
  const overridesByKey = new Map<string, Override[]>();
  for (const o of (overrideRows as Override[] | null) || []) {
    const key = (o as unknown as { lesson_key?: string }).lesson_key;
    if (!key) continue;
    const list = overridesByKey.get(key) || [];
    list.push(o);
    overridesByKey.set(key, list);
  }
  const pickOverride = (titulo: string): Override | null => {
    const list = overridesByKey.get(normKey(titulo));
    if (!list || list.length === 0) return null;
    const exact = list.find((o) => o.module_id === moduleId);
    if (exact) return exact;
    return list.length === 1 ? list[0] : null;
  };

  // Fuente de verdad de fallback: la planilla del código. Si una lección quedó
  // sin youtube_id en el course_data del alumno (datos viejos, nunca re-synced),
  // la completamos por titulo desde la planilla. Mes 0-2 es idéntico en las 4
  // planillas, así que 'livianos' sirve aun si el alumno no tiene planilla.
  let targetPlanillaId: string | null = null;
  {
    const { data: tp } = await adminClient
      .from('users')
      .select('planilla_id')
      .eq('id', targetUserId)
      .single();
    targetPlanillaId = (tp as { planilla_id?: string | null } | null)?.planilla_id ?? null;
  }
  const planillaYtByTitulo = new Map<string, string>();
  for (const pid of [targetPlanillaId || 'livianos', 'livianos']) {
    const mods = getPlanillaForSave(pid);
    if (!mods) continue;
    for (const m of mods) {
      for (const ls of m.lessons) {
        const yt = (ls as { youtube_id?: string }).youtube_id;
        const tt = (ls as { titulo?: string }).titulo;
        if (tt && yt && !planillaYtByTitulo.has(normKey(tt))) {
          planillaYtByTitulo.set(normKey(tt), yt);
        }
      }
    }
  }

  const applyOverrides = (lessons: unknown): unknown => {
    if (!Array.isArray(lessons)) return lessons;
    return lessons.map((l) => {
      if (!l || typeof l !== 'object') return l;
      const lesson = l as Record<string, unknown>;
      const t = typeof lesson.titulo === 'string' ? lesson.titulo : '';
      const ov = pickOverride(t);
      const merged: Record<string, unknown> = {
        ...lesson,
        ...(ov?.youtube_id != null ? { youtube_id: ov.youtube_id } : {}),
        ...(ov?.titulo != null ? { titulo: ov.titulo } : {}),
        ...(ov?.descripcion != null ? { descripcion: ov.descripcion } : {}),
      };
      // Relleno final: si sigue sin video, tomarlo de la planilla por titulo.
      const curYt = merged.youtube_id;
      if ((curYt == null || curYt === '') && lesson.tipo !== 'reflection') {
        const fromPlanilla = planillaYtByTitulo.get(normKey(t));
        if (fromPlanilla) merged.youtube_id = fromPlanilla;
      }
      return merged;
    });
  };

  let { data, error } = await adminClient
    .from('course_data')
    .select('*')
    .eq('user_id', targetUserId)
    .eq('module_id', moduleId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('course-data fetch error:', error.message);
  }

  // Admin fallback: if no row exists for this admin/student combo, return
  // any row for the module. Bulk saves keep rows in sync per module, so any
  // row reflects the canonical version.
  if (!data && isAdmin) {
    const { data: anyRow } = await adminClient
      .from('course_data')
      .select('*')
      .eq('module_id', moduleId)
      .limit(1)
      .maybeSingle();
    if (anyRow) data = anyRow;
  }

  if (data) {
    return NextResponse.json({
      module: {
        id: data.module_id,
        semana_numero: data.semana_numero,
        titulo: data.titulo,
        descripcion: data.descripcion,
        lessons: applyOverrides(data.lessons),
      },
      moduleInfo: {
        semana_numero: data.semana_numero,
        titulo: data.titulo,
        descripcion: data.descripcion || '',
      },
    });
  }

  // No hay NINGUNA fila de course_data para este módulo (ej. todavía no se
  // sincronizó post-deploy, o ningún alumno tiene la planilla). Para admins,
  // devolvemos la planilla del código como fuente canónica para que el
  // editor de videos muestre las lecciones reales con sus youtube_ids.
  if (isAdmin) {
    const fallback = planillaModuleFallback(moduleId);
    if (fallback) {
      return NextResponse.json({
        module: { ...fallback, lessons: applyOverrides(fallback.lessons) },
        moduleInfo: {
          semana_numero: fallback.semana_numero,
          titulo: fallback.titulo,
          descripcion: fallback.descripcion || '',
        },
        source: 'planilla-fallback',
      });
    }
  }

  return NextResponse.json({ module: null });
}
