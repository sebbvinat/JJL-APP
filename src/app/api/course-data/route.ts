import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET: Load module data (overrides from Supabase, if any)
export async function GET(request: NextRequest) {
  const moduleId = request.nextUrl.searchParams.get('moduleId');
  if (!moduleId) {
    return NextResponse.json({ error: 'moduleId requerido' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ module: null });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data } = await supabase
    .from('course_data')
    .select('*')
    .eq('module_id', moduleId)
    .single();

  if (data) {
    return NextResponse.json({
      module: {
        id: data.module_id,
        semana_numero: data.semana_numero,
        titulo: data.titulo,
        descripcion: data.descripcion,
        lessons: data.lessons,
      },
    });
  }

  return NextResponse.json({ module: null });
}
