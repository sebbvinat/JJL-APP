import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';

// GET: list notifications (latest 20, unread count)
export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('leido', false),
  ]);

  return NextResponse.json({
    notifications: notifications || [],
    unreadCount: unreadCount ?? 0,
  });
}

// PATCH: mark notifications as read
export async function PATCH(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();

  if (body.markAllRead) {
    await supabase
      .from('notifications')
      .update({ leido: true })
      .eq('user_id', user.id)
      .eq('leido', false);
  } else if (body.notificationId) {
    await supabase
      .from('notifications')
      .update({ leido: true })
      .eq('id', body.notificationId)
      .eq('user_id', user.id);
  }

  return NextResponse.json({ success: true });
}
