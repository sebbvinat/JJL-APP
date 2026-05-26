import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { computeStudentTimeline, type TimelineItem } from '@/lib/crm';

type Ctx = { params: Promise<{ userId: string }> };

// GET /api/admin/students/[userId]/timeline?limit=50&types=lesson_completed,video_uploaded
export async function GET(request: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const limit = Math.min(200, Math.max(10, parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50));
  const typesParam = request.nextUrl.searchParams.get('types');
  const allowed: Set<TimelineItem['type']> | null = typesParam
    ? new Set(typesParam.split(',').map((s) => s.trim()) as TimelineItem['type'][])
    : null;

  try {
    const items = await computeStudentTimeline(auth.admin, userId, limit);
    const filtered = allowed ? items.filter((i) => allowed.has(i.type)) : items;
    return NextResponse.json({ items: filtered });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
