import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Called via sendBeacon on page unload — updates session duration
export async function POST(request: Request) {
  try {
    const { sessionId, duration, pages } = await request.json();
    if (!sessionId) return NextResponse.json({ ok: true });

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await adminClient
      .from('user_sessions')
      .update({ duration_seconds: duration, pages_viewed: pages })
      .eq('id', sessionId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
