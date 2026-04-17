import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// GET: send email reminders for events happening in the next 24 hours
// Called via Vercel Cron or manually
export async function GET(request: Request) {
  // Verify cron secret or admin
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Find events in the next 24-25 hours (run this hourly)
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data: events } = await adminClient
    .from('events')
    .select('*')
    .gte('fecha_hora', in24h.toISOString())
    .lt('fecha_hora', in25h.toISOString());

  if (!events || events.length === 0) {
    return NextResponse.json({ message: 'No events to remind', sent: 0 });
  }

  // Get confirmed RSVPs for these events
  const eventIds = events.map((e: any) => e.id);
  const { data: rsvps } = await adminClient
    .from('event_rsvps')
    .select('event_id, user_id')
    .in('event_id', eventIds)
    .eq('status', 'confirmed');

  // Get user emails
  const userIds = [...new Set((rsvps || []).map((r: any) => r.user_id))];
  if (userIds.length === 0) {
    return NextResponse.json({ message: 'No confirmed attendees', sent: 0 });
  }

  const { data: users } = await adminClient
    .from('users')
    .select('id, nombre, email')
    .in('id', userIds);

  const userMap = new Map((users || []).map((u: any) => [u.id, u]));

  // Send emails
  const { Resend } = await import('resend');
  const resend = new Resend(resendKey);
  let sent = 0;

  for (const event of events) {
    const eventRsvps = (rsvps || []).filter((r: any) => r.event_id === event.id);
    const eventDate = new Date(event.fecha_hora);
    const dateStr = eventDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = eventDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    for (const rsvp of eventRsvps) {
      const user = userMap.get(rsvp.user_id);
      if (!user?.email) continue;

      try {
        await resend.emails.send({
          from: 'JJL Elite <noreply@jiujitsulatino.com>',
          to: user.email,
          subject: `Recordatorio: ${event.titulo} - Mañana ${timeStr}hs`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #111; color: #fff; padding: 24px; border-radius: 12px;">
              <h2 style="color: #DC2626; margin: 0 0 16px;">JIU JITSU LATINO</h2>
              <h3 style="margin: 0 0 8px;">${event.titulo}</h3>
              <p style="color: #999; margin: 0 0 16px;">
                📅 ${dateStr}<br/>
                🕐 ${timeStr} hs · ${event.duracion_min} min
              </p>
              ${event.descripcion ? `<p style="color: #ccc; margin: 0 0 16px;">${event.descripcion}</p>` : ''}
              ${event.meet_link ? `<a href="${event.meet_link}" style="display: inline-block; background: #DC2626; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Unirse a la reunion</a>` : ''}
              <p style="color: #666; font-size: 12px; margin-top: 24px;">Nos vemos en el tatami, ${user.nombre}!</p>
            </div>
          `,
        });
        sent++;
      } catch (err) {
        console.error('[remind] email failed', user.email, err);
      }
    }
  }

  return NextResponse.json({ sent, events: events.length });
}
