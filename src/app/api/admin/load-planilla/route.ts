import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getPlanillaForSave } from '@/lib/planillas';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  // Use service role to bypass RLS
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single();

  if ((profile as any)?.rol !== 'admin') {
    return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  }

  const { planillaId } = await request.json();

  const modules = getPlanillaForSave(planillaId);
  if (!modules) {
    return NextResponse.json({ error: 'Planilla not found' }, { status: 404 });
  }

  // Bulk upsert into course_data
  const errors: string[] = [];
  let saved = 0;

  for (const mod of modules) {
    const { error } = await supabase
      .from('course_data')
      .upsert(
        {
          module_id: mod.module_id,
          semana_numero: mod.semana_numero,
          titulo: mod.titulo,
          descripcion: mod.descripcion,
          lessons: mod.lessons,
          programa: planillaId,
        },
        { onConflict: 'module_id' }
      );

    if (error) {
      errors.push(`${mod.module_id}: ${error.message}`);
    } else {
      saved++;
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({
      success: false,
      saved,
      errors,
    }, { status: 207 });
  }

  return NextResponse.json({ success: true, saved });
}
