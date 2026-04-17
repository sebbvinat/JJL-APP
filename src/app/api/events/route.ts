import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

function getSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
}

// GET: list upcoming events with RSVP status
export async function GET(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const now = new Date().toISOString();
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .gte('fecha_hora', now)
    .order('fecha_hora', { ascending: true })
    .limit(20);

  // Get RSVP status for current user + attendee counts
  const eventIds = (events || []).map((e: any) => e.id);
  let userRsvps: Record<string, string> = {};
  let rsvpCounts: Record<string, { confirmed: number; total: number }> = {};

  if (eventIds.length > 0) {
    const [{ data: myRsvps }, { data: allRsvps }] = await Promise.all([
      supabase.from('event_rsvps').select('event_id, status').eq('user_id', user.id).in('event_id', eventIds),
      supabase.from('event_rsvps').select('event_id, status').in('event_id', eventIds),
    ]);

    (myRsvps || []).forEach((r: any) => { userRsvps[r.event_id] = r.status; });
    (allRsvps || []).forEach((r: any) => {
      if (!rsvpCounts[r.event_id]) rsvpCounts[r.event_id] = { confirmed: 0, total: 0 };
      rsvpCounts[r.event_id].total++;
      if (r.status === 'confirmed') rsvpCounts[r.event_id].confirmed++;
    });
  }

  // Also get past events (last 5)
  const { data: pastEvents } = await supabase
    .from('events')
    .select('*')
    .lt('fecha_hora', now)
    .order('fecha_hora', { ascending: false })
    .limit(5);

  const formatted = (events || []).map((e: any) => ({
    ...e,
    myRsvp: userRsvps[e.id] || null,
    confirmedCount: rsvpCounts[e.id]?.confirmed || 0,
    totalRsvps: rsvpCounts[e.id]?.total || 0,
  }));

  return NextResponse.json({
    events: formatted,
    pastEvents: pastEvents || [],
  });
}

// POST: create event (admin only)
export async function POST(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // Check admin
  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as any)?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const { titulo, descripcion, fecha_hora, duracion_min, timezone, meet_link, recurrencia, recurrencia_fin } = body;

  if (!titulo || !fecha_hora) {
    return NextResponse.json({ error: 'Titulo y fecha requeridos' }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Create main event
  const { data: event, error } = await adminClient
    .from('events')
    .insert({
      created_by: user.id,
      titulo,
      descripcion: descripcion || null,
      fecha_hora,
      duracion_min: duracion_min || 60,
      timezone: timezone || 'America/Argentina/Buenos_Aires',
      meet_link: meet_link || null,
      recurrencia: recurrencia || 'none',
      recurrencia_fin: recurrencia_fin || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate recurring events if needed
  if (recurrencia && recurrencia !== 'none' && recurrencia_fin) {
    const intervalDays = recurrencia === 'weekly' ? 7 : recurrencia === 'biweekly' ? 14 : 30;
    const endDate = new Date(recurrencia_fin);
    let nextDate = new Date(fecha_hora);

    const recurringEvents = [];
    while (true) {
      nextDate = new Date(nextDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      if (nextDate > endDate) break;
      recurringEvents.push({
        created_by: user.id,
        titulo,
        descripcion: descripcion || null,
        fecha_hora: nextDate.toISOString(),
        duracion_min: duracion_min || 60,
        timezone: timezone || 'America/Argentina/Buenos_Aires',
        meet_link: meet_link || null,
        recurrencia: recurrencia,
        parent_event_id: event.id,
      });
    }

    if (recurringEvents.length > 0) {
      await adminClient.from('events').insert(recurringEvents);
    }
  }

  // Notify all users about new event
  try {
    const { createNotification } = await import('@/lib/notifications');
    const { data: allUsers } = await adminClient.from('users').select('id').neq('id', user.id);
    for (const u of (allUsers || []).slice(0, 50)) {
      await createNotification(u.id, 'system', `Nuevo evento: ${titulo}`, descripcion || titulo, '/events');
    }
  } catch {}

  return NextResponse.json({ success: true, event });
}

// DELETE: delete event (admin only)
export async function DELETE(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as any)?.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { eventId } = await request.json();
  if (!eventId) return NextResponse.json({ error: 'eventId requerido' }, { status: 400 });

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Delete event + children (cascade handles rsvps)
  await adminClient.from('events').delete().eq('parent_event_id', eventId);
  await adminClient.from('events').delete().eq('id', eventId);

  return NextResponse.json({ success: true });
}
