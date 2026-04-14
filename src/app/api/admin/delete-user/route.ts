import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { user, admin: adminClient } = ctx;

    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });

    // Don't allow deleting yourself
    if (userId === user.id) {
      return NextResponse.json({ error: 'No podes eliminarte a vos mismo' }, { status: 400 });
    }

    // Delete from auth (cascades to public.users via FK)
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) {
      console.error('Delete user error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
