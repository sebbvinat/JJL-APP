import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

function getSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

// GET: list notifications (latest 20, unread count)
export async function GET() {
  const cookieStore = await cookies();
  const supabase = getSupabase(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

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
  const cookieStore = await cookies();
  const supabase = getSupabase(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

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
