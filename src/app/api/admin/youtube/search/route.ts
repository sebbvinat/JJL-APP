import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { searchChannelVideos } from '@/lib/youtube';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/youtube/search?q=<text>
 *
 * Searches the coach's channel for videos whose title/description match
 * `q`. Returns up to 10 hits with thumbnail, title, published_at.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchChannelVideos(q, 10);
    return NextResponse.json({ results });
  } catch (err) {
    logger.error('admin.youtube.search.failed', {
      err: err instanceof Error ? err.message : 'unknown',
      qLen: q.length,
    });
    return NextResponse.json({ error: 'No pudimos consultar YouTube' }, { status: 502 });
  }
}
