import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // Check admin
  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as any)?.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const studentId = request.nextUrl.searchParams.get('userId');
  if (!studentId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: entries } = await admin
    .from('daily_tasks')
    .select('*')
    .eq('user_id', studentId)
    .order('fecha', { ascending: false })
    .limit(30);

  const { data: student } = await admin
    .from('users')
    .select('nombre')
    .eq('id', studentId)
    .single();

  return NextResponse.json({
    entries: entries || [],
    studentName: student?.nombre || 'Alumno',
  });
}
