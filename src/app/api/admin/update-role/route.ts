import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { user, admin: adminClient } = ctx;

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
