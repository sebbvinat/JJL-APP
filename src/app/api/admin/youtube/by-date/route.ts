import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { listChannelVideosOnDate } from '@/lib/youtube';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const normKey = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

/**
 * GET /api/admin/youtube/by-date?date=YYYY-MM-DD&exclude=PATTERN
 *
 * Lista los videos del canal subidos ese día (UTC), filtrados por
 * exclude (regex insensitive). Por cada video, busca lecciones en
 * course_data cuyo titulo normalizado matchee con el del video, y
 * devuelve el current youtube_id + la cantidad de alumnos que lo tienen
 * + el módulo más frecuente.
 *
 * El frontend muestra esto como propuesta de reemplazo: por cada video
 * decide si aplica o salta. Apply usa /api/admin/update-lesson-video.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { admin } = ctx;

  const date = request.nextUrl.searchParams.get('date') || '';
  const excludeRaw = request.nextUrl.searchParams.get('exclude') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date YYYY-MM-DD requerido' }, { status: 400 });
  }

  let exclude: RegExp | null = null;
  if (excludeRaw) {
    try { exclude = new RegExp(excludeRaw, 'i'); } catch { /* invalid regex, ignore */ }
  }

  let videos;
  try {
    videos = await listChannelVideosOnDate(date);
  } catch (err) {
    logger.error('admin.youtube.by-date.fetch.failed', { err: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'No pudimos consultar YouTube' }, { status: 502 });
  }

  const filtered = videos.filter((v) => !exclude || !exclude.test(v.title));

  // Bulk fetch de todos los course_data para matchear por titulo
  const { data: courseData } = await admin
    .from('course_data')
    .select('user_id, module_id, lessons');

  type LessonInJson = { id?: string; titulo?: string; youtube_id?: string };
  type CdRow = { user_id: string; module_id: string; lessons: LessonInJson[] | null };
  const rows = (courseData || []) as CdRow[];

  // Indice por titulo normalizado: { normKey -> { module_id -> { current_yt, students } } }
  type ModBucket = { current_youtube_ids: Set<string>; student_count: number };
  const indexByTitle = new Map<string, Map<string, ModBucket>>();
  for (const r of rows) {
    for (const l of r.lessons || []) {
      const t = normKey(l?.titulo || '');
      if (!t) continue;
      const byMod = indexByTitle.get(t) || new Map<string, ModBucket>();
      const cur = byMod.get(r.module_id) || { current_youtube_ids: new Set<string>(), student_count: 0 };
      if (l.youtube_id) cur.current_youtube_ids.add(l.youtube_id);
      cur.student_count++;
      byMod.set(r.module_id, cur);
      indexByTitle.set(t, byMod);
    }
  }

  const results = filtered.map((v) => {
    const t = normKey(v.title);
    const byMod = indexByTitle.get(t);
    if (!byMod || byMod.size === 0) {
      return { ...v, match: null };
    }
    // Elegir el módulo con más alumnos para el override
    let topMod = '';
    let topCount = -1;
    let totalStudents = 0;
    const currentYtIds = new Set<string>();
    for (const [mid, b] of byMod) {
      totalStudents += b.student_count;
      b.current_youtube_ids.forEach((id) => currentYtIds.add(id));
      if (b.student_count > topCount) { topMod = mid; topCount = b.student_count; }
    }
    return {
      ...v,
      match: {
        module_id: topMod,
        modules: [...byMod.keys()],
        student_count: totalStudents,
        current_youtube_ids: [...currentYtIds],
        will_replace: !currentYtIds.has(v.id),
      },
    };
  });

  return NextResponse.json({
    date,
    exclude: excludeRaw,
    total_uploaded: videos.length,
    after_exclude: filtered.length,
    matched: results.filter((r) => r.match).length,
    unmatched: results.filter((r) => !r.match).length,
    videos: results,
  });
}
