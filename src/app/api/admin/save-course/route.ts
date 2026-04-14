import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request);
    if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { admin: adminClient } = ctx;

    // 2. Parse body
    const { module_id, semana_numero, titulo, descripcion, lessons } = await request.json();

    if (!module_id || !titulo) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    // 3. Upsert into course_data
    const { error } = await adminClient
      .from('course_data')
      .upsert({
        module_id,
        semana_numero: semana_numero || 0,
        titulo,
        descripcion: descripcion || '',
        lessons: lessons || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'module_id' });

    if (error) {
      console.error('Save course error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save course error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
