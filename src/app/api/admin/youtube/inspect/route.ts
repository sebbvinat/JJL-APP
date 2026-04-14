import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { fetchVideoMetadata } from '@/lib/youtube';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/youtube/inspect
 * Body: { ids: string[] }  — max 50 valid 11-char ids
 *
 * Returns { [id]: VideoMetadata } for the ones YouTube returns.
 * Missing ids in the response mean the video is private, deleted, or the
 * coach isn't authorized to see it.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  if (!Array.isArray(body.ids)) {
    return NextResponse.json({ error: 'ids debe ser un array' }, { status: 400 });
  }

  const ids = (body.ids as unknown[]).filter((v): v is string => typeof v === 'string');
  if (ids.length === 0) {
    return NextResponse.json({ videos: {} });
  }

  try {
    const videos = await fetchVideoMetadata(ids);
    return NextResponse.json({ videos });
  } catch (err) {
    logger.error('admin.youtube.inspect.failed', {
      err: err instanceof Error ? err.message : 'unknown',
      count: ids.length,
    });
    return NextResponse.json({ error: 'No pudimos consultar YouTube' }, { status: 502 });
  }
}
