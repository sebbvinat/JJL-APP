import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { admin: adminClient } = ctx;

    // 3. Get all users (students + admins)
    const { data: users } = await adminClient
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    // 4. Get unlocked module counts
    const { data: accessData } = await adminClient
      .from('user_access')
      .select('user_id, module_id')
      .eq('is_unlocked', true);

    const countMap: Record<string, number> = {};
    (accessData || []).forEach((row: any) => {
      countMap[row.user_id] = (countMap[row.user_id] || 0) + 1;
    });

    const students = (users || []).map((u: any) => ({
      ...u,
      unlocked_count: countMap[u.id] || 0,
    }));

    return NextResponse.json({ students });
  } catch (error) {
    console.error('Students list error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
