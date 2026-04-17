import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: NextRequest) {
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

  const { eventId, status } = await request.json();
  if (!eventId || !['confirmed', 'declined'].includes(status)) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  const { error } = await supabase
    .from('event_rsvps')
    .upsert({
      event_id: eventId,
      user_id: user.id,
      status,
    }, { onConflict: 'event_id,user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// GET: get attendee list for an event
export async function GET(request: NextRequest) {
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

  const eventId = request.nextUrl.searchParams.get('eventId');
  if (!eventId) return NextResponse.json({ error: 'eventId requerido' }, { status: 400 });

  const { data: rsvps } = await supabase
    .from('event_rsvps')
    .select('status, user_id')
    .eq('event_id', eventId);

  // Get user names
  const userIds = (rsvps || []).map((r: any) => r.user_id);
  let users: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data } = await supabase
      .from('users')
      .select('id, nombre, avatar_url')
      .in('id', userIds);
    (data || []).forEach((u: any) => { users[u.id] = u.nombre; });
  }

  const attendees = (rsvps || []).map((r: any) => ({
    userId: r.user_id,
    nombre: users[r.user_id] || 'Usuario',
    status: r.status,
  }));

  return NextResponse.json({ attendees });
}
