import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { admin: adminClient } = ctx;

    // 3. Get student data
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    const { data: student } = await adminClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // 4. Get unlocked module IDs
    const { data: accessData } = await adminClient
      .from('user_access')
      .select('module_id')
      .eq('user_id', userId)
      .eq('is_unlocked', true);

    const unlockedModuleIds = (accessData || []).map((r: any) => r.module_id);

    return NextResponse.json({ student, unlockedModuleIds });
  } catch (error) {
    console.error('Student data error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
