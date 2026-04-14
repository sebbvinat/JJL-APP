import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireAdmin } from '@/lib/supabase/server';

/**
 * GET /api/videos
 *   default:       mis videos (ordenados por fecha desc).
 *   ?user=<uuid>:  admin only — videos de un alumno especifico.
 *   ?pending=1:    admin only — todos los videos con status=pendiente.
 */

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const targetUser = request.nextUrl.searchParams.get('user');
  const pendingOnly = request.nextUrl.searchParams.get('pending') === '1';

  if (targetUser || pendingOnly) {
    const ctx = await requireAdmin(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { admin } = ctx;

    let query = admin
      .from('video_uploads')
      .select('*, users(nombre, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (targetUser) query = query.eq('user_id', targetUser);
    if (pendingOnly) query = query.eq('status', 'pendiente');

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ videos: data || [] });
  }

  const { data, error } = await supabase
    .from('video_uploads')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ videos: data || [] });
}
