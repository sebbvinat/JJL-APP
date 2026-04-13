import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  // Verify caller is admin
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
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'No service role key' }, { status: 500 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Check caller is admin
  const { data: callerProfile } = await adminClient
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (callerProfile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  }

  const { userId, rol } = await request.json();

  if (!userId || !['admin', 'alumno'].includes(rol)) {
    return NextResponse.json({ error: 'userId and valid rol required' }, { status: 400 });
  }

  // Prevent removing own admin role
  if (userId === user.id && rol !== 'admin') {
    return NextResponse.json({ error: 'No puedes quitarte el rol de admin a ti mismo' }, { status: 400 });
  }

  const { error } = await adminClient
    .from('users')
    .update({ rol })
    .eq('id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
